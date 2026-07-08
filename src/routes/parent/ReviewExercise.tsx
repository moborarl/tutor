import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertDialog, Badge as RadixBadge, Button, Callout, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api-client';
import { DiagramView } from '../../lib/DiagramView';
import { AnswerKey } from '../../lib/AnswerKey';
import { RichText } from '../../lib/RichText';
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
  fraction: 'เศษส่วน',
  ordering: 'เรียงลำดับ',
};

function statusColor(status: string) {
  if (status === 'approved' || status === 'published') return 'green';
  if (status === 'pending_review') return 'amber';
  if (status === 'processing' || status === 'extracting') return 'blue';
  if (status === 'extraction_failed') return 'red';
  return 'gray';
}

function ConfirmButton({
  children,
  title,
  description,
  confirmLabel,
  color = 'gray',
  disabled,
  onConfirm,
}: {
  children: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  color?: 'gray' | 'red' | 'orange' | 'green';
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button variant="soft" color={color} disabled={disabled}>
          {children}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{description}</AlertDialog.Description>
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">ยกเลิก</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button color={color} onClick={onConfirm}>{confirmLabel}</Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

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

  async function unapproveAll() {
    const targets = set!.questions.filter((q) => q.status === 'approved');
    if (targets.length === 0) return;
    await Promise.all(targets.map((q) => api.post(`/api/parent/questions/${q.id}/unapprove`)));
    load();
  }

  async function detachAllVisuals() {
    const targets = set!.questions.filter((q) => q.imageId || q.diagram);
    if (targets.length === 0) return;
    await Promise.all(targets.map((q) => api.patch(`/api/parent/questions/${q.id}`, { imageId: null, diagram: null })));
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
    <div className="review-root">
      {set.extractionError && set.status !== 'pending_review' && set.status !== 'published' && (
        <Callout.Root color="red" className="review-alert">
          <Callout.Text>
            <div className="error-text">{set.extractionError}</div>
            <Flex gap="2" mt="3" wrap="wrap">
              <Button onClick={retry}>ลองแกะใหม่</Button>
              <Button variant="soft" color="gray" onClick={addManualQuestion}>สร้างโจทย์เอง</Button>
            </Flex>
          </Callout.Text>
        </Callout.Root>
      )}

      {(set.status === 'processing' || set.status === 'extracting') && (
        <Callout.Root color="blue" className="review-alert">
          <Callout.Text>{STATUS_TH[set.status]} — หน้านี้จะรีเฟรชอัตโนมัติ</Callout.Text>
        </Callout.Root>
      )}

      {/* Compact sticky header: title+status stay pinned while scrolling through
          many questions, but stay small so they don't eat into the visible area. */}
      <div className="sticky-toolbar review-toolbar">
        <div className="review-toolbar-main">
          <div className="review-title-block">
            <Heading as="h2" size="4">{set.title || `ชุดที่ ${set.id}`}</Heading>
            <Text as="span" size="2" color="gray">
              {set.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'}
              {set.extractionProvider && ` · ${PROVIDER_TH[set.extractionProvider]}`}
            </Text>
          </div>
          <RadixBadge color={statusColor(set.status)} variant="soft">{STATUS_TH[set.status] ?? set.status}</RadixBadge>
        </div>
        <div className="toolbar-actions">
          <Button variant="soft" color="gray" onClick={() => setShowImage((v) => !v)}>
            {showImage ? 'ซ่อนรูปต้นฉบับ' : 'ดูรูปต้นฉบับ'}
          </Button>
          {set.questions.length > 0 && (
            <>
              <Button variant="soft" color="gray" onClick={() => nav(`/parent/exercises/${id}/teacher`)}>
                ฉบับเฉลย
              </Button>
              <Button variant="soft" color="gray" onClick={() => nav(`/parent/exercises/${id}/student`)}>
                แบบฝึกหัดสำหรับเด็ก
              </Button>
            </>
          )}
          {set.questions.length > 0 && set.status === 'pending_review' && (
            <>
              <Button variant="soft" color="green" onClick={approveAll}>อนุมัติทุกข้อ</Button>
              <ConfirmButton
                title="ยกเลิกอนุมัติทุกข้อ?"
                description={`ข้อที่อนุมัติแล้ว ${set.questions.filter((q) => q.status === 'approved').length} ข้อจะกลับเป็นร่าง และต้องอนุมัติใหม่ก่อนเผยแพร่`}
                confirmLabel="ยกเลิกอนุมัติ"
                onConfirm={unapproveAll}
                disabled={set.questions.every((q) => q.status !== 'approved')}
              >
                ยกเลิกอนุมัติทุกข้อ
              </ConfirmButton>
              <ConfirmButton
                title="ถอดรูป/แผนภาพทุกข้อ?"
                description={`ข้อที่มีรูปหรือแผนภาพ ${set.questions.filter((q) => q.imageId || q.diagram).length} ข้อจะกลับเป็นร่างเพื่อตรวจใหม่`}
                confirmLabel="ถอดออก"
                color="orange"
                onConfirm={detachAllVisuals}
                disabled={set.questions.every((q) => !q.imageId && !q.diagram)}
              >
                ถอดรูป/แผนภาพทุกข้อ
              </ConfirmButton>
              <Button color="green" onClick={publish} disabled={!allApproved}>เผยแพร่</Button>
            </>
          )}
          {set.status === 'pending_review' && (
            <Button variant="soft" color="gray" onClick={addManualQuestion}>เพิ่มโจทย์เอง</Button>
          )}
        </div>
      </div>
      {msg && <div className="muted" style={{ marginBottom: 10 }}>{msg}</div>}

      {showImage && (
        <Card className="source-image-panel">
          {set.images.map((img) => (
            <img
              key={img.id}
              src={`/api/parent/exercise-sets/${id}/images/${img.id}`}
              alt={`หน้า ${img.orderIndex + 1}`}
              style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 12, display: 'block' }}
            />
          ))}
        </Card>
      )}

      {set.questions.map((q, i) => (
        <QuestionEditor key={q.id} q={q} index={i} images={set!.images} setId={set!.id} onChanged={load} />
      ))}

      {(set.status === 'published' || set.status === 'pending_review') && (
        <Card className="assignment-card">
          <Heading as="h3" size="4">มอบหมายให้ลูก</Heading>
          {children.length === 0 && (
            <div className="muted">ยังไม่มีโปรไฟล์ลูก — <a href="#" onClick={(e) => { e.preventDefault(); nav('/parent/children'); }}>เพิ่มลูกก่อน</a></div>
          )}
          <div className="row">
            {children.map((ch) => (
              <Button
                key={ch.id}
                variant={assignIds.has(ch.id) ? 'solid' : 'soft'}
                color={assignIds.has(ch.id) ? 'green' : 'gray'}
                className={`child-toggle ${assignIds.has(ch.id) ? 'selected' : ''}`}
                style={{ outline: assignIds.has(ch.id) ? '3px solid var(--green)' : 'none' }}
                onClick={() => {
                  const next = new Set(assignIds);
                  if (next.has(ch.id)) next.delete(ch.id); else next.add(ch.id);
                  setAssignIds(next);
                }}
              >
                {ch.avatar} {ch.name}
              </Button>
            ))}
            {children.length > 0 && <Button onClick={saveAssignments}>บันทึกการมอบหมาย</Button>}
          </div>
          {set.status !== 'published' && (
            <div className="muted" style={{ marginTop: 8 }}>เด็กจะเห็นแบบฝึกหัดนี้หลังกด "เผยแพร่" แล้วเท่านั้น</div>
          )}
        </Card>
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

  async function unapprove() {
    await api.post(`/api/parent/questions/${q.id}/unapprove`);
    onChanged();
  }

  async function detachImage() {
    await api.patch(`/api/parent/questions/${q.id}`, { imageId: null, diagram: null });
    onChanged();
  }

  async function remove() {
    await api.delete(`/api/parent/questions/${q.id}`);
    onChanged();
  }

  return (
    <Card className="review-question-card">
      <div className="question-header">
        <b className="question-number">ข้อ {index + 1}</b>
        <RadixBadge color="gray" variant="soft">{TYPE_TH[q.questionType]}</RadixBadge>
        <RadixBadge color={statusColor(q.status)} variant="soft">{q.status === 'approved' ? 'อนุมัติแล้ว' : 'ร่าง'}</RadixBadge>
        <span className="grow" />
        {!editing && (
          <div className="question-actions">
            {q.status !== 'approved' && <Button variant="soft" color="green" onClick={approve}>อนุมัติ</Button>}
            {q.status === 'approved' && (
              <ConfirmButton
                title="ยกเลิกอนุมัติข้อนี้?"
                description="ข้อนี้จะกลับเป็นร่างและต้องอนุมัติใหม่ก่อนเผยแพร่"
                confirmLabel="ยกเลิกอนุมัติ"
                onConfirm={unapprove}
              >
                ยกเลิกอนุมัติ
              </ConfirmButton>
            )}
            {(q.imageId || q.diagram) && (
              <ConfirmButton
                title="ถอดรูป/แผนภาพออก?"
                description="ข้อนี้จะกลับเป็นร่างและต้องตรวจใหม่"
                confirmLabel="ถอดออก"
                color="orange"
                onConfirm={detachImage}
              >
                ถอดรูป/แผนภาพออก
              </ConfirmButton>
            )}
            <Button variant="soft" color="gray" onClick={() => setEditing(true)}>แก้ไข</Button>
            <ConfirmButton
              title="ลบข้อนี้ถาวร?"
              description="เมื่อลบแล้วจะกู้คืนจากหน้านี้ไม่ได้"
              confirmLabel="ลบ"
              color="red"
              onConfirm={remove}
            >
              ลบ
            </ConfirmButton>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="question-body">
          {q.imageId ? (
            <img
              className="question-visual"
              src={`/api/parent/exercise-sets/${setId}/images/${q.imageId}`}
              alt="รูปประกอบโจทย์"
            />
          ) : q.diagram ? (
            <div className="diagram-preview">
              <div className="ai-diagram-pill">แผนภาพจาก AI</div>
              <DiagramView diagram={q.diagram} />
            </div>
          ) : null}
          <div className="question-prompt-review"><RichText text={q.prompt} /></div>
          <AnswerKey q={q} />
          {q.explanation && (
            <div className="explain-box muted">
              💡 คำอธิบาย: {q.explanation}
            </div>
          )}
        </div>
      ) : (
        <div className="question-editor-panel">
          <label className="muted">โจทย์</label>
          <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <label className="muted">เนื้อหา (content JSON)</label>
          <textarea rows={4} value={contentText} onChange={(e) => setContentText(e.target.value)} style={{ fontFamily: 'monospace' }} />
          <label className="muted">เฉลย (answer JSON)</label>
          <textarea rows={3} value={answerText} onChange={(e) => setAnswerText(e.target.value)} style={{ fontFamily: 'monospace' }} />
          <StructuredQuestionEditor
            questionType={q.questionType}
            contentText={contentText}
            answerText={answerText}
            setContentText={setContentText}
            setAnswerText={setAnswerText}
          />
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
    </Card>
  );
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function setJson(setter: (value: string) => void, value: unknown) {
  setter(JSON.stringify(value, null, 2));
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v ?? '')) : [];
}

function numberList(value: unknown): number[] {
  return Array.isArray(value) ? value.map(Number).filter(Number.isInteger) : [];
}

function StructuredQuestionEditor({
  questionType,
  contentText,
  answerText,
  setContentText,
  setAnswerText,
}: {
  questionType: QuestionType;
  contentText: string;
  answerText: string;
  setContentText: (value: string) => void;
  setAnswerText: (value: string) => void;
}) {
  const content = parseObject(contentText);
  const answer = parseObject(answerText);
  if (!content || !answer) {
    return <div className="muted">ตัวช่วยแก้ไขจะแสดงเมื่อ content/answer เป็น JSON object ที่ถูกต้อง</div>;
  }

  const updateContent = (next: Record<string, unknown>) => setJson(setContentText, next);
  const updateAnswer = (next: Record<string, unknown>) => setJson(setAnswerText, next);
  const fieldStyle: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };

  if (questionType === 'multiple_choice') {
    const options = stringList(content.options);
    const correctIndex = typeof answer.correctIndex === 'number' ? answer.correctIndex : 0;
    return (
      <div className="structured-editor-panel">
        <b>ตัวช่วยแก้ปรนัย</b>
        {options.map((opt, i) => (
          <div key={i} style={fieldStyle}>
            <input
              type="radio"
              checked={correctIndex === i}
              onChange={() => updateAnswer({ ...answer, correctIndex: i })}
            />
            <input
              value={opt}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value;
                updateContent({ ...content, options: next });
              }}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const next = options.filter((_, idx) => idx !== i);
                updateContent({ ...content, options: next });
                updateAnswer({ ...answer, correctIndex: Math.min(correctIndex, Math.max(0, next.length - 1)) });
              }}
              disabled={options.length <= 2}
            >
              ลบ
            </button>
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => updateContent({ ...content, options: [...options, 'ตัวเลือกใหม่'] })}>
          + เพิ่มตัวเลือก
        </button>
      </div>
    );
  }

  if (questionType === 'true_false') {
    return (
      <div className="structured-editor-panel">
        <b>ตัวช่วยแก้ถูก/ผิด</b>
        <select value={answer.value === false ? 'false' : 'true'} onChange={(e) => updateAnswer({ ...answer, value: e.target.value === 'true' })}>
          <option value="true">ถูก</option>
          <option value="false">ผิด</option>
        </select>
      </div>
    );
  }

  if (questionType === 'fill_blank') {
    const answers = stringList(answer.answers);
    return (
      <div className="structured-editor-panel">
        <b>ตัวช่วยแก้เติมคำ</b>
        {answers.map((ans, i) => (
          <div key={i} style={fieldStyle}>
            <input
              value={ans}
              onChange={(e) => {
                const next = [...answers];
                next[i] = e.target.value;
                updateAnswer({ ...answer, answers: next });
              }}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button type="button" className="secondary" onClick={() => updateAnswer({ ...answer, answers: answers.filter((_, idx) => idx !== i) })}>
              ลบ
            </button>
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => updateAnswer({ ...answer, answers: [...answers, 'คำตอบใหม่'] })}>
          + เพิ่มคำตอบที่ยอมรับ
        </button>
      </div>
    );
  }

  if (questionType === 'fraction') {
    const numerator = typeof answer.numerator === 'number' ? answer.numerator : 0;
    const denominator = typeof answer.denominator === 'number' ? answer.denominator : 1;
    return (
      <div className="structured-editor-panel">
        <b>ตัวช่วยแก้เศษส่วน</b>
        <div style={fieldStyle}>
          <input type="number" value={numerator} onChange={(e) => updateAnswer({ ...answer, numerator: Number(e.target.value) })} />
          <span>/</span>
          <input type="number" value={denominator} onChange={(e) => updateAnswer({ ...answer, denominator: Number(e.target.value) })} />
        </div>
      </div>
    );
  }

  if (questionType === 'ordering') {
    const items = stringList(content.items);
    const indices = numberList(answer.indices);
    const normalized = indices.length === items.length ? indices : items.map((_, i) => i);
    return (
      <div className="structured-editor-panel">
        <b>ตัวช่วยแก้เรียงลำดับ</b>
        <div className="muted">รายการที่เด็กเห็น</div>
        {items.map((item, i) => (
          <div key={i} style={fieldStyle}>
            <input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                updateContent({ ...content, items: next });
                updateAnswer({ ...answer, indices: normalized.slice(0, next.length) });
              }}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const next = items.filter((_, idx) => idx !== i);
                updateContent({ ...content, items: next });
                updateAnswer({ ...answer, indices: next.map((_, idx) => idx) });
              }}
              disabled={items.length <= 2}
            >
              ลบ
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const next = [...items, 'รายการใหม่'];
            updateContent({ ...content, items: next });
            updateAnswer({ ...answer, indices: next.map((_, i) => i) });
          }}
        >
          + เพิ่มรายการ
        </button>
        <div className="muted" style={{ marginTop: 10 }}>ลำดับคำตอบที่ถูกต้อง</div>
        {items.map((_, pos) => (
          <div key={pos} style={fieldStyle}>
            <span>ลำดับ {pos + 1}</span>
            <select
              value={normalized[pos] ?? ''}
              onChange={(e) => {
                const next = [...normalized];
                next[pos] = Number(e.target.value);
                updateAnswer({ ...answer, indices: next });
              }}
            >
              {items.map((item, i) => (
                <option key={i} value={i}>{i}: {item}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  if (questionType === 'matching') {
    const left = stringList(content.left);
    const right = stringList(content.right);
    const pairs = numberList(answer.pairs);
    return (
      <div className="structured-editor-panel">
        <b>ตัวช่วยแก้จับคู่</b>
        {left.map((leftItem, i) => (
          <div key={i} style={fieldStyle}>
            <input
              value={leftItem}
              onChange={(e) => {
                const next = [...left];
                next[i] = e.target.value;
                updateContent({ ...content, left: next });
              }}
              style={{ flex: 1, minWidth: 140 }}
            />
            <select
              value={pairs[i] ?? 0}
              onChange={(e) => {
                const next = [...pairs];
                next[i] = Number(e.target.value);
                updateAnswer({ ...answer, pairs: next });
              }}
            >
              {right.map((rightItem, idx) => (
                <option key={idx} value={idx}>{idx}: {rightItem}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
