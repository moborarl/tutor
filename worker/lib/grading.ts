import type { QuestionType } from '@shared/types';

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

// Reduce fraction to lowest terms.
function reduceFraction(n: number, d: number): [number, number] {
  if (d === 0) return [n, 0];
  const g = gcd(n, d);
  const sign = d < 0 ? -1 : 1;
  return [sign * (n / g), Math.abs(d) / g];
}

// Server-side grading: compares a submitted answer against the stored answer_json.
export function gradeAnswer(
  questionType: QuestionType,
  answerJson: string,
  given: unknown,
): boolean {
  let correct: unknown;
  try {
    correct = JSON.parse(answerJson);
  } catch {
    return false;
  }
  const g = (given ?? {}) as Record<string, unknown>;
  const a = (correct ?? {}) as Record<string, unknown>;

  switch (questionType) {
    case 'multiple_choice':
      return typeof g.selectedIndex === 'number' && g.selectedIndex === a.correctIndex;
    case 'true_false':
      return typeof g.value === 'boolean' && g.value === a.value;
    case 'fill_blank': {
      if (typeof g.text !== 'string' || !Array.isArray(a.answers)) return false;
      const norm = (s: string) => s.trim().toLowerCase();
      return (a.answers as unknown[]).some(
        (ans) => typeof ans === 'string' && norm(ans) === norm(g.text as string),
      );
    }
    case 'matching': {
      if (!Array.isArray(g.pairs) || !Array.isArray(a.pairs)) return false;
      if (g.pairs.length !== a.pairs.length) return false;
      return (a.pairs as unknown[]).every((v, i) => (g.pairs as unknown[])[i] === v);
    }
    case 'fraction': {
      if (typeof g.numerator !== 'number' || typeof g.denominator !== 'number') return false;
      if (typeof a.numerator !== 'number' || typeof a.denominator !== 'number') return false;
      // Accept reduced forms: 2/4 = 1/2, etc.
      const [gN, gD] = reduceFraction(g.numerator, g.denominator);
      const [aN, aD] = reduceFraction(a.numerator, a.denominator);
      return gN === aN && gD === aD;
    }
    case 'ordering': {
      if (!Array.isArray(g.indices) || !Array.isArray(a.indices)) return false;
      if (g.indices.length !== a.indices.length) return false;
      return (a.indices as unknown[]).every((v, i) => (g.indices as unknown[])[i] === v);
    }
  }
}
