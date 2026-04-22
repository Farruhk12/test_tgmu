/** @param {object} q */
export function uiDifficultyScore(q) {
  const n = Number(q?.difficulty_score);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** @param {number} score 0–100 */
export function difficultyScoreBadgeClass(score) {
  if (score <= 25) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (score <= 50) return 'bg-sky-50 text-sky-800 border-sky-200';
  if (score <= 75) return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-rose-50 text-rose-800 border-rose-200';
}

/** Подпись к шкале: больше = сложнее для студента */
export function difficultyScoreBandLabelRu(score) {
  if (score <= 25) return 'низкая трудность';
  if (score <= 50) return 'умеренная';
  if (score <= 75) return 'высокая';
  return 'очень высокая';
}

/** Метка «корзины» из сетки тем (easy/medium/hard) */
export function difficultyBucketLabelRu(bucket) {
  const m = { easy: 'лёгкий', medium: 'средний', hard: 'сложный' };
  if (bucket && m[bucket]) return m[bucket];
  return bucket || '—';
}

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
