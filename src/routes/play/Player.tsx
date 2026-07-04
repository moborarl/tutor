import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { Child, PlayQuestion, AnswerResult } from '@shared/types';
import { QuestionMultipleChoice } from './components/QuestionMultipleChoice';
import { QuestionTrueFalse } from './components/QuestionTrueFalse';
import { QuestionFillBlank } from './components/QuestionFillBlank';
import { QuestionMatching } from './components/QuestionMatching';
import { SafeSvg } from '../../lib/SafeSvg';

interface ExerciseData {
  id: number;
  title: string;
  questions: PlayQuestion[];
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
        const at = await api.post<{ attemptId: number }>('/api/play/attempts', { exerciseSetId: Number(id) });
        setExercise(ex);
        setAttemptId(at.attemptId);
        questionStart.current = Date.now();
      } catch {
        nav('/play');
      }
    })();
  }, [id, nav]);

  if (!exercise || attemptId == null) {
    return <div className="play-root" style={{ justifyContent: 'center' }}>กำลังโหลด...</div>;
  }

  const uiSimple = child?.ageBand === 'young';
  const total = exercise.questions.length;
  const q = exercise.questions[index];
  const result = answers[q.id] ?? null;
  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
  const allAnswered = answeredCount === total;

  function jumpTo(i: number) {
    setIndex(i);
    questionStart.current = Date.now();
  }

  async function submitAnswer(answer: unknown) {
    if (answers[q.id]) return; // already answered, locked
    const res = await api.post<AnswerResult>(`/api/play/attempts/${attemptId}/answers`, {
      questionId: q.id,
      answer,
      timeSpentMs: Date.now() - questionStart.current,
    });
    setAnswers((prev) => ({ ...prev, [q.id]: res }));
  }

  async function finish() {
    const done = await api.post<{ score: number; correct: number; total: number }>(
      `/api/play/attempts/${attemptId}/complete`,
    );
    setFinished(done);
  }

  function goNext() {
    if (index + 1 < total) {
      jumpTo(index + 1);
      return;
    }
    if (allAnswered) {
      finish();
      return;
    }
    const firstUnanswered = exercise!.questions.findIndex((qq) => !answers[qq.id]);
    jumpTo(firstUnanswered >= 0 ? firstUnanswered : 0);
  }

  if (finished) {
    const pctScore = Math.round(finished.score * 100);
    return (
      <div className={`play-root ${uiSimple ? 'ui-simple' : ''}`} style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 90 }}>{pctScore >= 80 ? '🏆' : pctScore >= 50 ? '🎉' : '💪'}</div>
        <h1>{pctScore >= 80 ? 'เก่งมาก!' : pctScore >= 50 ? 'ดีมาก!' : 'สู้ๆ นะ ลองอีกครั้ง!'}</h1>
        <div style={{ fontSize: 26, fontWeight: 700 }}>
          ได้ {finished.correct} จาก {finished.total} ข้อ ({pctScore}%)
        </div>
        <div className="row" style={{ marginTop: 30 }}>
          <button onClick={() => window.location.reload()}>ทำอีกครั้ง</button>
          <button className="secondary" onClick={() => nav('/play/exercises')}>กลับหน้ารายการ</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`play-root ${uiSimple ? 'ui-simple' : ''}`}>
      <div className="row" style={{ width: '100%', maxWidth: 640 }}>
        <button className="secondary" onClick={() => nav('/play/exercises')}>← ออก</button>
        <div className="grow" style={{ margin: '0 10px' }}>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${(answeredCount / total) * 100}%` }} />
          </div>
        </div>
        <span style={{ fontWeight: 700 }}>{answeredCount}/{total}</span>
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
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="muted" style={{ marginBottom: 6 }}>ตอบถูกแล้ว {correctCount} จาก {answeredCount} ข้อที่ตอบ</div>

      {allAnswered && (
        <button className="success" onClick={finish} style={{ marginBottom: 14 }}>
          ✓ ตอบครบแล้ว ดูคะแนน 🏁
        </button>
      )}

      {q.imageId ? (
        <img
          src={`/api/play/exercises/${exercise.id}/images/${q.imageId}`}
          alt="รูปประกอบโจทย์"
          className="question-image"
        />
      ) : q.generatedSvg ? (
        <SafeSvg svg={q.generatedSvg} className="question-image" />
      ) : null}

      <div className="question-prompt">{q.prompt}</div>

      {q.questionType === 'multiple_choice' && (
        <QuestionMultipleChoice key={q.id} q={q} result={result} onAnswer={submitAnswer} />
      )}
      {q.questionType === 'true_false' && (
        <QuestionTrueFalse key={q.id} result={result} onAnswer={submitAnswer} />
      )}
      {q.questionType === 'fill_blank' && (
        <QuestionFillBlank key={q.id} q={q} result={result} onAnswer={submitAnswer} />
      )}
      {q.questionType === 'matching' && (
        <QuestionMatching key={q.id} q={q} result={result} onAnswer={submitAnswer} />
      )}

      {result && (
        <>
          <div className={`feedback-banner ${result.isCorrect ? 'good' : 'bad'}`}>
            {result.isCorrect ? '🎉 ถูกต้อง เก่งมาก!' : '❌ ยังไม่ถูก ดูเฉลยนะ'}
          </div>
          {result.explanation && (
            <div className="card" style={{ marginTop: 10, background: '#f0f4f8' }}>
              💡 {result.explanation}
            </div>
          )}
          <button style={{ marginTop: 18 }} onClick={goNext}>
            {index + 1 < total ? 'ข้อต่อไป ▶' : allAnswered ? 'ดูคะแนน 🏁' : 'ไปข้อที่ยังไม่ตอบ ▶'}
          </button>
        </>
      )}
    </div>
  );
}
