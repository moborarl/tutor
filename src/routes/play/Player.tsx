import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { Child, PlayQuestion, AnswerResult, OrderingContent } from '@shared/types';
import { QuestionMultipleChoice } from './components/QuestionMultipleChoice';
import { QuestionTrueFalse } from './components/QuestionTrueFalse';
import { QuestionFillBlank } from './components/QuestionFillBlank';
import { QuestionMatching } from './components/QuestionMatching';
import { QuestionFraction } from './components/QuestionFraction';
import { QuestionOrdering } from './components/QuestionOrdering';
import { DiagramView } from '../../lib/DiagramView';
import { RichText } from '../../lib/RichText';

interface ExerciseData {
  id: number;
  title: string;
  questions: PlayQuestion[];
  aiFeedbackAvailable: boolean;
}

function QuestionBody({
  exercise,
  q,
  result,
  onAnswer,
  aiFeedbackAvailable,
}: {
  exercise: ExerciseData;
  q: PlayQuestion;
  result: AnswerResult | null;
  onAnswer: (answer: unknown) => void;
  aiFeedbackAvailable: boolean;
}) {
  return (
    <>
      {q.imageId ? (
        <img src={`/api/play/exercises/${exercise.id}/images/${q.imageId}`} alt="รูปประกอบโจทย์" className="question-image" />
      ) : (
        <DiagramView diagram={q.diagram} />
      )}
      {q.questionType === 'multiple_choice' && <QuestionMultipleChoice q={q} result={result} onAnswer={onAnswer} aiFeedbackAvailable={aiFeedbackAvailable} />}
      {q.questionType === 'true_false' && <QuestionTrueFalse result={result} onAnswer={onAnswer} />}
      {q.questionType === 'fill_blank' && <QuestionFillBlank q={q} result={result} onAnswer={onAnswer} />}
      {q.questionType === 'matching' && <QuestionMatching q={q} result={result} onAnswer={onAnswer} />}
      {q.questionType === 'fraction' && <QuestionFraction result={result} onAnswer={onAnswer} />}
      {q.questionType === 'ordering' && <QuestionOrdering content={q.content as OrderingContent} result={result} onAnswer={onAnswer} />}
    </>
  );
}

function Feedback({ result }: { result: AnswerResult }) {
  return (
    <>
      <div className={`feedback-banner ${result.isCorrect ? 'good' : 'bad'}`}>
        {result.isCorrect ? '🎉 ถูกต้อง เก่งมาก!' : 'ยังไม่ถูก ดูเฉลยนะ'}
      </div>
      {result.explanation && <div className="explain-box">💡 {result.explanation}</div>}
      {result.reasoningFeedback && (
        <div className={`reasoning-feedback ${result.reasoningFeedback.status}`}>
          <b>ผู้ช่วยอ่านวิธีคิด</b>
          <span>{result.reasoningFeedback.message}</span>
        </div>
      )}
    </>
  );
}

function ProgressLine({ answeredCount, total }: { answeredCount: number; total: number }) {
  const pct = total ? Math.round((answeredCount / total) * 100) : 0;
  return (
    <div className="play-progress-line">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span>{pct}%</span>
    </div>
  );
}

export default function Player() {
  const { id } = useParams();
  const nav = useNavigate();
  const [exercise, setExercise] = useState<ExerciseData | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerResult>>({});
  const [finished, setFinished] = useState<{ score: number; correct: number; total: number } | null>(null);
  const questionStart = useRef(Date.now());
  const child: Child | null = JSON.parse(sessionStorage.getItem('activeChild') ?? 'null');

  useEffect(() => {
    (async () => {
      try {
        const ex = await api.get<ExerciseData>(`/api/play/exercises/${id}`);
        const at = await api.post<{
          attemptId: number;
          existingAnswers?: Array<{ questionId: number; isCorrect: boolean; correctAnswer: unknown; explanation: string | null; reasoningFeedback?: AnswerResult['reasoningFeedback'] }>;
        }>('/api/play/attempts', { exerciseSetId: Number(id) });
        setExercise(ex);
        setAttemptId(at.attemptId);
        if (at.existingAnswers?.length) {
          const restored: Record<number, AnswerResult> = {};
          for (const a of at.existingAnswers) {
            restored[a.questionId] = { isCorrect: a.isCorrect, correctAnswer: a.correctAnswer, explanation: a.explanation, reasoningFeedback: a.reasoningFeedback };
          }
          setAnswers(restored);
        }
        questionStart.current = Date.now();
      } catch {
        nav('/play');
      }
    })();
  }, [id, nav]);

  if (!exercise || attemptId == null) {
    return (
      <div className="play-root centered-play">
        <div className="state-card">
          <div className="state-spinner" />
          <b>กำลังเตรียมแบบฝึกหัด</b>
          <span>รอสักครู่นะ</span>
        </div>
      </div>
    );
  }

  const uiSimple = child?.ageBand === 'young';
  const total = exercise.questions.length;
  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
  const allAnswered = answeredCount === total;

  async function submitAnswer(question: PlayQuestion, answer: unknown, startedAt: number) {
    if (answers[question.id]) return;
    const reasoningText = typeof answer === 'object' && answer && 'reasoningText' in answer
      ? String((answer as { reasoningText?: unknown }).reasoningText ?? '')
      : undefined;
    const answerPayload = reasoningText !== undefined && typeof answer === 'object' && answer
      ? { selectedIndex: (answer as { selectedIndex?: unknown }).selectedIndex }
      : answer;
    const res = await api.post<AnswerResult>(`/api/play/attempts/${attemptId}/answers`, {
      questionId: question.id,
      answer: answerPayload,
      reasoningText,
      timeSpentMs: Date.now() - startedAt,
    });
    setAnswers((prev) => ({ ...prev, [question.id]: res }));
  }

  async function finish() {
    const done = await api.post<{ score: number; correct: number; total: number }>(
      `/api/play/attempts/${attemptId}/complete`,
    );
    setFinished(done);
  }

  if (finished) {
    const pctScore = Math.round(finished.score * 100);
    return (
      <div className={`play-root ${uiSimple ? 'ui-simple' : ''}`} style={{ justifyContent: 'center' }}>
        <div className="play-finish-card">
          <div className="play-finish-medal">{pctScore >= 80 ? '🏆' : pctScore >= 50 ? '🎉' : '💪'}</div>
          <h1>{pctScore >= 80 ? 'เก่งมาก!' : pctScore >= 50 ? 'ดีมาก!' : 'สู้ๆ นะ ลองอีกครั้ง!'}</h1>
          <div className="play-finish-score">ได้ {finished.correct} จาก {finished.total} ข้อ ({pctScore}%)</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pctScore}%` }} /></div>
          <div className="row" style={{ marginTop: 24, justifyContent: 'center' }}>
            <button onClick={() => window.location.reload()}>ทำอีกครั้ง</button>
            <button className="secondary" onClick={() => nav('/play/exercises')}>กลับหน้ารายการ</button>
          </div>
        </div>
      </div>
    );
  }

  if (uiSimple) {
    return (
      <SimplePlayer
        exercise={exercise}
        index={index}
        setIndex={setIndex}
        answers={answers}
        answeredCount={answeredCount}
        allAnswered={allAnswered}
        total={total}
        onAnswer={(q, answer) => submitAnswer(q, answer, questionStart.current)}
        onNavigate={() => { questionStart.current = Date.now(); }}
        onFinish={finish}
        onExit={() => nav('/play/exercises')}
      />
    );
  }

  return (
    <OlderPlayer
      exercise={exercise}
      answers={answers}
      answeredCount={answeredCount}
      correctCount={correctCount}
      allAnswered={allAnswered}
      total={total}
      onAnswer={(q, answer) => submitAnswer(q, answer, Date.now())}
      onFinish={finish}
      onExit={() => nav('/play/exercises')}
    />
  );
}

function OlderPlayer({
  exercise,
  answers,
  answeredCount,
  correctCount,
  allAnswered,
  total,
  onAnswer,
  onFinish,
  onExit,
}: {
  exercise: ExerciseData;
  answers: Record<number, AnswerResult>;
  answeredCount: number;
  correctCount: number;
  allAnswered: boolean;
  total: number;
  onAnswer: (q: PlayQuestion, answer: unknown) => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  function jumpTo(questionId: number) {
    document.getElementById(`play-q-${questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="play-older">
      <aside className="play-older-nav">
        <button className="secondary play-older-exit" onClick={onExit}>← ออก</button>
        <div className="play-older-progress">
          <div>
            <div className="play-older-progress-label">ตอบแล้ว</div>
            <div className="play-older-progress-count">{answeredCount}/{total}</div>
          </div>
          <div>
            <div className="play-older-progress-label">ถูก</div>
            <div className="play-older-progress-count good">{correctCount}</div>
          </div>
        </div>
        <div className="nav-grid">
          {exercise.questions.map((qq, i) => {
            const a = answers[qq.id];
            const status = a ? (a.isCorrect ? 'correct' : 'wrong') : '';
            return (
              <button
                key={qq.id}
                className={`question-grid-btn ${status}`}
                aria-label={`ข้อ ${i + 1}${a ? (a.isCorrect ? ' ถูก' : ' ผิด') : ''}`}
                onClick={() => jumpTo(qq.id)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        {allAnswered && (
          <button className="success" style={{ width: '100%', marginTop: 12 }} onClick={onFinish}>
            ดูคะแนน 🏁
          </button>
        )}
      </aside>

      <main className="play-older-main">
        <div className="play-session-header">
          <button className="secondary" onClick={onExit}>← ออก</button>
          <div className="grow">
            <h2 className="play-older-title">{exercise.title}</h2>
            <ProgressLine answeredCount={answeredCount} total={total} />
          </div>
          <b>{answeredCount}/{total}</b>
        </div>
        {exercise.questions.map((q, i) => {
          const result = answers[q.id] ?? null;
          return (
            <div className={`card question-card ${result ? (result.isCorrect ? 'is-correct' : 'is-wrong') : ''}`} key={q.id} id={`play-q-${q.id}`}>
              <div className="row" style={{ marginBottom: 8 }}>
                <span className="badge draft">ข้อ {i + 1}</span>
                {result && <span className={`badge ${result.isCorrect ? 'correct' : 'wrong'}`}>{result.isCorrect ? 'ถูก' : 'ผิด'}</span>}
              </div>
              <div className="question-prompt" style={{ textAlign: 'left', margin: '4px 0 10px' }}><RichText text={q.prompt} /></div>
              <QuestionBody exercise={exercise} q={q} result={result} onAnswer={(a) => onAnswer(q, a)} aiFeedbackAvailable={exercise.aiFeedbackAvailable} />
              {result && <Feedback result={result} />}
            </div>
          );
        })}
        {allAnswered && (
          <button className="success" onClick={onFinish} style={{ width: '100%' }}>
            ตอบครบแล้ว ดูคะแนน 🏁
          </button>
        )}
      </main>
    </div>
  );
}

function SimplePlayer({
  exercise,
  index,
  setIndex,
  answers,
  answeredCount,
  allAnswered,
  total,
  onAnswer,
  onNavigate,
  onFinish,
  onExit,
}: {
  exercise: ExerciseData;
  index: number;
  setIndex: (i: number) => void;
  answers: Record<number, AnswerResult>;
  answeredCount: number;
  allAnswered: boolean;
  total: number;
  onAnswer: (q: PlayQuestion, answer: unknown) => void;
  onNavigate: () => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  const q = exercise.questions[index];
  const result = answers[q.id] ?? null;

  function jumpTo(i: number) {
    setIndex(i);
    onNavigate();
  }

  function goNext() {
    if (index + 1 < total) {
      jumpTo(index + 1);
      return;
    }
    if (allAnswered) {
      onFinish();
      return;
    }
    const firstUnanswered = exercise.questions.findIndex((qq) => !answers[qq.id]);
    jumpTo(firstUnanswered >= 0 ? firstUnanswered : 0);
  }

  return (
    <div className="play-simple">
      <div className="play-simple-left">
        <button className="secondary" onClick={onExit}>←</button>
        <div className="progress-vertical" aria-label={`ความคืบหน้า ${answeredCount} จาก ${total}`}>
          <div className="progress-vertical-fill" style={{ ['--pv']: `${(answeredCount / total) * 100}%` } as CSSProperties} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{answeredCount}/{total}</div>
      </div>

      <div className="play-simple-main">
        <div className="play-session-header compact">
          <div className="grow">
            <b>{exercise.title}</b>
            <ProgressLine answeredCount={answeredCount} total={total} />
          </div>
          <span>ข้อ {index + 1}/{total}</span>
        </div>

        <div className="question-grid">
          {exercise.questions.map((qq, i) => {
            const a = answers[qq.id];
            const status = a ? (a.isCorrect ? 'correct' : 'wrong') : '';
            return (
              <button
                key={qq.id}
                className={`question-grid-btn ${status} ${i === index ? 'current' : ''}`}
                onClick={() => jumpTo(i)}
                aria-label={`ข้อ ${i + 1}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <QuestionBody exercise={exercise} q={q} result={result} onAnswer={(a) => onAnswer(q, a)} aiFeedbackAvailable={exercise.aiFeedbackAvailable} />
        <div className="question-prompt"><RichText text={q.prompt} /></div>
      </div>

      <div className="play-simple-side">
        {result ? (
          <>
            <Feedback result={result} />
            <button style={{ marginTop: 14, width: '100%' }} onClick={goNext}>
              {index + 1 < total ? 'ข้อต่อไป ▶' : allAnswered ? 'ดูคะแนน 🏁' : 'ไปข้อที่ยังไม่ตอบ ▶'}
            </button>
          </>
        ) : (
          <div className="muted side-hint">เลือกคำตอบ แล้วคำอธิบายจะขึ้นตรงนี้</div>
        )}
        {allAnswered && !result && (
          <button className="success" style={{ width: '100%', marginTop: 12 }} onClick={onFinish}>
            ตอบครบแล้ว ดูคะแนน 🏁
          </button>
        )}
      </div>
    </div>
  );
}
