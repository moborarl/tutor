import { useEffect, useMemo, useState } from 'react';
import { AlertDialog, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api-client';
import { preflightImportedJson, type ImportPreflightReport } from '@shared/import-preflight';
import { buildPromptTemplate, PROMPT_TEMPLATE_OPTIONS, type PromptTemplateKind } from '../../lib/prompt-templates';
import type { Subject, AgeBand, QuestionType } from '@shared/types';
import { useNotify } from '../../components/AppNotifications';

const QUESTION_TYPE_TH: Record<QuestionType, string> = {
  multiple_choice: 'ปรนัย',
  fill_blank: 'เติมคำ',
  matching: 'จับคู่',
  true_false: 'ถูก/ผิด',
  fraction: 'เศษส่วน',
  ordering: 'เรียงลำดับ',
};

function PreflightPanel({ report }: { report: ImportPreflightReport | null }) {
  if (!report) {
    return (
      <div className="preflight-panel muted">
        วาง JSON เพื่อให้ระบบตรวจโครงสร้างก่อนสร้างแบบฝึกหัด
      </div>
    );
  }

  const errors = report.issues.filter((issue) => issue.level === 'error');
  const warnings = report.issues.filter((issue) => issue.level === 'warning');
  const typeRows = Object.entries(report.questionTypeCounts)
    .filter(([, count]) => Number(count) > 0)
    .map(([type, count]) => `${QUESTION_TYPE_TH[type as QuestionType] ?? type} ${count}`);

  return (
    <div className={`preflight-panel ${report.ok ? 'ok' : 'blocked'}`}>
      <div className="preflight-head">
        <div>
          <b>{report.ok ? 'JSON พร้อมสร้างแบบฝึกหัด' : 'ต้องแก้ JSON ก่อนสร้าง'}</b>
          <span>
            อ่านได้ {report.validQuestionCount}/{report.questionCount} ข้อ
            {typeRows.length > 0 ? ` · ${typeRows.join(' · ')}` : ''}
          </span>
        </div>
        <span className={`preflight-status ${report.ok ? 'ok' : 'blocked'}`}>
          {errors.length} error · {warnings.length} warning
        </span>
      </div>
      <div className="preflight-meta">
        <span>อ้างถึงรูป: {report.referencedImagePages.length ? report.referencedImagePages.join(', ') : 'ไม่มี'}</span>
        <span>diagram: {report.diagramCount}</span>
      </div>
      {report.issues.length > 0 && (
        <div className="preflight-issues">
          {report.issues.slice(0, 8).map((issue, index) => (
            <div key={index} className={`preflight-issue ${issue.level}`}>
              <b>{issue.level === 'error' ? 'ต้องแก้' : 'ตรวจดู'}</b>
              <span>{issue.questionNumber ? `ข้อ ${issue.questionNumber}: ` : ''}{issue.message}</span>
            </div>
          ))}
          {report.issues.length > 8 && <span className="muted">และอีก {report.issues.length - 8} รายการ</span>}
        </div>
      )}
    </div>
  );
}

export default function Upload() {
  const notify = useNotify();
  const nav = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('young');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [questionsJson, setQuestionsJson] = useState('');
  const [jsonFileName, setJsonFileName] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ingestToken, setIngestToken] = useState<string | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState<PromptTemplateKind>('multiple_choice');

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

  const promptTemplateText = buildPromptTemplate({
    kind: promptTemplate,
    subject: subjectName,
    ageBand: ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต',
    contractUrl: `${window.location.origin}/contract`,
    ingestUrl,
  });

  // Single source for the AI prompt (shown in the textarea and copied by the
  // button). Both URLs are derived from the current origin so the template
  // stays correct if the app moves to another domain.
  const ingestPrompt = `คุณคือครูสอน${subjectName || '[วิชา]'} ชั้น${ageBand === 'young' ? 'ประถมต้น' : 'ประถมปลาย'} ที่มีความเชียวชาญด้านการออกแบบแบบฝึกหัด

ตอนนี้กำลังออกแบบแบบฝึกหัดทบทวนสำหรับนักเรียน จากเนื้อหาด้านล่าง

═══ อ่านกติกา ═══
${window.location.origin}/contract

═══ ลิงก์ส่ง JSON ═══
${ingestUrl}

═══ เนื้อหาที่ต้องการสอน ═══
[วางเนื้อหา/รูป/ข้อความ/HTML ที่นี่]

═══ หลังจาก ═══
- อ่านกติกา
- สร้าง JSON
- POST ไปที่ลิงก์ด้านบน`;
  const preflight = useMemo(() => {
    if (!questionsJson.trim()) return null;
    return preflightImportedJson(questionsJson, { uploadedImageCount: files.length });
  }, [files.length, questionsJson]);

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

  async function pickJsonFile(file: File | undefined) {
    if (!file) return;

    try {
      const content = await file.text();
      setQuestionsJson(content);
      setJsonFileName(file.name);
      setError('');
    } catch {
      setJsonFileName('');
      setError('อ่านไฟล์ JSON ไม่สำเร็จ ลองเลือกไฟล์อีกครั้ง');
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(promptTemplateText);
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

    const report = preflightImportedJson(questionsJson, { uploadedImageCount: files.length });
    if (!report.ok || report.questions.length === 0 || !report.repairedJson) {
      const firstError = report.issues.find((issue) => issue.level === 'error');
      setError(firstError ? `ตรวจ JSON ไม่ผ่าน: ${firstError.questionNumber ? `ข้อ ${firstError.questionNumber}: ` : ''}${firstError.message}` : 'JSON ต้องมี field "questions" เป็น array ที่ไม่ว่างเปล่า');
      return;
    }
    const repairedJson = report.repairedJson;

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
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { message?: unknown; error?: unknown };
        const detail = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : '';
        setError(detail ? `บันทึกไม่สำเร็จ: ${detail}` : 'บันทึกไม่สำเร็จ ตรวจสอบ JSON แล้วลองใหม่');
      } else {
        setError('บันทึกไม่สำเร็จ ตรวจสอบ JSON แล้วลองใหม่');
      }
      setBusy(false);
    }
  }

  return (
    <div className="parent-stack">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">สร้างแบบฝึกหัดใหม่</Heading>
          <Text color="gray" size="2">วาง JSON จาก AI, แนบรูปต้นฉบับ หรือให้ AI ส่งเข้าระบบเองผ่านลิงก์ลับ</Text>
        </div>
      </div>

      <Card className="parent-panel">
        <Heading as="h3" size="4">ขั้นที่ 1: ให้ AI แกะโจทย์</Heading>
        <Text as="p" color="gray" size="2">
          เปิด <a href="https://chatgpt.com" target="_blank" rel="noreferrer">ChatGPT</a>,{' '}
          <a href="https://claude.ai" target="_blank" rel="noreferrer">Claude.ai</a> หรือ{' '}
          <a href="https://gemini.google.com" target="_blank" rel="noreferrer">Gemini</a> (แบบฟรี ไม่เสียเงิน)
          แล้ว copy คำสั่งด้านล่าง
        </Text>
        <select aria-label="รูปแบบ prompt" data-template-kinds="multiple_choice short_answer ordering matching exam" value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value as PromptTemplateKind)}>
          {PROMPT_TEMPLATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <textarea readOnly rows={8} value={promptTemplateText} style={{ fontFamily: 'monospace', fontSize: '.85rem' }} />
        <Button type="button" variant="soft" color="gray" style={{ marginTop: 8 }} onClick={copyPrompt}>
          {copied ? 'คัดลอกแล้ว' : 'คัดลอกคำสั่งนี้'}
        </Button>
      </Card>

      <Card className="parent-panel">
        <Heading as="h3" size="4">ขั้นที่ 2: ตั้งค่า + ส่งเข้าระบบ</Heading>

        <div className="upload-section">
          <label className="section-label">ตั้งค่าพื้นฐาน</label>
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

        <div className="upload-section">
          <label className="section-label">ตัวเลือก A: นำเข้า JSON + อัปโหลดรูป</label>
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

            <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <label className="muted" style={{ fontSize: '.9rem' }}>วาง JSON ที่ได้จาก AI</label>
              <label>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => void pickJsonFile(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
                <Button type="button" variant="soft" color="gray" asChild>
                  <span>เลือกไฟล์ JSON</span>
                </Button>
              </label>
              {jsonFileName && <Text color="gray" size="1">อ่านไฟล์: {jsonFileName}</Text>}
            </div>
            <textarea
              rows={6}
              placeholder='{"title": "...", "questions": [...]}'
              value={questionsJson}
              onChange={(e) => {
                setQuestionsJson(e.target.value);
                setJsonFileName('');
              }}
              style={{ fontFamily: 'monospace', fontSize: '.85rem' }}
            />
            <PreflightPanel report={preflight} />
            <input
              placeholder="ชื่อชุดแบบฝึกหัด (เว้นว่างให้ใช้ชื่อจาก JSON)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {error && <div className="error-text">{error}</div>}
            <Button type="submit" disabled={!questionsJson.trim() || busy}>
              {busy ? 'กำลังบันทึก...' : 'สร้างแบบฝึกหัด'}
            </Button>
          </form>
        </div>

        <div>
          <label className="section-label">ตัวเลือก B: ให้ AI ส่งเอง (ingest)</label>
          <Text as="p" color="gray" size="2">
            สร้างลิงก์ลับประจำบัญชี → copy prompt template → ปะเนื้อหา → ส่งให้ AI อ่านกติกา + POST JSON กลับมา
          </Text>

          {!ingestToken ? (
            <Button type="button" variant="soft" color="gray" onClick={generateToken} disabled={tokenBusy}>
              {tokenBusy ? 'กำลังสร้าง...' : 'สร้างลิงก์สำหรับ AI'}
            </Button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <Button type="button" variant="soft" color="gray" onClick={copyIngestUrl}>
                  {urlCopied ? 'คัดลอก URL แล้ว' : 'คัดลอก URL'}
                </Button>
                <Button type="button" variant="soft" color="gray" onClick={generateToken} disabled={tokenBusy}>
                  หมุน token
                </Button>
                <AlertDialog.Root>
                  <AlertDialog.Trigger>
                    <Button type="button" variant="soft" color="red" disabled={tokenBusy}>ปิดลิงก์</Button>
                  </AlertDialog.Trigger>
                  <AlertDialog.Content maxWidth="420px">
                    <AlertDialog.Title>ปิดลิงก์สำหรับ AI?</AlertDialog.Title>
                    <AlertDialog.Description size="2">AI ที่ถือ token เดิมจะส่งเข้าระบบไม่ได้อีก</AlertDialog.Description>
                    <Flex gap="3" justify="end" mt="4">
                      <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
                      <AlertDialog.Action><Button color="red" onClick={revokeToken}>ปิดลิงก์</Button></AlertDialog.Action>
                    </Flex>
                  </AlertDialog.Content>
                </AlertDialog.Root>
              </div>

              <div className="prompt-panel">
                <Text as="div" color="gray" size="1" weight="bold" mb="2">
                  Prompt template (copy & paste)
                </Text>
                <textarea
                  readOnly
                  rows={14}
                  value={ingestPrompt}
                  style={{ fontFamily: 'monospace', fontSize: '.75rem', padding: 10 }}
                />
                <Button
                  type="button"
                  style={{ marginTop: 8, width: '100%' }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(ingestPrompt);
                    notify('คัดลอก prompt template แล้ว', 'success');
                  }}
                >
                  คัดลอก prompt template
                </Button>
              </div>

              <p className="muted" style={{ fontSize: '.75rem' }}>
                ⚠️ เก็บลิงก์เป็นความลับ — ใครมีลิงก์จะส่งชุดเข้าบัญชีคุณได้
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
