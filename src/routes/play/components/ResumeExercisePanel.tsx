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
        <p className="child-section-kicker">กำลังทำอยู่</p>
        <h2 id={`resume-exercise-${exercise.id}`}>{exercise.title || 'ชุดแบบฝึกหัด'}</h2>
        <div className="child-resume-meta">
          <span>{exercise.subjectName ?? FALLBACK_SUBJECT}</span>
          <LearningModeBadge mode={exercise.learningMode} />
          <span>ทำแล้ว {exercise.inProgressAnsweredCount} จาก {exercise.questionCount} ข้อ</span>
        </div>
      </div>
      <Link className="child-primary-action" to={`/play/exercises/${exercise.id}`}>
        ทำต่อจากเดิม
        <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}
