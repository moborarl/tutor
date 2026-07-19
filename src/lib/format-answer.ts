export function formatAnswer(answer: unknown): string {
  if (answer == null) return '-';
  if (typeof answer === 'string' || typeof answer === 'number' || typeof answer === 'boolean') {
    return String(answer);
  }
  if (Array.isArray(answer)) return answer.map(formatAnswer).join(', ');
  if (typeof answer === 'object') {
    const values = Object.values(answer as Record<string, unknown>);
    return values.map(formatAnswer).join(' · ');
  }
  return String(answer);
}
