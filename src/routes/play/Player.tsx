import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, RotateCcw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type {
  AnswerResult,
  AttemptResult,
  AttemptStartResponse,
  Child,
  LearningMode,
  OrderingContent,
  PlayQuestion,
} from '@shared/types';
import { api } from '../../lib/api-client';
import { AppState } from '../../components/AppState';
import { DiagramView } from '../../lib/DiagramView';
import { RichText } from '../../lib/RichText';
import { QuestionMultipleChoice } from './components/QuestionMultipleChoice';
import { QuestionTrueFalse } from './components/QuestionTrueFalse';
import { QuestionFillBlank } from './components/QuestionFillBlank';
import { QuestionMatching } from './components/QuestionMatching';
import { QuestionFraction } from './components/QuestionFraction';
import { QuestionOrdering } from './components/QuestionOrdering';
import { PlayerHeader } from './components/PlayerHeader';
import { QuestionNavigator } from './components/QuestionNavigator';
import '../../styles/child-learning.css';
import { AnswerFeedback } from './components/AnswerFeedback';
import { ExamSaveStatus } from './components/ExamSaveStatus';
import { ExerciseResult } from './components/ExerciseResult';
import {
  canSubmitExam,
  examSaveReducer,
  initialExamSaveState,
} from './child-learning-state';

interface ExerciseData {
  id: number;
  title: string;
  questions: PlayQuestion[];
  aiFeedbackAvailable: boolean;
}

interface LocalAnswer {
  answer: unknown;
  reasoningText?: string;
  timeSpentMs: number;
}

type PlayerPhase = 'questions' | 'review' | 'completing' | 'result';

function splitAnswer(value: unknown, timeSpentMs: number): LocalAnswer {
  if (value && typeof value === 'object' && 'reasoningText' in value) {
    const row = value as { selectedIndex?: unknown; reasoningText?: unknown };
    return {
      answer: { selectedIndex: row.selectedIndex },
      reasoningText: String(row.reasoningText ?? ''),
      timeSpentMs,
    };
  }
  return { answer: value, timeSpentMs };
}

function formatAnswer(value: unknown): string {
  if (value == null) return 'ยังไม่ตอบ';
  if (typeof value !== 'object') return String(value);
  return Object.values(value as Record<string, unknown>)
    .map((part) => Array.isArray(part) ? part.join(', ') : String(part))
    .join(' · ');
}

function QuestionBody({
  exercise,
  question,
  result,
  onAnswer,
}: {
  exercise: ExerciseData;
  question: PlayQuestion;
  result: AnswerResult | null;
  onAnswer: (answer: unknown) => void;
}) {
  return (
    <>
      {question.imageId ? (
        <img
          src={`/api/play/exercises/${exercise.id}/images/${question.imageId}`}
          alt="รูปประกอบโจทย์"
          className="question-image"
        />
      ) : (
        <DiagramView diagram={question.diagram} />
      )}
      {question.questionType === 'multiple_choice' && (
        <QuestionMultipleChoice
          q={question}
          result={result}
          onAnswer={onAnswer}
          aiFeedbackAvailable={exercise.aiFeedbackAvailable}
        />
      )}
      {question.questionType === 'true_false' && <QuestionTrueFalse result={result} onAnswer={onAnswer} />}
      {question.questionType === 'fill_blank' && <QuestionFillBlank q={question} result={result} onAnswer={onAnswer} />}
      {question.questionType === 'matching' && <QuestionMatching q={question} result={result} onAnswer={onAnswer} />}
      {question.questionType === 'fraction' && <QuestionFraction result={result} onAnswer={onAnswer} />}
      {question.questionType === 'ordering' && (
        <QuestionOrdering
          content={question.content as OrderingContent}
          result={result}
          onAnswer={onAnswer}
        />
      )}
    </>
  );
}

export default function Player() {
  const { id } = useParams();
  const [exercise, setExercise] = useState<ExerciseData | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [learningMode, setLearningMode] = useState<LearningMode>('guided');
  const [index, setIndex] = useState(0);
  const [localAnswers, setLocalAnswers] = useState<Record<number, LocalAnswer>>({});
  const [guidedResults, setGuidedResults] = useState<Record<number, AnswerResult>>({});
  const [saveState, dispatchSave] = useReducer(examSaveReducer, initialExamSaveState);
  const [submittingQuestionId, setSubmittingQuestionId] = useState<number | null>(null);
  const [answerError, setAnswerError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [phase, setPhase] = useState<PlayerPhase>('questions');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const questionStartedAt = useRef(Date.now());
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const completionStarted = useRef(false);
  const child: Child | null = JSON.parse(sessionStorage.getItem('activeChild') ?? 'null');

  const loadPlayer = useCallback(async () => {
    setLoadError('');
    setExercise(null);
    setAttemptId(null);
    try {
      const [nextExercise, attempt] = await Promise.all([
        api.get<ExerciseData>(`/api/play/exercises/${id}`),
        api.post<AttemptStartResponse>('/api/play/attempts', { exerciseSetId: Number(id) }),
      ]);
      const restoredAnswers: Record<number, LocalAnswer> = {};
      const restoredResults: Record<number, AnswerResult> = {};
      for (const answer of attempt.existingAnswers) {
        restoredAnswers[answer.questionId] = {
          answer: answer.givenAnswer,
          reasoningText: answer.reasoningText ?? undefined,
          timeSpentMs: answer.timeSpentMs ?? 0,
        };
        if (attempt.learningMode === 'exam') {
          dispatchSave({ type: 'save-succeeded', questionId: answer.questionId });
        } else if (typeof answer.isCorrect === 'boolean') {
          restoredResults[answer.questionId] = {
            isCorrect: answer.isCorrect,
            correctAnswer: answer.correctAnswer,
            explanation: answer.explanation ?? null,
            reasoningFeedback: answer.reasoningFeedback ?? null,
          };
        }
      }
      setExercise(nextExercise);
      setAttemptId(attempt.attemptId);
      setLearningMode(attempt.learningMode);
      setLocalAnswers(restoredAnswers);
      setGuidedResults(restoredResults);
      setIndex(Math.max(0, nextExercise.questions.findIndex((question) => !restoredAnswers[question.id])));
      questionStartedAt.current = Date.now();
    } catch {
      setLoadError('เปิดแบบฝึกนี้ไม่สำเร็จ ลองใหม่ได้โดยไม่ทำให้คำตอบที่บันทึกไว้หาย');
    }
  }, [id]);

  useEffect(() => {
    void loadPlayer();
  }, [loadPlayer]);

  async function submitGuidedAnswer(question: PlayQuestion, value: unknown) {
    if (guidedResults[question.id] || submittingQuestionId != null || attemptId == null) return;
    const local = splitAnswer(value, Date.now() - questionStartedAt.current);
    setLocalAnswers((current) => ({ ...current, [question.id]: local }));
    setSubmittingQuestionId(question.id);
    setAnswerError('');
    try {
      const feedback = await api.post<AnswerResult>(`/api/play/attempts/${attemptId}/answers`, {
        questionId: question.id,
        answer: local.answer,
        reasoningText: local.reasoningText,
        timeSpentMs: local.timeSpentMs,
      });
      setGuidedResults((current) => ({ ...current, [question.id]: feedback }));
    } catch {
      setAnswerError('ส่งคำตอบไม่สำเร็จ ลองอีกครั้งได้');
    } finally {
      setSubmittingQuestionId(null);
    }
  }

  function editExamAnswer(question: PlayQuestion, value: unknown) {
    const local = splitAnswer(value, Date.now() - questionStartedAt.current);
    setLocalAnswers((current) => ({ ...current, [question.id]: local }));
    dispatchSave({ type: 'answer-edited', questionId: question.id });
    setAnswerError('');
  }

  async function saveExamAnswer(questionId: number): Promise<boolean> {
    if (attemptId == null) return false;
    const local = localAnswers[questionId];
    if (!local) return true;
    const status = saveState.questions[questionId]?.status;
    if (status === 'saved') return true;
    dispatchSave({ type: 'save-started', questionId });
    try {
      await api.put(`/api/play/attempts/${attemptId}/answers`, {
        questionId,
        answer: local.answer,
        reasoningText: local.reasoningText,
        timeSpentMs: local.timeSpentMs,
      });
      dispatchSave({ type: 'save-succeeded', questionId });
      return true;
    } catch {
      dispatchSave({
        type: 'save-failed',
        questionId,
        message: 'บันทึกไม่สำเร็จ คำตอบยังอยู่บนหน้าจอนี้',
      });
      return false;
    }
  }

  async function navigateTo(nextIndex: number) {
    if (!exercise || nextIndex === index) return;
    const currentQuestion = exercise.questions[index];
    if (
      learningMode === 'exam' &&
      localAnswers[currentQuestion.id] &&
      saveState.questions[currentQuestion.id]?.status !== 'saved'
    ) {
      const saved = await saveExamAnswer(currentQuestion.id);
      if (!saved) return;
    }
    setIndex(nextIndex);
    setAnswerError('');
    questionStartedAt.current = Date.now();
  }

  async function openReview() {
    if (!exercise) return;
    const currentQuestion = exercise.questions[index];
    if (
      learningMode === 'exam' &&
      localAnswers[currentQuestion.id] &&
      saveState.questions[currentQuestion.id]?.status !== 'saved'
    ) {
      const saved = await saveExamAnswer(currentQuestion.id);
      if (!saved) return;
    }
    setPhase('review');
  }

  async function completeAttempt() {
    if (attemptId == null || completionStarted.current) return;
    completionStarted.current = true;
    setPhase('completing');
    setAnswerError('');
    try {
      await api.post(`/api/play/attempts/${attemptId}/complete`);
      const completedResult = await api.get<AttemptResult>(`/api/play/attempts/${attemptId}/result`);
      setResult(completedResult);
      setPhase('result');
    } catch {
      completionStarted.current = false;
      setAnswerError('ส่งแบบฝึกไม่สำเร็จ ลองอีกครั้งได้');
      setPhase(learningMode === 'exam' ? 'review' : 'questions');
    }
  }

  if (phase === 'result' && result) return <ExerciseResult result={result} />;

  if (loadError) {
    return (
      <main className="child-learning child-learning-entry-state">
        <AppState
          tone="error"
          title="เปิดแบบฝึกไม่สำเร็จ"
          description={loadError}
          action={(
            <div className="child-state-actions">
              <button type="button" className="child-primary-action" onClick={() => void loadPlayer()}>
                <RotateCcw aria-hidden="true" />
                ลองอีกครั้ง
              </button>
              <Link className="child-secondary-action" to="/play/exercises">กลับหน้ารายการ</Link>
            </div>
          )}
        />
      </main>
    );
  }

  if (!exercise || attemptId == null) {
    return (
      <main className="child-learning child-learning-entry-state">
        <AppState tone="loading" title="กำลังเตรียมแบบฝึก" description="รอสักครู่นะ" />
      </main>
    );
  }

  const total = exercise.questions.length;
  const question = exercise.questions[index];
  const guidedResult = guidedResults[question.id] ?? null;
  const answeredIds = new Set(Object.keys(localAnswers).map(Number));
  const correctIds = new Set(Object.entries(guidedResults).filter(([, value]) => value.isCorrect).map(([id]) => Number(id)));
  const wrongIds = new Set(Object.entries(guidedResults).filter(([, value]) => !value.isCorrect).map(([id]) => Number(id)));
  const allAnswered = answeredIds.size === total;
  const currentSaveState = saveState.questions[question.id];
  const canFinishExam = allAnswered && canSubmitExam(saveState);

  if (phase === 'review' || phase === 'completing') {
    return (
      <main className={`child-learning child-player child-learning--${child?.ageBand ?? 'older'}`}>
        <PlayerHeader
          title={exercise.title}
          learningMode={learningMode}
          currentIndex={index}
          total={total}
          answeredCount={answeredIds.size}
        />
        <section className="child-exam-review">
          <div>
            <p className="child-section-kicker">ตรวจคำตอบก่อนส่ง</p>
            <h2>ตอบครบหรือยัง?</h2>
            <p>กลับไปแก้คำตอบได้จนกว่าจะกดยืนยันส่งแบบฝึก</p>
          </div>
          <ol>
            {exercise.questions.map((item, itemIndex) => {
              const answered = answeredIds.has(item.id);
              const state = saveState.questions[item.id];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="child-review-question-button"
                    onClick={() => {
                      setIndex(itemIndex);
                      setPhase('questions');
                    }}
                  >
                    <span>ข้อ {itemIndex + 1}</span>
                    <strong>{answered ? 'ตอบแล้ว' : 'ยังไม่ตอบ'}</strong>
                    {state?.status === 'failed' && <small>บันทึกไม่สำเร็จ</small>}
                  </button>
                </li>
              );
            })}
          </ol>
          {answerError && <p className="child-player-error" role="alert">{answerError}</p>}
          <div className="child-player-actions">
            <button type="button" className="child-secondary-action" onClick={() => setPhase('questions')}>
              <ArrowLeft aria-hidden="true" />
              กลับไปตรวจ
            </button>
            <button
              type="button"
              className="child-primary-action"
              disabled={!canFinishExam || phase === 'completing'}
              onClick={() => confirmDialog.current?.showModal()}
            >
              <ClipboardCheck aria-hidden="true" />
              {phase === 'completing' ? 'กำลังส่ง...' : 'ส่งแบบฝึก'}
            </button>
          </div>
        </section>
        <dialog ref={confirmDialog} className="child-confirm-dialog">
          <h2>ยืนยันส่งแบบฝึก?</h2>
          <p>เมื่อส่งแล้ว คำตอบทั้งหมดจะถูกล็อกและแก้ไขไม่ได้</p>
          <div className="child-player-actions">
            <button type="button" className="child-secondary-action" onClick={() => confirmDialog.current?.close()}>
              ยังไม่ส่ง
            </button>
            <button
              type="button"
              className="child-primary-action"
              onClick={() => {
                confirmDialog.current?.close();
                void completeAttempt();
              }}
            >
              ยืนยันส่ง
            </button>
          </div>
        </dialog>
      </main>
    );
  }

  return (
    <main className={`child-learning child-player child-learning--${child?.ageBand ?? 'older'}`}>
      <PlayerHeader
        title={exercise.title}
        learningMode={learningMode}
        currentIndex={index}
        total={total}
        answeredCount={answeredIds.size}
      />
      <div className="child-player-layout">
        <section className="child-question-workspace">
          <article className="child-answer-stage">
            <div className="child-question-number">ข้อ {index + 1}</div>
            <div className="question-prompt"><RichText text={question.prompt} /></div>
            {learningMode === 'exam' && localAnswers[question.id] && (
              <p className="child-current-answer">
                <strong>คำตอบที่เลือก:</strong> {formatAnswer(localAnswers[question.id].answer)}
              </p>
            )}
            <fieldset disabled={submittingQuestionId === question.id} className="child-question-editor">
              <QuestionBody
                key={`${question.id}-${learningMode}`}
                exercise={exercise}
                question={question}
                result={learningMode === 'guided' ? guidedResult : null}
                onAnswer={(value) => {
                  if (learningMode === 'guided') {
                    void submitGuidedAnswer(question, value);
                  } else {
                    editExamAnswer(question, value);
                  }
                }}
              />
            </fieldset>
            {answerError && <p className="child-player-error" role="alert">{answerError}</p>}
            {learningMode === 'guided' && answerError && localAnswers[question.id] && !guidedResult && (
              <button
                type="button"
                className="child-secondary-action"
                onClick={() => {
                  const saved = localAnswers[question.id];
                  const value = saved.reasoningText !== undefined &&
                    saved.answer != null &&
                    typeof saved.answer === 'object'
                    ? { ...(saved.answer as Record<string, unknown>), reasoningText: saved.reasoningText }
                    : saved.answer;
                  void submitGuidedAnswer(question, value);
                }}
              >
                <RotateCcw aria-hidden="true" />
                ส่งอีกครั้ง
              </button>
            )}
            {guidedResult && (
              <AnswerFeedback visible={learningMode === 'guided'}
                result={guidedResult}
                givenAnswer={localAnswers[question.id]?.answer}
              />
            )}
            {learningMode === 'exam' && (
              <ExamSaveStatus
                state={currentSaveState}
                onRetry={() => void saveExamAnswer(question.id)}
              />
            )}
          </article>

          <div className="child-player-actions">
            <button
              type="button"
              className="child-secondary-action"
              disabled={index === 0}
              onClick={() => void navigateTo(index - 1)}
            >
              <ArrowLeft aria-hidden="true" />
              ข้อก่อนหน้า
            </button>
            {learningMode === 'guided' ? (
              <button
                type="button"
                className="child-primary-action"
                disabled={!guidedResult}
                onClick={() => {
                  if (index + 1 < total) void navigateTo(index + 1);
                  else if (allAnswered) void completeAttempt();
                }}
              >
                {index + 1 < total ? 'ข้อต่อไป' : 'ดูผลลัพธ์'}
                <ArrowRight aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className="child-primary-action"
                disabled={!localAnswers[question.id] || currentSaveState?.status === 'saving'}
                onClick={() => {
                  if (index + 1 < total) void navigateTo(index + 1);
                  else void openReview();
                }}
              >
                {index + 1 < total ? 'บันทึกและไปต่อ' : 'บันทึกและตรวจคำตอบ'}
                <CheckCircle2 aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
        <QuestionNavigator
          questionIds={exercise.questions.map((item) => item.id)}
          currentIndex={index}
          answeredIds={answeredIds}
          correctIds={learningMode === 'guided' ? correctIds : undefined}
          wrongIds={learningMode === 'guided' ? wrongIds : undefined}
          disabled={submittingQuestionId != null}
          onNavigate={(nextIndex) => void navigateTo(nextIndex)}
        />
      </div>
    </main>
  );
}
