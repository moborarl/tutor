import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api-client';
import { DiagramView } from '../../lib/DiagramView';
import { validateDiagram } from '@shared/diagram';
import { ImageCropTool } from './ImageCropTool';
import type {
  Child,
  ExerciseSetDetail,
  QuestionWithAnswer,
  QuestionType,
} from '@shared/types';

const STATUS_TH: Record<string, string> = {
  processing: 'รอคิว Raspberry Pi (โควตา AI cloud หมด)',
  extracting: 'AI กำลังแกะโจทย์...',
  pending_review: 'รอตรวจและอนุมัติ',
  extraction_failed: 'แกะโจทย์ไม่สำเร็จ',
  published: 'เผยแพร่แล้ว',
};

const PROVIDER_TH: Record<string, string> = {
  claude: 'Claude (แม่นยำสูง)',
  other_cloud: 'Cloud AI สำรอง',
  pi: 'Raspberry Pi (ควรตรวจละเอียดเป็นพิเศษ)',
};

const TYPE_TH: Record<QuestionType, string> = {
  multiple_choice: 'ปรนัย (เลือกตอบ)',
  true_false: 'ถูก/ผิด',
  fill_blank: 'เติมคำ',
  matching: 'จับคู่',
};

export default function ReviewExercise() {
  const { id } = useParams();
  const nav = useNavigate();
  const [set, setSet] = useState<ExerciseSetDetail | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [assignIds, setAssignIds] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState('');
  const [showImage, setShowImage] = useState(false);

  const load = useCallback(() => {
    api.get<ExerciseSetDetail>(`/api/parent/exercise-sets/${id}`).then((data) => {
      setSet(data);
      setAssignIds(new Set(data.assignedChildIds));
    });
  }, [id]);

  useEffect(() => {
    load();
    api.get<Child[]>('/api/parent/children').then(setChildren);
  }, [load]);

  // Poll while queued for the Pi / extracting.
  useEffect(() => {
    if (!set || (set.status !== 'processing' && set.status !== 'extracting')) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [set, load]);

  if (!set) return <div className="muted">กำลังโหลด...</div>;

  const allApproved = set.questions.length > 0 && set.questions.every((q) => q.status === 'approved');

  async function approveAll() {
    await Promise.all(
      set!.questions.filter((q) => q.status !== 'approved').map((q) => api.post(`/api/parent/questions/${q.id}/approve`)),
    );
    load();
  }

  async function publish() {
    setMsg('');
    try {
      await api.post(`/api/parent/exercise-sets/${id}/publish`);
      load();
    } catch (err) {
      setMsg(err instanceof ApiError && err.code === 'all_questions_must_be_approved'
        ? 'ต้องอนุมัติทุกข้อก่อนเผยแพร่'
        : 'เผยแพร่ไม่สำเร็จ');
    }
  }

  async function saveAssignments() {
    await api.post(`/api/parent/exercise-sets/${id}/assign`, { childIds: [...assignIds] });
    setMsg('บันทึกการมอบหมายแล้ว');
    load();
  }

  async function retry() {
    setMsg('');
    await api.post(`/api/parent/exercise-sets/${id}/retry-extraction`);
    load();
  }

  async function addManualQuestion() {
    await api.post('/api/parent/questions', {
      exerciseSetId: Number(id),
      questionType: 'multiple_choice',
      prompt: 'โจทย์ใหม่ (แก้ไขได้)',
      content: { options: ['ตัวเลือก 1', 'ตัวเลือก 2', 'ตัวเลือก 3'] },
      answer: { correctIndex: 0 },
    });
    load();
  }

  return (
    <div>
      {set.extractionError && set.status !== 'pending_review' && set.status !== 'published' && (
        <div className="card" style={{ background: 'var(--red-soft)' }}>
          <div className="error-text">{set.extractionError}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button onClick={retry}>ลองแกะใหม่</button>
            <button className="secondary" onClick={addManualQuestion}>สร้างโจทย์เอง</button>
          </div>
        </div>
      )}

      {(set.status === 'processing' || set.status === 'extracting') && (
        <div className="card muted">
          ⏳ {STATUS_TH[set.status]} — หน้านี้จะรีเฟรชอัตโนมัติ
        </div>
      )}

      {/* Compact sticky header: title+status stay pinned while scrolling through
          many questions, but stay small so they don't eat into the visible area. */}
      <div className="sticky-toolbar" style={{ marginBottom: 14 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <b className="grow" style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {set.title || `ชุดที่ ${set.id}`}
          </b>
          <span className="muted" style={{ fontSize: 12 }}>
            {set.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'}
            {set.extractionProvider && ` · ${PROVIDER_TH[set.extractionProvider]}`}
          </span>
          <span className={`badge ${set.status}`}>{STATUS_TH[set.status] ?? set.status}</span>
        </div>
        <div className="row">
          <button className="secondary" onClick={() => setShowImage((v) => !v)}>
            {showImage ? 'ซ่อนรูปต้นฉบับ' : 'ดูรูปต้นฉบับ'}
          </button>
          {set.questions.length > 0 && set.status === 'pending_review' && (
            <>
              <button className="secondary" onClick={approveAll}>อนุมัติทุกข้อ</button>
              <button className="success" onClick={publish} disabled={!allApproved}>เผยแพร่</button>
            </>
          )}
          {set.status === 'pending_review' && (
            <button className="secondary" onClick={addManualQuestion}>+ เพิ่มโจทย์เอง</button>
          )}
        </div>
      </div>
      {msg && <div className="muted" style={{ marginBottom: 10 }}>{msg}</div>}

      {showImage && (
        <div className="card">
          {set.images.map((img) => (
            <img
              key={img.id}
              src={`/api/parent/exercise-sets/${id}/images/${img.id}`}
              alt={`หน้า ${img.orderIndex + 1}`}
              style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 12, display: 'block' }}
            />
          ))}
        </div>
      )}

      {set.questions.map((q, i) => (
        <QuestionEditor key={q.id} q={q} index={i} images={set!.images} setId={set!.id} onChanged={load} />
      ))}

      {(set.status === 'published' || set.status === 'pending_review') && (
        <div className="card">
          <h3>มอบหมายให้ลูก</h3>
          {children.length === 0 && (
            <div className="muted">ยังไม่มีโปรไฟล์ลูก — <a href="#" onClick={(e) => { e.preventDefault(); nav('/parent/children'); }}>เพิ่มลูกก่อน</a></div>
          )}
          <div className="row">
            {children.map((ch) => (
              <button
                key={ch.id}
                className="secondary"
                style={{ outline: assignIds.has(ch.id) ? '3px solid var(--green)' : 'none' }}
                onClick={() => {
                  const next = new Set(assignIds);
                  if (next.has(ch.id)) next.delete(ch.id); else next.add(ch.id);
                  setAssignIds(next);
                }}
              >
                {ch.avatar} {ch.name}
              </button>
            ))}
            {children.length > 0 && <button onClick={saveAssignments}>บันทึกการมอบหมาย</button>}
          </div>
          {set.status !== 'published' && (
            <div className="muted" style={{ marginTop: 8 }}>เด็กจะเห็นแบบฝึกหัดนี้หลังกด "เผยแพร่" แล้วเท่านั้น</div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  q,
  index,
  images,
  setId,
  onChanged,
}: {
  q: QuestionWithAnswer;
  index: number;
  images: { id: number; orderIndex: number }[];
  setId: number;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(q.prompt);
  const [contentText, setContentText] = useState(JSON.stringify(q.content, null, 2));
  const [answerText, setAnswerText] = useState(JSON.stringify(q.answer, null, 2));
  const [explanation, setExplanation] = useState(q.explanation ?? '');
  const [imageId, setImageId] = useState<number | null>(q.imageId);
  const [diagramText, setDiagramText] = useState(q.diagram ? JSON.stringify(q.diagram, null, 2) : '');
  const [cropping, setCropping] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    let content: unknown, answer: unknown, diagram: unknown = null;
    try {
      content = JSON.parse(contentText);
      answer = JSON.parse(answerText);
      if (diagramText.trim()) diagram = JSON.parse(diagramText);
    } catch {
      setErr('รูปแบบ JSON ไม่ถูกต้อง');
      return;
    }
    try {
      await api.patch(`/api/parent/questions/${q.id}`, { prompt, content, answer, explanation, imageId, diagram });
      setEditing(false);
      onChanged();
    } catch {
      setErr('บันทึกไม่สำเร็จ — ตรวจรูปแบบ diagram JSON อีกครั้ง');
    }
  }

  async function approve() {
    await api.post(`/api/parent/questions/${q.id}/approve`);
    onChanged();
  }

  async function remove() {
    await api.delete(`/api/parent/questions/${q.id}`);
    onChanged();
  }

  return (
    <div className="card">
      <div className="row">
        <b>ข้อ {index + 1}</b>
        <span className="badge draft">{TYPE_TH[q.questionType]}</span>
        <span className={`badge ${q.status}`}>{q.status === 'approved' ? 'อนุมัติแล้ว' : 'ร่าง'}</span>
        <span className="grow" />
        {!editing && (
          <>
            {q.status !== 'approved' && <button className="secondary" onClick={approve}>✓ อนุมัติ</button>}
            <button className="secondary" onClick={() => setEditing(true)}>แก้ไข</button>
            <button className="danger" onClick={remove}>ลบ</button>
          </>
        )}
      </div>

      {!editing ? (
        <div style={{ marginTop: 10 }}>
          {q.imageId ? (
            <img
              src={`/api/parent/exercise-sets/${setId}/images/${q.imageId}`}
              alt="รูปประกอบโจทย์"
              style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, marginBottom: 8, display: 'block' }}
            />
          ) : q.diagram ? (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                🤖 แผนภาพจาก AI
              </div>
              <DiagramView diagram={q.diagram} />
            </div>
          ) : null}
          <div style={{ fontWeight: 600 }}>{q.prompt}</div>
          <QuestionPreview q={q} />
          {q.explanation && (
            <div className="muted" style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 6 }}>
              💡 คำอธิบาย: {q.explanation}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <label className="muted">โจทย์</label>
          <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <label className="muted">เนื้อหา (content JSON)</label>
          <textarea rows={4} value={contentText} onChange={(e) => setContentText(e.target.value)} style={{ fontFamily: 'monospace' }} />
          <label className="muted">เฉลย (answer JSON)</label>
          <textarea rows={3} value={answerText} onChange={(e) => setAnswerText(e.target.value)} style={{ fontFamily: 'monospace' }} />
          <label className="muted">คำอธิบายเฉลย (แสดงให้เด็กเห็นหลังตอบ)</label>
          <textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          <label className="muted">แผนภาพ (diagram JSON — เว้นว่างถ้าไม่มี)</label>
          <textarea
            rows={3}
            value={diagramText}
            onChange={(e) => setDiagramText(e.target.value)}
            style={{ fontFamily: 'monospace' }}
            placeholder='{"type":"force-arrows","items":[...]}'
          />
          {diagramText.trim() && !imageId && (
            (() => {
              let parsed: unknown;
              try {
                parsed = JSON.parse(diagramText);
              } catch {
                return <div className="error-text">แผนภาพ JSON ไม่ถูกต้อง</div>;
              }
              const valid = validateDiagram(parsed);
              return valid ? <DiagramView diagram={valid} /> : <div className="error-text">รูปแบบ diagram ไม่ตรงกับที่ระบบรองรับ</div>;
            })()
          )}
          {images.length > 0 && (
            <>
              <label className="muted">รูปประกอบโจทย์ (ถ้าต้องดูแผนภาพถึงจะตอบได้)</label>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={imageId === null ? '' : 'secondary'}
                  onClick={() => setImageId(null)}
                >
                  ไม่มีรูป
                </button>
                {images.map((img) => (
                  <img
                    key={img.id}
                    src={`/api/parent/exercise-sets/${setId}/images/${img.id}`}
                    alt={`หน้า ${img.orderIndex + 1}`}
                    onClick={() => setImageId(img.id)}
                    style={{
                      width: 70,
                      height: 70,
                      objectFit: 'cover',
                      borderRadius: 8,
                      cursor: 'pointer',
                      outline: imageId === img.id ? '3px solid var(--accent)' : '2px solid #e8e1d5',
                    }}
                  />
                ))}
                <button type="button" className="secondary" onClick={() => setCropping(true)}>
                  ✂️ ตัดรูปจากต้นฉบับ
                </button>
              </div>
              {cropping && (
                <ImageCropTool
                  setId={setId}
                  images={images}
                  onCropped={(newImageId) => {
                    setImageId(newImageId);
                    setCropping(false);
                  }}
                  onClose={() => setCropping(false)}
                />
              )}
            </>
          )}
          {err && <div className="error-text">{err}</div>}
          <div className="row">
            <button onClick={save}>บันทึก</button>
            <button className="secondary" onClick={() => setEditing(false)}>ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionPreview({ q }: { q: QuestionWithAnswer }) {
  const content = q.content as Record<string, unknown>;
  const answer = q.answer as Record<string, unknown>;

  if (q.questionType === 'multiple_choice' && Array.isArray(content.options)) {
    return (
      <ul style={{ margin: '8px 0' }}>
        {(content.options as string[]).map((opt, i) => (
          <li key={i} style={{ fontWeight: i === answer.correctIndex ? 700 : 400, color: i === answer.correctIndex ? 'var(--green)' : 'inherit' }}>
            {opt} {i === answer.correctIndex && '✓'}
          </li>
        ))}
      </ul>
    );
  }
  if (q.questionType === 'true_false') {
    return <div className="muted" style={{ marginTop: 6 }}>เฉลย: {answer.value ? 'ถูก ✓' : 'ผิด ✗'}</div>;
  }
  if (q.questionType === 'fill_blank' && Array.isArray(answer.answers)) {
    return <div className="muted" style={{ marginTop: 6 }}>เฉลย: {(answer.answers as string[]).join(' / ')}</div>;
  }
  if (q.questionType === 'matching' && Array.isArray(content.left) && Array.isArray(content.right) && Array.isArray(answer.pairs)) {
    return (
      <ul style={{ margin: '8px 0' }}>
        {(content.left as string[]).map((l, i) => (
          <li key={i}>
            {l} ↔ {(content.right as string[])[(answer.pairs as number[])[i]] ?? '?'}
          </li>
        ))}
      </ul>
    );
  }
  return null;
}
