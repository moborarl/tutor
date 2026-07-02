import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { Child, PlayQuestion, AnswerResult } from '@shared/types';
import { QuestionMultipleChoice } from './components/QuestionMultipleChoice';
import { QuestionTrueFalse } from './components/QuestionTrueFalse';
import { QuestionFillBlank } from './components/QuestionFillBlank';
import { QuestionMatching } from './components/QuestionMatching';

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
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
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
  const q = exercise.questions[index];

  async function submitAnswer(answer: unknown) {
    if (result) return; // already answered
    const res = await api.post<AnswerResult>(`/api/play/attempts/${attemptId}/answers`, {
      questionId: q.id,
      answer,
      timeSpentMs: Date.now() - questionStart.current,
    });
    setResult(res);
    if (res.isCorrect) setCorrectCount((n) => n + 1);
  }

  async function next() {
    if (index + 1 < exercise!.questions.length) {
      setIndex(index + 1);
      setResult(null);
      questionStart.current = Date.now();
    } else {
      const done = await api.post<{ score: number; correct: number; total: number }>(
        `/api/play/attempts/${attemptId}/complete`,
      );
      setFinished(done);
    }
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
            <div className="progress-bar-fill" style={{ width: `${(index / exercise.questions.length) * 100}%` }} />
          </div>
        </div>
        <span style={{ fontWeight: 700 }}>{index + 1}/{exercise.questions.length}</span>
      </div>

      <div className="question-prompt">{q.prompt}</div>

      {q.questionType === 'multiple_choice' && (
        <QuestionMultipleChoice q={q} result={result} onAnswer={submitAnswer} />
      )}
      {q.questionType === 'true_false' && (
        <QuestionTrueFalse result={result} onAnswer={submitAnswer} />
      )}
      {q.questionType === 'fill_blank' && (
        <QuestionFillBlank q={q} result={result} onAnswer={submitAnswer} />
      )}
      {q.questionType === 'matching' && (
        <QuestionMatching q={q} result={result} onAnswer={submitAnswer} />
      )}

      {result && (
        <>
          <div className={`feedback-banner ${result.isCorrect ? 'good' : 'bad'}`}>
            {result.isCorrect ? '🎉 ถูกต้อง เก่งมาก!' : '❌ ยังไม่ถูก ดูเฉลยนะ'}
          </div>
          <button style={{ marginTop: 18 }} onClick={next}>
            {index + 1 < exercise.questions.length ? 'ข้อต่อไป ▶' : 'ดูคะแนน 🏁'}
          </button>
        </>
      )}

      <div className="muted" style={{ marginTop: 'auto', paddingTop: 20 }}>
        ตอบถูกแล้ว {correctCount} ข้อ
      </div>
    </div>
  );
}
