import { AlertCircle, Check, LoaderCircle, RotateCcw } from 'lucide-react';
import type { ExamQuestionSaveState } from '../child-learning-state';

export function ExamSaveStatus({
  state,
  onRetry,
}: {
  state: ExamQuestionSaveState | undefined;
  onRetry: () => void;
}) {
  if (!state || state.status === 'idle') return null;
  if (state.status === 'saving') {
    return <div className="exam-save-status saving"><LoaderCircle aria-hidden="true" /> กำลังบันทึก</div>;
  }
  if (state.status === 'saved') {
    return <div className="exam-save-status saved"><Check aria-hidden="true" /> บันทึกแล้ว</div>;
  }
  return (
    <div className="exam-save-status failed" role="alert">
      <AlertCircle aria-hidden="true" />
      <span>{state.message ?? 'บันทึกคำตอบไม่สำเร็จ'}</span>
      <button type="button" className="child-secondary-action" onClick={onRetry}>
        <RotateCcw aria-hidden="true" />
        ลองบันทึกอีกครั้ง
      </button>
    </div>
  );
}
