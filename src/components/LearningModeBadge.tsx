import type { LearningMode } from '@shared/types';

export function LearningModeBadge({ mode }: { mode: LearningMode }) {
  return (
    <span className="learning-mode-badge" data-mode={mode}>
      {mode === 'guided' ? 'Guided' : 'Exam'}
    </span>
  );
}
