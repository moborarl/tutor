import { ArrowRight, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PlayExercise } from '@shared/types';
import { LearningModeBadge } from '../../../components/LearningModeBadge';

const FALLBACK_SUBJECT = 'ไม่ระบุวิชา';

export function ResumeExercisePanel({ exercise }: { exercise: PlayExercise }) {
  return (
    <section className="child-resume-panel" aria-labelledby={`resume-exercise-${exercise.id}`}>
      <div className="child-resume-icon" aria-hidden="true">
        <History />
      </div>
      <div className="child-resume-copy">
        <p className="child-section-kicker">In progress</p>
        <h2 id={`resume-exercise-${exercise.id}`}>{exercise.title || 'Practice set'}</h2>
        <div className="child-resume-meta">
          <span>{exercise.subjectName ?? FALLBACK_SUBJECT}</span>
          <LearningModeBadge mode={exercise.learningMode} />
          <span>{exercise.inProgressAnsweredCount} of {exercise.questionCount} answered</span>
        </div>
      </div>
      <Link className="child-primary-action" to={`/play/exercises/${exercise.id}`}>
        Continue where I stopped
        <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}
