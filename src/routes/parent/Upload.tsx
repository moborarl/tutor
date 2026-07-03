import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { Subject, AgeBand } from '@shared/types';

const PROMPT_TEMPLATE = `คุณคือผู้ช่วยแกะโจทย์จากรูปแบบฝึกหัด กรุณาดูรูปที่แนบมา แล้วแกะโจทย์ทุกข้อออกมาเป็น JSON ตาม schema ด้านล่างนี้เป๊ะๆ (ตอบเป็น JSON ล้วนๆ เท่านั้น ห้ามมีข้อความอื่นนอกจาก JSON ห้ามใช้ \`\`\`json หรือ code block ใดๆ):

{
  "title": "ชื่อชุดแบบฝึกหัดสั้นๆ",
  "questions": [
    {
      "questionType": "multiple_choice หรือ fill_blank หรือ matching หรือ true_false",
      "prompt": "ข้อความโจทย์ (สำหรับ fill_blank ให้ใช้ ___ แทนตำแหน่งเว้นว่าง)",
      "content": {
        "_multiple_choice": { "options": ["ตัวเลือก1", "ตัวเลือก2"] },
        "_fill_blank": { "hint": "คำใบ้ (ถ้ามี ไม่งั้นเว้นว่าง)" },
        "_matching": { "left": ["ข้อ1"], "right": ["คำตอบ1"] },
        "_true_false": {}
      },
      "answer": {
        "_multiple_choice": { "correctIndex": 0 },
        "_fill_blank": { "answers": ["คำตอบที่ยอมรับได้", "คำตอบอื่นที่ถูกด้วย"] },
        "_matching": { "pairs": [0] },
        "_true_false": { "value": true }
      },
      "explanation": "อธิบายเหตุผลว่าทำไมคำตอบถึงเป็นแบบนี้ เขียนให้เด็กเข้าใจง่าย"
    }
  ]
}

หมายเหตุ: "content" และ "answer" ของแต่ละข้อให้ใส่เฉพาะ key ที่ตรงกับ questionType ของข้อนั้น (ไม่ต้องใส่ทุก _key ที่ตัวอย่างแสดงไว้ นั่นแค่โชว์ตัวอย่างแต่ละประเภท)

กติกา:
- แกะทุกข้อที่เห็นในรูป ห้ามข้าม รวมถึงข้อที่มีแผนภาพ/กราฟ/รูปวาดประกอบ
- ถ้าโจทย์ไม่มีเฉลยในรูป ให้คิดคำตอบที่ถูกต้องเอง
- ทุกข้อต้องมี "explanation" อธิบายเหตุผลเสมอ เขียนให้เด็กเข้าใจง่าย
- ใช้ภาษาเดียวกับโจทย์ต้นฉบับ (ไทยหรืออังกฤษ)
- correctIndex และ pairs เริ่มนับจาก 0`;

export default function Upload() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [title, setTitle] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('young');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [questionsJson, setQuestionsJson] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Subject[]>('/api/parent/subjects').then(setSubjects);
  }, []);

  function pickFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : '');
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(PROMPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError('');

    // Validate JSON client-side before uploading.
    try {
      const parsed = JSON.parse(questionsJson);
      if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        setError('JSON ต้องมี field "questions" เป็น array ที่ไม่ว่างเปล่า');
        return;
      }
    } catch {
      setError('รูปแบบ JSON ไม่ถูกต้อง ตรวจสอบว่า copy มาครบและไม่มีข้อความอื่นปน');
      return;
    }

    setBusy(true);
    try {
      let sid = subjectId;
      if (!sid && newSubject.trim()) {
        const created = await api.post<{ id: number }>('/api/parent/subjects', { name: newSubject.trim() });
        sid = String(created.id);
      }
      const form = new FormData();
      form.append('image', file);
      form.append('ageBand', ageBand);
      form.append('title', title);
      form.append('questionsJson', questionsJson);
      if (sid) form.append('subjectId', sid);
      const res = await api.post<{ id: number; status: string }>('/api/parent/exercise-sets', form);
      nav(`/parent/exercises/${res.id}`);
    } catch {
      setError('บันทึกไม่สำเร็จ ตรวจสอบ JSON แล้วลองใหม่');
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>สร้างแบบฝึกหัดใหม่</h2>

      <div className="card">
        <h3>ขั้นที่ 1: ให้ AI แกะโจทย์ (ฟรี)</h3>
        <p className="muted">
          เปิด <a href="https://chatgpt.com" target="_blank" rel="noreferrer">ChatGPT</a>,{' '}
          <a href="https://claude.ai" target="_blank" rel="noreferrer">Claude.ai</a> หรือ{' '}
          <a href="https://gemini.google.com" target="_blank" rel="noreferrer">Gemini</a> (แบบฟรี ไม่เสียเงิน)
          แนบรูปแบบฝึกหัดของคุณ พร้อมข้อความคำสั่งด้านล่างนี้ แล้ว copy คำตอบ (JSON) มาวางในขั้นที่ 2
        </p>
        <textarea readOnly rows={6} value={PROMPT_TEMPLATE} style={{ fontFamily: 'monospace', fontSize: '.85rem' }} />
        <button type="button" className="secondary" style={{ marginTop: 8 }} onClick={copyPrompt}>
          {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกคำสั่งนี้'}
        </button>
      </div>

      <div className="card">
        <h3>ขั้นที่ 2: อัปโหลดรูปและวาง JSON</h3>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            required
          />
          {preview && (
            <img src={preview} alt="preview" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 12, objectFit: 'contain' }} />
          )}
          <label className="muted">วาง JSON ที่ได้จาก AI ที่นี่</label>
          <textarea
            rows={8}
            placeholder='{"title": "...", "questions": [...]}'
            value={questionsJson}
            onChange={(e) => setQuestionsJson(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: '.85rem' }}
            required
          />
          <input placeholder="ชื่อชุดแบบฝึกหัด (เว้นว่างให้ใช้ชื่อจาก JSON)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select value={ageBand} onChange={(e) => setAgeBand(e.target.value as AgeBand)}>
            <option value="young">สำหรับเด็กเล็ก</option>
            <option value="older">สำหรับเด็กโต</option>
          </select>
          <div className="row">
            <select className="grow" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">— เลือกวิชา —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              className="grow"
              placeholder="หรือพิมพ์วิชาใหม่ เช่น คณิตศาสตร์"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              disabled={!!subjectId}
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button type="submit" disabled={!file || !questionsJson || busy}>
            {busy ? 'กำลังบันทึก...' : 'สร้างแบบฝึกหัด'}
          </button>
        </form>
      </div>
    </div>
  );
}
