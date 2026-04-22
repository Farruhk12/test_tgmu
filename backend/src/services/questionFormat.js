/** @typedef {'ru' | 'tj' | 'en'} ContentLang */

export const LANG_NAMES = {
  ru: 'русский',
  tj: 'таджикский (кириллица)',
  en: 'английский',
};

/**
 * Строки вопроса в формате: @вопрос, #неверный, #&верный (без пробела после префикса).
 * Порядок вариантов: A, B, C, D.
 */
export function questionToSymbolLines(q) {
  const lines = [`@${(q.question || '').trim()}`];
  for (const L of ['A', 'B', 'C', 'D']) {
    const text = q.options?.[L];
    if (text == null || String(text).trim() === '') continue;
    const prefix = q.correct === L ? '#&' : '#';
    lines.push(`${prefix}${String(text).trim()}`);
  }
  return lines;
}

export function questionsToSymbolText(questions, { numbered = false } = {}) {
  const blocks = [];
  questions.forEach((q, i) => {
    const lines = questionToSymbolLines(q);
    if (numbered) {
      blocks.push(`--- ${i + 1} ---`);
    }
    blocks.push(lines.join('\n'));
  });
  return blocks.join('\n\n');
}
