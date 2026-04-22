/** Значение по умолчанию, если модель не вернула оценку (ориентир по «корзине» блока). */
/** Центр диапазона при отсутствии ответа модели (согласовано с якорями в промпте). */
export const DIFFICULTY_BUCKET_DEFAULT = {
  easy: 22,
  medium: 42,
  hard: 68,
};

/**
 * @param {unknown} raw
 * @param {number | null} [fallback] — если raw не число
 * @returns {number}
 */
export function normalizeDifficultyScore(raw, fallback = null) {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    if (fallback == null || !Number.isFinite(fallback)) return 50;
    return Math.max(0, Math.min(100, Math.round(fallback)));
  }
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizeDifficultyNote(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 450);
}
