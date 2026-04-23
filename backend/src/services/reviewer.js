import { callJSON, modelFor } from './llm.js';
import { LANG_NAMES } from './questionFormat.js';
import { normalizeDifficultyScore, sanitizeDifficultyNote } from './difficultyScore.js';

/**
 * Статичный system-промпт — кешируется провайдером.
 */
const REVIEWER_SYSTEM = `Ты — методист ВУЗа. Проверяешь MCQ-вопросы с выбором одного правильного ответа и исправляешь проблемные в том же вызове.

Для каждого вопроса выноси вердикт:
- "pass"   — всё в порядке, оставь без изменений (поле "revised" не нужно)
- "fix"    — есть нарушения, верни исправленную версию в поле "revised"
- "reject" — фундаментальная фактическая ошибка, исправить нельзя

═══════════════════════════════════════════════
ЧТО ПРОВЕРЯТЬ (основания для fix/reject)
═══════════════════════════════════════════════

СТВОЛ ВОПРОСА:
- Ствол содержит несколько мыслей или вводные фразы, не связанные с вопросом → fix
- Использованы запрещённые расплывчатые слова: «большой», «малый», «очень», «меньше», «больше», «пониженный», «повышенный», «высокий», «низкий», «увеличенный», «сниженный» → fix
- Есть отрицание в стволе или двойное отрицание → fix
- Ствол содержит словесные подсказки, облегчающие угадывание (слова-маркеры, повтор только в верном ответе) → fix
- Ключевые слова темы вынесены в дистракторы, а не в ствол → fix

ДИСТРАКТОРЫ:
- Гомогенность нарушена: дистракторы из разных осей/категорий → fix (замени дистракторы или уточни ствол под одну ось)
- Хотя бы один дистрактор очевидно абсурдный или из другой области → fix
- Хотя бы один дистрактор является частично правильным ответом (верен при некоторых условиях) → fix
- Варианты типа «всё перечисленное», «ни один из перечисленных», «A и B», «да/нет», «верно/неверно» → fix
- Варианты слишком похожи друг на друга без содержательного различия → fix
- Слово, повторяющееся во всех вариантах, не перенесено в ствол → fix
- Варианты — отдельные слова/фразы, не упорядочены алфавитно или по длине → fix
- В вариантах использованы сравнительные/расплывчатые формы без опорной точки: «пониженный/повышенный уровень X», «высокий/низкий уровень X», «увеличенный/сниженный X», «больше/меньше нормы» → fix. Замени на конкретику: числовой порог с единицами и референсом, именованное патологическое состояние (гипокальциемия, гиперкалиемия, лейкоцитоз и т.п.) или точный качественный признак.

ГОМОГЕННОСТЬ (ключевое): все 4 варианта должны лежать на ОДНОЙ логической оси. Если верный ответ угадывается из-за того, что дистракторы из другой категории — это дефект гомогенности: verdict="fix", замени дистракторы на варианты той же оси или уточни ствол.

При исправлении (fix): сохрани язык, формат (4 варианта A–D), исправь только проблемные части. Правильный ответ может стоять под любой буквой.

У каждого вопроса есть "difficulty_score" (0–100) — больше = сложнее для студента (не оценка качества). При "pass" не меняй. При "fix" в "revised" пересчитай с учётом метки сложности блока из запроса. Не присваивай всем одно число.

Возвращай строго валидный JSON без markdown и преамбул.`;

/**
 * Проверяет и при необходимости исправляет вопросы в одном вызове.
 * Возвращает готовый массив вопросов с полем _qc ('pass' | 'revised').
 * Отбракованные (reject) отфильтровываются.
 */
export async function reviewAndFix({
  questions,
  faculty,
  course,
  subject,
  topic,
  type,
  difficulty,
  language = 'ru',
}) {
  if (!questions.length) return { items: [], stats: { pass: 0, fix: 0, reject: 0 } };

  const langName = LANG_NAMES[language] || LANG_NAMES.ru;

  const compact = questions.map((q, i) => ({
    i,
    question: q.question,
    options: q.options,
    correct: q.correct,
    difficulty_score: q.difficulty_score,
    difficulty_note: q.difficulty_note,
  }));

  const user = `Проверь ${questions.length} вопросов.

Контекст: ${faculty}, ${course}, ${subject}, тема "${topic}"
Тип: ${type}, сложность: ${difficulty}
Язык текстов: ${langName}

Вопросы:
${JSON.stringify(compact, null, 2)}

Формат ответа (строгий JSON):
{
  "results": [
    {
      "index": 0,
      "verdict": "pass" | "fix" | "reject",
      "revised": {
        "question": "...",
        "options": { "A":"...", "B":"...", "C":"...", "D":"..." },
        "correct": "A",
        "explanation": "2-4 предложения на ${langName}",
        "difficulty_score": 0,
        "difficulty_note": "кратко на ${langName}"
      }
    }
  ]
}

Поле "revised" обязательно ТОЛЬКО при verdict="fix". Для "pass" и "reject" — не нужно.`;

  const maxTokens = Math.min(8000, Math.max(1500, questions.length * 400 + 600));

  const result = await callJSON({
    model: modelFor('critic'),
    system: REVIEWER_SYSTEM,
    user,
    maxTokens,
  });

  const verdicts = Array.isArray(result.results) ? result.results : [];
  const stats = { pass: 0, fix: 0, reject: 0 };
  const items = [];

  for (let i = 0; i < questions.length; i++) {
    const v = verdicts.find((x) => x.index === i);
    if (!v || v.verdict === 'pass') {
      stats.pass++;
      items.push({ ...questions[i], _qc: 'pass' });
    } else if (v.verdict === 'fix' && v.revised) {
      stats.fix++;
      const prev = questions[i];
      items.push({
        question: v.revised.question || prev.question,
        options: v.revised.options || prev.options,
        correct: v.revised.correct || prev.correct,
        explanation: v.revised.explanation || prev.explanation,
        difficulty_score: normalizeDifficultyScore(
          v.revised.difficulty_score,
          prev.difficulty_score
        ),
        difficulty_note: sanitizeDifficultyNote(
          v.revised.difficulty_note != null && String(v.revised.difficulty_note).trim() !== ''
            ? v.revised.difficulty_note
            : prev.difficulty_note
        ),
        topic,
        type,
        difficulty,
        _qc: 'revised',
      });
    } else if (v.verdict === 'reject') {
      stats.reject++;
      // отбрасываем
    } else {
      // неизвестный вердикт — считаем pass
      stats.pass++;
      items.push({ ...questions[i], _qc: 'pass' });
    }
  }

  return { items, stats };
}
