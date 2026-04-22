import { callJSON, modelFor } from './llm.js';
import { LANG_NAMES } from './questionFormat.js';

/**
 * Переводит готовые вопросы с русского на targetLang, сохраняя ту же клиническую задачу и букву correct.
 * @param {object[]} questions — как из пайплайна (русский текст)
 * @param {'ru' | 'tj' | 'en'} targetLang
 */
export async function translateQuestionsBatch(questions, targetLang) {
  if (!questions?.length) return [];
  if (targetLang === 'ru') {
    return questions.map((q) => ({ ...q }));
  }

  const langName = LANG_NAMES[targetLang] || targetLang;

  const stripped = questions.map((q, idx) => ({
    index: idx,
    question: q.question,
    options: { ...q.options },
    correct: q.correct,
    explanation: q.explanation || '',
  }));

  const system = `Ты переводчик медицинских MCQ-тестов. Исходный язык — русский. Ты получаешь JSON и возвращаешь только валидный JSON.`;

  const user = `Переведи каждый вопрос с русского на ${langName}. Это ОДИН И ТОТ ЖЕ тест: смысл, клиническая задача и то, какой ответ верный, должны полностью соответствовать оригиналу — только язык формулировок меняется.

Вход (массив):
${JSON.stringify(stripped, null, 2)}

Верни строго JSON:
{ "questions": [ { "index": 0, "question": "…", "options": { "A":"…","B":"…","C":"…","D":"…" }, "explanation": "…" }, … ] }

Правила:
- Ровно ${questions.length} элементов; "index" от 0 до ${questions.length - 1}, без пропусков.
- Поле "correct" в ответ НЕ включай — оно будет взято из оригинала.
- Переведи question, все четыре options (A–D), explanation.
- Не меняй структуру, не добавляй поля, не используй markdown.
- Терминология медицинская, для таджикского — кириллица.`;

  const result = await callJSON({
    model: modelFor('editor'),
    system,
    user,
    maxTokens: 8192,
    cacheSystem: false,
  });

  const rows = result.questions || [];
  if (rows.length !== questions.length) {
    throw new Error(
      `Перевод (${langName}): ожидалось ${questions.length} вопросов, модель вернула ${rows.length}`
    );
  }

  rows.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  return rows.map((t, i) => {
    const src = questions[i];
    const correct = src.correct;
    return {
      ...src,
      question: t.question ?? src.question,
      options: {
        A: t.options?.A ?? src.options?.A,
        B: t.options?.B ?? src.options?.B,
        C: t.options?.C ?? src.options?.C,
        D: t.options?.D ?? src.options?.D,
      },
      correct,
      explanation: t.explanation ?? src.explanation,
    };
  });
}
