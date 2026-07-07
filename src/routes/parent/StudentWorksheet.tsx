import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { DiagramView } from '../../lib/DiagramView';
import type { ExerciseSetDetail } from '@shared/types';

// Printable worksheet for students (no answers, just questions).
// Students can write answers on paper when printed.
export default function StudentWorksheet() {
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
        <button onClick={() => window.print()}>🖨️ พิมพ์</button>
      </div>

      <div className="teacher-head">
        <h1>{set.title || `ชุดที่ ${set.id}`}</h1>
        <div className="muted">
          {set.subjectName ?? 'ไม่ระบุวิชา'} · {set.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'} · {set.questionCount} ข้อ
        </div>
        <div className="muted teacher-sub">แบบฝึกหัดสำหรับนักเรียน — เพื่อเขียนคำตอบบนกระดาษ</div>
      </div>

      {set.questions.map((q, i) => (
        <section className="teacher-q student-worksheet-q" key={q.id}>
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

          {/* Show blank space for answer based on question type */}
          {q.questionType === 'multiple_choice' && (
            <div style={{ marginTop: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                {(q.content as Record<string, unknown>)?.options instanceof Array &&
                  ((q.content as Record<string, unknown>).options as string[]).map((opt, idx) => (
                    <div key={idx} style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="radio" disabled style={{ accentColor: 'var(--ink)' }} />
                      <span>{opt}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {q.questionType === 'true_false' && (
            <div style={{ marginTop: 12, marginBottom: 20, display: 'flex', gap: 20 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" disabled />
                ถูก
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" disabled />
                ผิด
              </label>
            </div>
          )}

          {q.questionType === 'fill_blank' && (
            <div style={{ marginTop: 12, marginBottom: 20 }}>
              <div style={{ borderBottom: '2px solid var(--ink)', width: 200, minHeight: 30 }} />
            </div>
          )}

          {q.questionType === 'fraction' && (
            <div style={{ marginTop: 12, marginBottom: 20, textAlign: 'center' }}>
              <div style={{ display: 'inline-block', textAlign: 'center', padding: '0 12px', minWidth: 80 }}>
                <div style={{ borderBottom: '2px solid var(--ink)', minHeight: 40, marginBottom: 6 }} />
                <div style={{ borderBottom: '2px solid var(--ink)', minHeight: 40 }} />
              </div>
            </div>
          )}

          {q.questionType === 'matching' && (
            <div style={{ marginTop: 12, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'start' }}>
                <div>
                  {(q.content as Record<string, unknown>)?.left instanceof Array &&
                    ((q.content as Record<string, unknown>).left as string[]).map((l, idx) => (
                      <div key={idx} style={{ marginBottom: 12, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }}>
                        {l}
                      </div>
                    ))}
                </div>
                <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)' }}>จับคู่</div>
                <div>
                  {(q.content as Record<string, unknown>)?.right instanceof Array &&
                    ((q.content as Record<string, unknown>).right as string[]).map((r, idx) => (
                      <div key={idx} style={{ marginBottom: 12, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }}>
                        {r}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {q.questionType === 'ordering' && (
            <div style={{ marginTop: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>เรียงลำดับด้านล่าง (จากน้อยไปมาก):</div>
                {(q.content as Record<string, unknown>)?.items instanceof Array &&
                  ((q.content as Record<string, unknown>).items as string[]).map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 8,
                        border: '2px dotted var(--border)',
                        borderRadius: 6,
                        minHeight: 32,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {item}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
