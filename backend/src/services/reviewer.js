import { callJSON, modelFor } from './llm.js';
import { LANG_NAMES } from './questionFormat.js';

/**
 * Статичный system-промпт — кешируется провайдером.
 */
const REVIEWER_SYSTEM = `Ты — методист медицинского ВУЗа. Проверяешь MCQ-вопросы по стандарту NBME/UWSOM и исправляешь проблемные в том же вызове.

Главное правило — ГОМОГЕННОСТЬ: все 4 варианта должны принадлежать одной семантической категории (фактор риска / диагноз / препарат / симптом / метод / возбудитель). Если хоть один дистрактор абсурден или "из другой сферы" — вопрос требует ревизии.

Для каждого входного вопроса:
- "pass"  — качественный, оставь БЕЗ изменений (revised не нужен)
- "fix"   — есть проблемы, ВЕРНИ исправленную версию в поле "revised" (с теми же topic/type/difficulty)
- "reject" — фундаментальная клиническая ошибка, исправить нельзя

При исправлении: сохрани язык, формат (4 варианта), замени проблемные дистракторы на правдоподобные варианты ИЗ ТОЙ ЖЕ категории, что и правильный ответ. Правильный ответ может стоять под любой буквой.

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
        "explanation": "2-4 предложения на ${langName}"
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
      items.push({
        question: v.revised.question || questions[i].question,
        options: v.revised.options || questions[i].options,
        correct: v.revised.correct || questions[i].correct,
        explanation: v.revised.explanation || questions[i].explanation,
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
