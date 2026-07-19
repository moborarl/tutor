import { ArrowRight, Play, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PlayExercise } from '@shared/types';
import { LearningModeBadge } from '../../../components/LearningModeBadge';

const FALLBACK_SUBJECT = 'ไม่ระบุวิชา';

function exerciseState(exercise: PlayExercise) {
  if (exercise.hasInProgress) {
    return { action: 'ทำต่อ', status: 'กำลังทำ', Icon: ArrowRight };
  }
  if (exercise.completedCount > 0 || exercise.bestScore != null) {
    return { action: 'ทำซ้ำ', status: 'ทำเสร็จแล้ว', Icon: RotateCcw };
  }
  return { action: 'เริ่มทำ', status: 'ยังไม่ได้ทำ', Icon: Play };
}

export function ChildExerciseList({ exercises }: { exercises: PlayExercise[] }) {
  return (
    <ul className="child-exercise-list" role="list" aria-label="แบบฝึกหัดที่ได้รับมอบหมาย">
      {exercises.map((exercise) => {
        const state = exerciseState(exercise);
        return (
          <li className="child-exercise-row" key={exercise.id}>
            <div className="child-exercise-main">
              <div className="child-exercise-heading">
                <h2>{exercise.title || 'Practice set'}</h2>
                <LearningModeBadge mode={exercise.learningMode} />
              </div>
              <p className="child-exercise-meta">
                <span>{exercise.subjectName ?? FALLBACK_SUBJECT}</span>
                <span>{exercise.questionCount} ข้อ</span>
                {exercise.bestScore != null && (
                  <span className="child-exercise-score">ดีที่สุด {Math.round(exercise.bestScore * 100)}%</span>
                )}
              </p>
            </div>
            <span className={`child-exercise-status child-exercise-status--${state.status.toLowerCase().replace(' ', '-')}`}>
              {state.status}
            </span>
            <Link className="child-primary-action child-exercise-action" to={`/play/exercises/${exercise.id}`}>
              {state.action}
              <state.Icon aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
