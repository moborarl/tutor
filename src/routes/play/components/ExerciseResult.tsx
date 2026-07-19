import { useRef, useState } from 'react';
import { ArrowRight, Gauge, LayoutDashboard, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AnswerResult, AttemptResult, ReasoningFeedback } from '@shared/types';
import { api } from '../../../lib/api-client';
import { RichText } from '../../../lib/RichText';
import { AnswerFeedback } from './AnswerFeedback';

function answerResult(
  question: AttemptResult['questions'][number],
  reasoningFeedback: ReasoningFeedback | null,
): AnswerResult {
  return {
    isCorrect: question.isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    reasoningFeedback,
  };
}

export function ExerciseResult({ result }: { result: AttemptResult }) {
  const [feedbackByQuestion, setFeedbackByQuestion] = useState<Record<number, ReasoningFeedback>>({});
  const [feedbackLoading, setFeedbackLoading] = useState<Set<number>>(new Set());
  const requested = useRef(new Set<number>());
  const percent = Math.round(result.score * 100);

  async function requestReasoningFeedback(questionId: number) {
    if (requested.current.has(questionId)) return;
    requested.current.add(questionId);
    setFeedbackLoading((current) => new Set(current).add(questionId));
    try {
      const feedback = await api.post<ReasoningFeedback>(
        `/api/play/attempts/${result.attemptId}/reasoning-feedback`,
        { questionId },
      );
      setFeedbackByQuestion((current) => ({ ...current, [questionId]: feedback }));
    } catch {
      setFeedbackByQuestion((current) => ({
        ...current,
        [questionId]: {
          status: 'failed',
          message: 'ยังอ่านวิธีคิดไม่ได้ แต่ยังดูเฉลยข้ออื่นต่อได้',
        },
      }));
    } finally {
      setFeedbackLoading((current) => {
        const next = new Set(current);
        next.delete(questionId);
        return next;
      });
    }
  }

  return (
    <main className="child-learning child-result-page">
      <section className="child-result-summary">
        <p className="child-section-kicker">ทำแบบฝึกเสร็จแล้ว</p>
        <h1>{result.exerciseTitle}</h1>
        <div className="child-result-score" aria-label={`ได้ ${result.correct} จาก ${result.total} ข้อ`}>
          <strong>{percent}%</strong>
          <span>{result.correct} จาก {result.total} ข้อ</span>
        </div>
        <div className="child-result-subject-progress">
          <Gauge aria-hidden="true" />
          <span>
            {result.subjectName ?? 'วิชานี้'} ทำครบ {result.subjectCompleted} จาก {result.subjectAssigned} ชุด
          </span>
        </div>
        <div className="child-result-actions">
          {result.recommendation && (
            <Link className="child-primary-action" to={`/play/exercises/${result.recommendation.id}`}>
              ทำชุดแนะนำต่อ
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
          <a className="child-secondary-action" href="#answer-review">ทบทวนคำตอบ</a>
          <Link className="child-secondary-action" to="/play/exercises">
            <LayoutDashboard aria-hidden="true" />
            หน้ารายการ
          </Link>
          <Link className="child-secondary-action" to={`/play/exercises/${result.exerciseSetId}`}>
            <RotateCcw aria-hidden="true" />
            ทำอีกครั้ง
          </Link>
        </div>
      </section>

      <section className="child-result-review" id="answer-review">
        <h2>ทบทวนคำตอบ</h2>
        <div className="child-result-question-list">
          {result.questions.map((question, index) => {
            const reasoningFeedback = question.reasoningFeedback ?? feedbackByQuestion[question.questionId] ?? null;
            const canLoadReasoning = result.learningMode === 'exam' &&
              !!question.reasoningText &&
              !reasoningFeedback;
            return (
              <details
                key={question.questionId}
                className="child-result-question"
                onToggle={(event) => {
                  if (event.currentTarget.open && canLoadReasoning) {
                    void requestReasoningFeedback(question.questionId);
                  }
                }}
              >
                <summary>
                  <span>ข้อ {index + 1}</span>
                  <strong>{question.isCorrect ? 'ถูก' : 'ทบทวนอีกครั้ง'}</strong>
                </summary>
                <div className="child-result-question-body">
                  <div className="question-prompt"><RichText text={question.prompt} /></div>
                  {feedbackLoading.has(question.questionId) && (
                    <p className="exam-reasoning-loading" role="status">กำลังอ่านวิธีคิด...</p>
                  )}
                  <AnswerFeedback visible={true}
                    givenAnswer={question.givenAnswer}
                    result={answerResult(question, reasoningFeedback)}
                  />
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </main>
  );
}
