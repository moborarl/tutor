import type { QuestionType } from '@shared/types';

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
  }
}
