import { Check, Circle, LocateFixed } from 'lucide-react';

const currentLabel = 'ข้อปัจจุบัน';
const answeredLabel = 'ตอบแล้ว';
const unansweredLabel = 'ยังไม่ตอบ';

export function QuestionNavigator({
  questionIds,
  currentIndex,
  answeredIds,
  disabled = false,
  onNavigate,
}: {
  questionIds: number[];
  currentIndex: number;
  answeredIds: ReadonlySet<number>;
  disabled?: boolean;
  onNavigate: (index: number) => void;
}) {
  return (
    <nav className="child-question-navigator" aria-label="เลือกข้อ">
      <details>
        <summary>ดูรายการข้อ</summary>
        <div className="child-question-navigator-body">
          <h2>รายการข้อ</h2>
          <ol>
            {questionIds.map((questionId, index) => {
              const current = index === currentIndex;
              const answered = answeredIds.has(questionId);
              const label = current ? currentLabel : answered ? answeredLabel : unansweredLabel;
              const Icon = current ? LocateFixed : answered ? Check : Circle;
              return (
                <li key={questionId}>
                  <button
                    type="button"
                    className={current ? 'current' : answered ? 'answered' : 'unanswered'}
                    aria-current={current ? 'step' : undefined}
                    disabled={disabled}
                    onClick={() => onNavigate(index)}
                  >
                    <Icon aria-hidden="true" />
                    <span>ข้อ {index + 1}</span>
                    <small>{label}</small>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </details>
    </nav>
  );
}
