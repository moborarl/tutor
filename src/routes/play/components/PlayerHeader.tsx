import { LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LearningMode } from '@shared/types';
import { LearningModeBadge } from '../../../components/LearningModeBadge';

export function PlayerHeader({
  title,
  learningMode,
  currentIndex,
  total,
  answeredCount,
}: {
  title: string;
  learningMode: LearningMode;
  currentIndex: number;
  total: number;
  answeredCount: number;
}) {
  return (
    <header className="child-player-header">
      <div className="child-player-heading">
        <div className="child-player-title-row">
          <h1>{title}</h1>
          <LearningModeBadge mode={learningMode} />
        </div>
        <p>ข้อ {currentIndex + 1} จาก {total}</p>
        <progress value={answeredCount} max={total || 1} aria-label={`ตอบแล้ว ${answeredCount} จาก ${total} ข้อ`} />
      </div>
      <Link className="child-secondary-action child-player-exit" to="/play/exercises">
        <LogOut aria-hidden="true" />
        ออกจากแบบฝึก
      </Link>
    </header>
  );
}
