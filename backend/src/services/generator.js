import { callJSON, modelFor } from './llm.js';
import { LANG_NAMES } from './questionFormat.js';

const DIFFICULTY_LABEL = {
  easy: 'лёгкий',
  medium: 'средний',
  hard: 'сложный',
};

const TYPE_LABEL = {
  knowledge: 'на знание (факты, определения, классификации)',
  understanding: 'на понимание (клинические задачи, анализ, интерпретация)',
};

/**
 * Статичный system-промпт — не зависит от контекста темы, поэтому кешируется провайдером.
 */
const GENERATOR_SYSTEM = `Ты — преподаватель медицинского ВУЗа, составляющий MCQ-тесты по стандартам NBME/UWSOM.

Ключевое правило — ГОМОГЕННОСТЬ вариантов: все 4 варианта должны принадлежать ОДНОЙ семантической категории и одной логической оси. Определи категорию правильного ответа (фактор риска / диагноз / препарат / симптом / метод / возбудитель / значение) — и ВСЕ дистракторы строй из той же категории.

Требования к каждому вопросу:
- 4 варианта (A, B, C, D), ровно один правильный
- Дистракторы клинически правдоподобны, а не абсурдны
- Все варианты близкой длины (±50%) и одной грамматической формы
- Запрещены: "всё перечисленное", "ни один", "A и B"
- Без слов-подсказок ("всегда", "никогда")
- Без повторения слов из ствола только в правильном ответе
- Правильный ответ распределяется равномерно по A/B/C/D
- Клиническая точность обязательна

Для типа "понимание" — клинические ситуации с данными обследования, требующие анализа. Для "знание" — прямые вопросы на факты и классификации.

Возвращай строго валидный JSON без markdown и преамбул.`;

/**
 * Генерирует вопросы по одной теме.
 */
export async function generateQuestions(params) {
  const {
    faculty,
    course,
    department,
    subject,
    topic,
    type,
    difficulty,
    count,
    language = 'ru',
  } = params;

  const langName = LANG_NAMES[language] || LANG_NAMES.ru;

  const user = `Составь ${count} тестовых вопросов.

Контекст: ${faculty}, ${course}, ${department}, ${subject}
Тема: ${topic}
Тип: ${TYPE_LABEL[type]}
Сложность: ${DIFFICULTY_LABEL[difficulty]}
Язык ВСЕХ текстов (вопросы, варианты, explanation): ${langName}

Формат ответа (строгий JSON):
{
  "questions": [
    {
      "question": "текст вопроса",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "A",
      "explanation": "почему правильный ответ верен и почему каждый дистрактор неверен (2-4 предложения)"
    }
  ]
}`;

  // Динамический лимит токенов: ~300 токенов на вопрос + запас
  const maxTokens = Math.min(8000, Math.max(1500, count * 350 + 800));

  const result = await callJSON({
    model: modelFor('generator'),
    system: GENERATOR_SYSTEM,
    user,
    maxTokens,
  });

  const questions = Array.isArray(result.questions) ? result.questions : [];
  return questions.map((q) => ({
    ...q,
    topic,
    type,
    difficulty,
  }));
}
