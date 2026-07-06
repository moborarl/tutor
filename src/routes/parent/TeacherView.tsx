import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { AnswerKey } from '../../lib/AnswerKey';
import { DiagramView } from '../../lib/DiagramView';
import type { ExerciseSetDetail } from '@shared/types';

// Read-only "answer key" view for a parent/teacher: every question with its
// correct answer and explanation, in one clean page rendered from the same
// JSON the kids play. Designed to double as the printable version (Phase 2a
// adds print CSS) — no edit controls, no interactivity.
export default function TeacherView() {
  const { id } = useParams();
  const [set, setSet] = useState<ExerciseSetDetail | null>(null);

  useEffect(() => {
    api.get<ExerciseSetDetail>(`/api/parent/exercise-sets/${id}`).then(setSet);
  }, [id]);

  if (!set) return <div className="muted">กำลังโหลด...</div>;

  return (
    <div className="teacher-view">
      <div className="row no-print" style={{ marginBottom: 14 }}>
        <Link to={`/parent/exercises/${id}`}><button className="secondary">← กลับไปหน้าตรวจ</button></Link>
        <span className="grow" />
        <button onClick={() => window.print()}>🖨️ พิมพ์ / บันทึก PDF</button>
      </div>

      <div className="teacher-head">
        <h1>{set.title || `ชุดที่ ${set.id}`}</h1>
        <div className="muted">
          {set.subjectName ?? 'ไม่ระบุวิชา'} · {set.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'} · {set.questionCount} ข้อ
        </div>
        <div className="muted teacher-sub">ฉบับเฉลยสำหรับผู้ปกครอง/ครู — มีคำตอบและคำอธิบายครบทุกข้อ</div>
      </div>

      {set.questions.map((q, i) => (
        <section className="teacher-q" key={q.id}>
          <div className="teacher-q-head">
            <span className="teacher-q-num">{i + 1}</span>
            <p className="teacher-q-prompt">{q.prompt}</p>
          </div>

          {q.imageId ? (
            <img
              src={`/api/parent/exercise-sets/${id}/images/${q.imageId}`}
              alt="รูปประกอบโจทย์"
              className="question-image"
            />
          ) : (
            <DiagramView diagram={q.diagram} />
          )}

          <AnswerKey q={q} />

          {q.explanation && <div className="explain-box">💡 {q.explanation}</div>}
        </section>
      ))}
    </div>
  );
}
