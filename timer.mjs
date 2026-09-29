export function restoredDeadline(savedDeadline, durationMinutes, now = Date.now()) {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) return null;
  const durationMs = durationMinutes * 60_000;
  if (!Number.isFinite(savedDeadline) || savedDeadline <= now || savedDeadline > now + durationMs) return null;
  return savedDeadline;
}
