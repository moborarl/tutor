import { Check, Circle, LocateFixed, X } from 'lucide-react';

const currentLabel = 'ข้อปัจจุบัน';
const answeredLabel = 'ตอบแล้ว';
const unansweredLabel = 'ยังไม่ตอบ';
const correctLabel = 'ตอบถูก';
const wrongLabel = 'ตอบผิด';

export function QuestionNavigator({
  questionIds,
  currentIndex,
  answeredIds,
  correctIds = new Set<number>(),
  wrongIds = new Set<number>(),
  disabled = false,
  onNavigate,
}: {
  questionIds: number[];
  currentIndex: number;
  answeredIds: ReadonlySet<number>;
  correctIds?: ReadonlySet<number>;
  wrongIds?: ReadonlySet<number>;
  disabled?: boolean;
  onNavigate: (index: number) => void;
}) {
  const questionNavigatorSummary = {
    total: questionIds.length,
    answered: answeredIds.size,
    correct: correctIds.size,
    wrong: wrongIds.size,
  };

  return (
    <nav className="child-question-navigator" aria-label="เลือกข้อ">
      <details open>
        <summary>
          ดูรายการข้อ
          <span>{questionNavigatorSummary.answered}/{questionNavigatorSummary.total} ข้อ</span>
        </summary>
        <div className="child-question-navigator-body">
          <h2>รายการข้อ</h2>
          <div className="child-question-navigator-summary" aria-label="สรุปการทำแบบฝึกหัด">
            <span>ทั้งหมด {questionNavigatorSummary.total}</span>
            <span>ทำแล้ว {questionNavigatorSummary.answered}</span>
            {questionNavigatorSummary.correct > 0 && <span>ถูก {questionNavigatorSummary.correct}</span>}
            {questionNavigatorSummary.wrong > 0 && <span>ผิด {questionNavigatorSummary.wrong}</span>}
          </div>
          <ol>
            {questionIds.map((questionId, index) => {
              const current = index === currentIndex;
              const answered = answeredIds.has(questionId);
              const correct = correctIds.has(questionId);
              const wrong = wrongIds.has(questionId);
              const label = current ? currentLabel : correct ? correctLabel : wrong ? wrongLabel : answered ? answeredLabel : unansweredLabel;
              const Icon = current ? LocateFixed : correct ? Check : wrong ? X : answered ? Check : Circle;
              return (
                <li key={questionId}>
                  <button
                    type="button"
                    className={current ? 'current' : correct ? 'correct' : wrong ? 'wrong' : answered ? 'answered' : 'unanswered'}
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
