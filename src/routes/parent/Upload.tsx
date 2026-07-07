import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { parseJsonWithRepair } from '@shared/json-repair';
import { PROMPT_TEMPLATE } from '@shared/contract';
import type { Subject, AgeBand } from '@shared/types';

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
  const [ingestToken, setIngestToken] = useState<string | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    api.get<Subject[]>('/api/parent/subjects').then(setSubjects);
    api.get<{ token: string | null }>('/api/parent/ingest-token').then((r) => setIngestToken(r.token));
  }, []);

  // The subject name currently chosen in the form (existing or newly typed), so
  // the ingest URL below can carry it as ?subject=.
  const subjectName = subjectId
    ? subjects.find((s) => String(s.id) === subjectId)?.name ?? ''
    : newSubject.trim();
  const ingestUrl = ingestToken
    ? `${window.location.origin}/api/ingest/${ingestToken}?ageBand=${ageBand}` +
      (subjectName ? `&subject=${encodeURIComponent(subjectName)}` : '')
    : '';

  async function generateToken() {
    setTokenBusy(true);
    try {
      const r = await api.post<{ token: string }>('/api/parent/ingest-token');
      setIngestToken(r.token);
    } finally {
      setTokenBusy(false);
    }
  }

  async function revokeToken() {
    if (!confirm('ปิดลิงก์นี้? AI ที่ถือ token เดิมจะส่งเข้าระบบไม่ได้อีก')) return;
    setTokenBusy(true);
    try {
      await api.delete('/api/parent/ingest-token');
      setIngestToken(null);
    } finally {
      setTokenBusy(false);
    }
  }

  async function copyIngestUrl() {
    await navigator.clipboard.writeText(ingestUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  }

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
    if (files.length === 0 && !questionsJson.trim()) {
      setError('ต้องวาง JSON หรืออัปโหลดรูปอย่างน้อยอย่างหนึ่ง');
      return;
    }
    setError('');

    // Validate JSON client-side before uploading (tolerating stray scratchpad
    // text/code some AI chats paste alongside the actual JSON answer).
    const parsed = parseJsonWithRepair(questionsJson) as { questions?: unknown } | null;
    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      setError(
        parsed
          ? 'JSON ต้องมี field "questions" เป็น array ที่ไม่ว่างเปล่า'
          : 'รูปแบบ JSON ไม่ถูกต้อง ตรวจสอบว่า copy มาครบและไม่มีข้อความอื่นปน',
      );
      return;
    }
    const repairedJson = JSON.stringify(parsed);

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
      form.append('questionsJson', repairedJson);
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
          แล้ว copy คำสั่งด้านล่าง
        </p>
        <textarea readOnly rows={6} value={PROMPT_TEMPLATE} style={{ fontFamily: 'monospace', fontSize: '.85rem' }} />
        <button type="button" className="secondary" style={{ marginTop: 8 }} onClick={copyPrompt}>
          {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกคำสั่งนี้'}
        </button>
      </div>

      <div className="card">
        <h3>ขั้นที่ 2: ตั้งค่า + ส่งเข้าระบบ</h3>

        <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid #e6c6b0' }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 12 }}>⚙️ ตั้งค่าพื้นฐาน</label>
          <div className="row" style={{ gap: 12, marginBottom: 12 }}>
            <select value={ageBand} onChange={(e) => setAgeBand(e.target.value as AgeBand)} style={{ flex: 1 }}>
              <option value="young">สำหรับเด็กเล็ก</option>
              <option value="older">สำหรับเด็กโต</option>
            </select>
            <select className="grow" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">— เลือกวิชา —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <input
            placeholder="หรือพิมพ์วิชาใหม่ เช่น คณิตศาสตร์"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            disabled={!!subjectId}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 12 }}>✏️ ตัวเลือก A: Paste JSON + อัปโหลดรูป</label>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="muted" style={{ fontSize: '.9rem' }}>อัปโหลดรูป (ไม่จำเป็น)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => pickFiles(e.target.files)}
            />
            {previews.length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {previews.map((p, i) => (
                  <img key={i} src={p} alt={`หน้า ${i + 1}`} style={{ width: 100, height: 100, borderRadius: 8, objectFit: 'cover' }} />
                ))}
              </div>
            )}
            {files.length > 1 && <div className="muted" style={{ fontSize: '.85rem' }}>{files.length} หน้า</div>}

            <label className="muted" style={{ fontSize: '.9rem', marginTop: 4 }}>วาง JSON ที่ได้จาก AI</label>
            <textarea
              rows={6}
              placeholder='{"title": "...", "questions": [...]}'
              value={questionsJson}
              onChange={(e) => setQuestionsJson(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '.85rem' }}
            />
            <input
              placeholder="ชื่อชุดแบบฝึกหัด (เว้นว่างให้ใช้ชื่อจาก JSON)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {error && <div className="error-text">{error}</div>}
            <button type="submit" disabled={!questionsJson.trim() || busy}>
              {busy ? 'กำลังบันทึก...' : '➜ สร้างแบบฝึกหัด'}
            </button>
          </form>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 12 }}>🚀 ตัวเลือก B: ให้ AI ส่งเอง (ingest)</label>
          <p className="muted" style={{ fontSize: '.9rem', marginBottom: 12 }}>
            สร้างลิงก์ลับประจำบัญชี → copy prompt template → ปะเนื้อหา → ส่งให้ AI อ่านกติกา + POST JSON กลับมา
          </p>

          {!ingestToken ? (
            <button type="button" className="secondary" onClick={generateToken} disabled={tokenBusy}>
              {tokenBusy ? 'กำลังสร้าง...' : '🔑 สร้างลิงก์สำหรับ AI'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="secondary" onClick={copyIngestUrl}>
                  {urlCopied ? '✓ คัดลอก URL' : '📋 คัดลอก URL'}
                </button>
                <button type="button" className="secondary" onClick={generateToken} disabled={tokenBusy}>
                  🔄 หมุน
                </button>
                <button type="button" className="danger" onClick={revokeToken} disabled={tokenBusy}>
                  ปิด
                </button>
              </div>

              <div style={{ background: '#f9f5f0', border: '1px solid #e6c6b0', borderRadius: 8, padding: 12 }}>
                <p className="muted" style={{ fontSize: '.8rem', margin: '0 0 8px 0', fontWeight: 700 }}>
                  📋 Prompt template (copy & paste)
                </p>
                <textarea
                  readOnly
                  rows={14}
                  value={`คุณคือครูสอน${subjectName ? subjectName : '[วิชา]'} ชั้น${ageBand === 'young' ? 'ประถมต้น' : 'ประถมปลาย'} ที่มีความเชียวชาญด้านการออกแบบแบบฝึกหัด

ตอนนี้กำลังออกแบบแบบฝึกหัดทบทวนสำหรับนักเรียน จากเนื้อหาด้านล่าง

═══ อ่านกติกา ═══
https://kids-tutor.nupark.workers.dev/contract

═══ ลิงก์ส่ง JSON ═══
${ingestUrl}

═══ เนื้อหาที่ต้องการสอน ═══
[วางเนื้อหา/รูป/ข้อความ/HTML ที่นี่]

═══ หลังจาก ═══
- อ่านกติกา
- สร้าง JSON
- POST ไปที่ลิงก์ด้านบน`}
                  style={{ fontFamily: 'monospace', fontSize: '.75rem', padding: 10 }}
                />
                <button
                  type="button"
                  className="secondary"
                  style={{ marginTop: 8, width: '100%' }}
                  onClick={async () => {
                    const prompt = `คุณคือครูสอน${subjectName ? subjectName : '[วิชา]'} ชั้น${ageBand === 'young' ? 'ประถมต้น' : 'ประถมปลาย'} ที่มีความเชียวชาญด้านการออกแบบแบบฝึกหัด

ตอนนี้กำลังออกแบบแบบฝึกหัดทบทวนสำหรับนักเรียน จากเนื้อหาด้านล่าง

═══ อ่านกติกา ═══
https://kids-tutor.nupark.workers.dev/contract

═══ ลิงก์ส่ง JSON ═══
${ingestUrl}

═══ เนื้อหาที่ต้องการสอน ═══
[วางเนื้อหา/รูป/ข้อความ/HTML ที่นี่]

═══ หลังจาก ═══
- อ่านกติกา
- สร้าง JSON
- POST ไปที่ลิงก์ด้านบน`;
                    await navigator.clipboard.writeText(prompt);
                    alert('✓ คัดลอก prompt template แล้ว');
                  }}
                >
                  ➜ คัดลอก prompt template
                </button>
              </div>

              <p className="muted" style={{ fontSize: '.75rem' }}>
                ⚠️ เก็บลิงก์เป็นความลับ — ใครมีลิงก์จะส่งชุดเข้าบัญชีคุณได้
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
