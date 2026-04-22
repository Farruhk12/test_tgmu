import { generateQuestions } from './generator.js';
import { reviewAndFix } from './reviewer.js';

/**
 * Запускает пайплайн: Генератор → Ревьюер(проверка+правка в одном вызове).
 * Блоки тем обрабатываются ПАРАЛЛЕЛЬНО для ускорения.
 *
 * @param {object} config
 * @param {string} config.faculty
 * @param {string} config.course
 * @param {string} config.department
 * @param {string} config.subject
 * @param {Array} config.topics - [{ topic, type, difficulty, count }]
 * @param {string} [config.language='ru']
 * @param {boolean} [config.skipReview=false] — пропустить ревью (1 вызов вместо 2 на блок)
 * @returns {Promise<{ questions, log }>}
 */
export async function runPipeline(config) {
  const { faculty, course, department, subject, topics, language = 'ru', skipReview = false } = config;

  // Параллельно обрабатываем все блоки тем
  const perBlock = await Promise.all(
    topics.map((t) => runBlock({ faculty, course, department, subject, language, skipReview, ...t }))
  );

  const allQuestions = [];
  const log = [];
  for (const { questions, entry } of perBlock) {
    allQuestions.push(...questions);
    log.push(entry);
  }

  return { questions: allQuestions, log };
}

async function runBlock({
  faculty,
  course,
  department,
  subject,
  language,
  skipReview,
  topic,
  type,
  difficulty,
  count,
}) {
  const entry = { topic, type, difficulty, steps: [] };

  // Шаг 1: генерация
  let generated;
  try {
    generated = await generateQuestions({
      faculty, course, department, subject, topic, type, difficulty, count, language,
    });
    entry.steps.push({ step: 'generate', status: 'done', produced: generated.length });
  } catch (err) {
    entry.steps.push({ step: 'generate', status: 'error', error: err.message });
    return { questions: [], entry };
  }

  if (skipReview || generated.length === 0) {
    entry.final_count = generated.length;
    return {
      questions: generated.map((q) => ({ ...q, _qc: 'pass' })),
      entry,
    };
  }

  // Шаг 2: объединённый reviewer (проверка + правка)
  try {
    const { items, stats } = await reviewAndFix({
      questions: generated,
      faculty, course, subject, topic, type, difficulty, language,
    });
    entry.steps.push({ step: 'review', status: 'done', ...stats });
    entry.final_count = items.length;
    return { questions: items, entry };
  } catch (err) {
    entry.steps.push({ step: 'review', status: 'error', error: err.message });
    // fallback: возвращаем оригиналы, чтобы не терять работу генератора
    const fallback = generated.map((q) => ({ ...q, _qc: 'fallback' }));
    entry.final_count = fallback.length;
    return { questions: fallback, entry };
  }
}
