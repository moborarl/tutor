import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { Subject, AgeBand } from '@shared/types';

const PROMPT_TEMPLATE = `คุณคือผู้ช่วยแกะโจทย์จากรูปแบบฝึกหัด กรุณาดูรูปที่แนบมาทุกรูป (อาจมีหลายหน้า) แล้วแกะโจทย์ทุกข้อออกมาเป็น JSON ตาม schema ด้านล่างนี้เป๊ะๆ (ตอบเป็น JSON ล้วนๆ เท่านั้น ห้ามมีข้อความอื่นนอกจาก JSON ห้ามใช้ \`\`\`json หรือ code block ใดๆ ห้ามใส่ key อื่นนอกจากที่ระบุไว้)

รูปแบบ JSON หลัก (โครงสร้างที่ต้องตอบกลับมา):
{
  "title": "ชื่อชุดแบบฝึกหัดสั้นๆ",
  "questions": [ /* array ของโจทย์แต่ละข้อ ดูตัวอย่างแต่ละประเภทด้านล่าง */ ]
}

ตัวอย่างโจทย์แต่ละประเภท (แต่ละข้อใน "questions" ให้เลือกใช้ 1 แบบตาม questionType โดยใส่ content/answer ตรงๆ ไม่ต้องมี key ครอบซ้ำ):

แบบ multiple_choice (ปรนัย):
{"questionType":"multiple_choice","prompt":"ข้อความโจทย์","content":{"options":["ตัวเลือก1","ตัวเลือก2","ตัวเลือก3"]},"answer":{"correctIndex":0},"explanation":"เหตุผลที่ตอบข้อนี้"}

แบบ fill_blank (เติมคำ ใช้ ___ แทนช่องว่างใน prompt):
{"questionType":"fill_blank","prompt":"ท้องฟ้าสีอะไร ___","content":{"hint":"คำใบ้ถ้ามี"},"answer":{"answers":["ฟ้า","สีฟ้า"]},"explanation":"เหตุผลที่ตอบแบบนี้"}

แบบ matching (จับคู่):
{"questionType":"matching","prompt":"จับคู่ให้ถูกต้อง","content":{"left":["ข้อ1","ข้อ2"],"right":["คำตอบA","คำตอบB"]},"answer":{"pairs":[0,1]},"explanation":"เหตุผลที่จับคู่แบบนี้"}

แบบ true_false (ถูก/ผิด):
{"questionType":"true_false","prompt":"ข้อความที่ต้องตัดสินว่าถูกหรือผิด","content":{},"answer":{"value":true},"explanation":"เหตุผลที่ถูกหรือผิด"}

กติกา:
- แกะทุกข้อที่เห็นในทุกรูป ห้ามข้าม รวมถึงข้อที่มีแผนภาพ/กราฟ/รูปวาดประกอบ
- ถ้าโจทย์ไม่มีเฉลยในรูป ให้คิดคำตอบที่ถูกต้องเอง
- ทุกข้อต้องมี "explanation" อธิบายเหตุผลเสมอ เขียนให้เด็กเข้าใจง่าย
- ใช้ภาษาเดียวกับโจทย์ต้นฉบับ (ไทยหรืออังกฤษ)
- correctIndex และ pairs เริ่มนับจาก 0
- ห้ามใส่ key ครอบ เช่น "_multiple_choice" หรือ "multiple_choice" ใน content/answer — ใส่ options/correctIndex/answers/pairs/value ตรงๆ ตามตัวอย่างเท่านั้น`;

export default function Upload() {
  const nav = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
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

  function pickFiles(list: FileList | null) {
    const picked = list ? Array.from(list) : [];
    previews.forEach((p) => URL.revokeObjectURL(p));
    setFiles(picked);
    setPreviews(picked.map((f) => URL.createObjectURL(f)));
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(PROMPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
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
      files.forEach((f) => form.append('images', f));
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
          แนบรูปแบบฝึกหัดของคุณทุกหน้า พร้อมข้อความคำสั่งด้านล่างนี้ แล้ว copy คำตอบ (JSON) มาวางในขั้นที่ 2
        </p>
        <textarea readOnly rows={6} value={PROMPT_TEMPLATE} style={{ fontFamily: 'monospace', fontSize: '.85rem' }} />
        <button type="button" className="secondary" style={{ marginTop: 8 }} onClick={copyPrompt}>
          {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกคำสั่งนี้'}
        </button>
      </div>

      <div className="card">
        <h3>ขั้นที่ 2: อัปโหลดรูป (เลือกได้หลายหน้า) และวาง JSON</h3>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => pickFiles(e.target.files)}
            required
          />
          {previews.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {previews.map((p, i) => (
                <img key={i} src={p} alt={`หน้า ${i + 1}`} style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover' }} />
              ))}
            </div>
          )}
          {files.length > 1 && <div className="muted">{files.length} หน้า — เรียงตามลำดับที่เลือกไฟล์</div>}
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
          <button type="submit" disabled={files.length === 0 || !questionsJson || busy}>
            {busy ? 'กำลังบันทึก...' : 'สร้างแบบฝึกหัด'}
          </button>
        </form>
      </div>
    </div>
  );
}
