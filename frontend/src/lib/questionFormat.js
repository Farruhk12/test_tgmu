/** @param {object} q */
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
