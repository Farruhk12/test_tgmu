import { callJSON, modelFor } from './llm.js';
import { LANG_NAMES } from './questionFormat.js';
import { normalizeDifficultyScore, sanitizeDifficultyNote } from './difficultyScore.js';

/**
 * Статичный system-промпт — кешируется провайдером.
 */
const REVIEWER_SYSTEM = `Ты — методист медицинского ВУЗа. Проверяешь MCQ-вопросы по стандарту NBME/UWSOM и исправляешь проблемные в том же вызове.

ГОМОГЕННОСТЬ (критично): все четыре варианта должны отвечать на один тип запроса в стволе и лежать на ОДНОЙ оси. Если верный ответ угадывается потому, что дистракторы из другой системы органов, другого класса факторов риска или несопоставимых категорий — это ДЕФЕКТ: verdict="fix" (перепиши ствол и/или все дистракторы) или "reject" если без переписывания ствола не исправить.

Контрольные антипримеры (всегда fix/reject):
- Симптом при рахите + дистракторы вроде тахипноэ, острой инфекции, анемии при верном «костная деформация».
- Фактор риска атопического дерматита + смесь наследственности, витамина D, экологии и белка в питании при верном «наследственная предрасположенность».

При fix: замени дистракторы на варианты ТОЙ ЖЕ оси, что и правильный (или уточни ствол под выбранную ось). Не оставляй «очевидно чужие» варианты.

Для каждого входного вопроса:
- "pass"  — качественный, оставь БЕЗ изменений (revised не нужен)
- "fix"   — есть проблемы, ВЕРНИ исправленную версию в поле "revised" (с теми же topic/type/difficulty)
- "reject" — фундаментальная клиническая ошибка, исправить нельзя

При исправлении: сохрани язык, формат (4 варианта), замени проблемные дистракторы на правдоподобные варианты ИЗ ТОЙ ЖЕ категории, что и правильный ответ. Правильный ответ может стоять под любой буквой.

У каждого входного вопроса есть "difficulty_score" (0–100) и "difficulty_note". **Больше балл = сложнее для студента** (не качество вопроса). При verdict="pass" не меняй их. При verdict="fix" в "revised" заново выставь difficulty_score и difficulty_note с учётом метки сложности блока из запроса (лёгкий → типично ниже, сложный → выше) и тех же критериев, что у генератора. Не присваивай всем вопросам одно и то же число без причины.

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
