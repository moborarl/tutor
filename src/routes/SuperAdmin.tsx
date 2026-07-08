import { useState } from 'react';
import { AlertDialog, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';

interface SuperAdminSummary {
  totals: {
    parents: number;
    children: number;
    exerciseSets: number;
    questions: number;
    attempts: number;
    r2Objects: number;
    r2Bytes: number;
  };
  parents: Array<{
    id: number;
    email: string;
    createdAt: string;
    childCount: number;
    exerciseSetCount: number;
    questionCount: number;
    attemptCount: number;
  }>;
}

interface R2FileRow {
  key: string;
  size: number;
  uploaded: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'x-super-admin-token': token, ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `http_${res.status}`);
  return body as T;
}

function DeleteParentDialog({
  parent,
  busy,
  onDelete,
}: {
  parent: SuperAdminSummary['parents'][number];
  busy: boolean;
  onDelete: (parent: SuperAdminSummary['parents'][number], confirmEmail: string) => Promise<void>;
}) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const canDelete = confirmEmail === parent.email && !busy;
  return (
    <AlertDialog.Root onOpenChange={(open) => { if (!open) setConfirmEmail(''); }}>
      <AlertDialog.Trigger><Button variant="soft" color="red" disabled={busy}>ลบบัญชี</Button></AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="500px">
        <AlertDialog.Title>ลบบัญชี {parent.email}?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          การลบนี้จะลบผู้ปกครอง เด็ก แบบฝึกหัด โจทย์ ประวัติการทำ เซสชัน และไฟล์ R2 ใต้บัญชีนี้ทั้งหมด พิมพ์อีเมลบัญชีให้ตรงเพื่อยืนยัน
        </AlertDialog.Description>
        <input
          style={{ marginTop: 14 }}
          placeholder={parent.email}
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
        />
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button color="red" disabled={!canDelete} onClick={() => onDelete(parent, confirmEmail)}>ลบบัญชีถาวร</Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

function DeleteR2Dialog({
  file,
  busy,
  onDelete,
}: {
  file: R2FileRow;
  busy: boolean;
  onDelete: (key: string) => Promise<void>;
}) {
  const [confirmKey, setConfirmKey] = useState('');
  const canDelete = confirmKey === file.key && !busy;
  return (
    <AlertDialog.Root onOpenChange={(open) => { if (!open) setConfirmKey(''); }}>
      <AlertDialog.Trigger><Button variant="soft" color="red" disabled={busy}>ลบไฟล์</Button></AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="520px">
        <AlertDialog.Title>ลบไฟล์ R2 นี้?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          การลบไฟล์นี้มีผลข้ามบัญชีถ้าไฟล์ยังถูกใช้อยู่ พิมพ์ key ให้ตรงเพื่อยืนยัน
        </AlertDialog.Description>
        <Text as="div" size="1" color="gray" style={{ marginTop: 12, wordBreak: 'break-all' }}>{file.key}</Text>
        <input
          style={{ marginTop: 12 }}
          placeholder="พิมพ์ key ให้ตรง"
          value={confirmKey}
          onChange={(e) => setConfirmKey(e.target.value)}
        />
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" disabled={!canDelete} onClick={() => onDelete(file.key)}>ลบไฟล์</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

export default function SuperAdmin() {
  const [token, setToken] = useState(sessionStorage.getItem('superAdminToken') ?? '');
  const [summary, setSummary] = useState<SuperAdminSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [r2Prefix, setR2Prefix] = useState('');
  const [r2Files, setR2Files] = useState<R2FileRow[]>([]);
  const [r2Cursor, setR2Cursor] = useState<string | null>(null);
  const [r2Loading, setR2Loading] = useState(false);

  async function load() {
    setError('');
    setBusy(true);
    try {
      const data = await request<SuperAdminSummary>('/api/super-admin/summary', token);
      sessionStorage.setItem('superAdminToken', token);
      setSummary(data);
    } catch (err) {
      setError('เข้า super-admin ไม่ได้ ตรวจสอบ token');
    } finally {
      setBusy(false);
    }
  }

  async function deleteParent(parent: SuperAdminSummary['parents'][number], confirmEmail: string) {
    setBusy(true);
    try {
      await request(`/api/super-admin/parents/${parent.id}`, token, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmEmail }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function loadR2Files(reset = false) {
    setR2Loading(true);
    try {
      const params = new URLSearchParams();
      if (r2Prefix.trim()) params.set('prefix', r2Prefix.trim());
      if (!reset && r2Cursor) params.set('cursor', r2Cursor);
      const queryString = params.toString();
      const data = await request<{ files: R2FileRow[]; cursor: string | null }>(
        `/api/super-admin/r2-files${queryString ? `?${queryString}` : ''}`,
        token,
      );
      setR2Files((prev) => reset ? data.files : [...prev, ...data.files]);
      setR2Cursor(data.cursor);
    } finally {
      setR2Loading(false);
    }
  }

  async function deleteR2File(key: string) {
    setBusy(true);
    try {
      await request('/api/super-admin/r2-files', token, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, confirmKey: key }),
      });
      setR2Files((files) => files.filter((file) => file.key !== key));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const visibleParents = summary?.parents.filter((p) => {
    const q = query.trim().toLowerCase();
    return !q || `${p.email} ${p.id}`.toLowerCase().includes(q);
  }) ?? [];

  return (
    <div className="page parent-stack">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">Super Admin</Heading>
          <Text color="gray" size="2">ดูและลบข้อมูลข้ามทุกบัญชี ต้องใช้ token พิเศษจาก Cloudflare secret</Text>
        </div>
      </div>

      <Card className="parent-panel">
        <Flex gap="2" wrap="wrap">
          <input type="password" placeholder="SUPER_ADMIN_TOKEN" value={token} onChange={(e) => setToken(e.target.value)} />
          <Button onClick={load} disabled={!token || busy}>{busy ? 'กำลังโหลด...' : 'เปิดดูข้อมูล'}</Button>
        </Flex>
        {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
      </Card>

      {summary && (
        <>
          <div className="stats-grid admin-stats">
            <Card className="stat-card"><div className="stat-value">{summary.totals.parents}</div><Text color="gray" size="2">บัญชี</Text></Card>
            <Card className="stat-card"><div className="stat-value">{summary.totals.children}</div><Text color="gray" size="2">เด็ก</Text></Card>
            <Card className="stat-card"><div className="stat-value">{summary.totals.exerciseSets}</div><Text color="gray" size="2">แบบฝึกหัด</Text></Card>
            <Card className="stat-card"><div className="stat-value">{summary.totals.questions}</div><Text color="gray" size="2">โจทย์</Text></Card>
            <Card className="stat-card"><div className="stat-value">{summary.totals.attempts}</div><Text color="gray" size="2">ประวัติการทำ</Text></Card>
            <Card className="stat-card"><div className="stat-value">{formatBytes(summary.totals.r2Bytes)}</div><Text color="gray" size="2">พื้นที่ไฟล์</Text></Card>
          </div>

          <Card className="parent-panel">
            <Flex align="center" gap="3" wrap="wrap">
              <div className="grow">
                <Heading as="h3" size="4">บัญชีทั้งหมด</Heading>
                <Text color="gray" size="2">แสดง {visibleParents.length} จาก {summary.parents.length} บัญชี</Text>
              </div>
              <input placeholder="ค้นหาอีเมลหรือ id" value={query} onChange={(e) => setQuery(e.target.value)} />
            </Flex>
            <div className="admin-list">
              {visibleParents.map((p) => (
                <div key={p.id} className="admin-row">
                  <div className="grow">
                    <Text as="div" weight="bold">{p.email}</Text>
                    <Text as="div" color="gray" size="2">
                      เด็ก {p.childCount} · แบบฝึกหัด {p.exerciseSetCount} · โจทย์ {p.questionCount} · ประวัติการทำ {p.attemptCount}
                    </Text>
                  </div>
                  <DeleteParentDialog parent={p} busy={busy} onDelete={deleteParent} />
                </div>
              ))}
            </div>
          </Card>

          <Card className="parent-panel">
            <Flex align="center" gap="3" wrap="wrap">
              <div className="grow">
                <Heading as="h3" size="4">ไฟล์ R2</Heading>
                <Text color="gray" size="2">ดูและลบไฟล์โดยตรง ใช้ prefix เพื่อเจาะบัญชี เช่น worksheets/123/</Text>
              </div>
              <input placeholder="prefix เช่น worksheets/123/" value={r2Prefix} onChange={(e) => setR2Prefix(e.target.value)} />
              <Button variant="soft" color="gray" onClick={() => loadR2Files(true)} disabled={!token || r2Loading}>
                {r2Files.length === 0 ? 'โหลดรายการไฟล์' : 'รีเฟรช'}
              </Button>
            </Flex>
            <div className="admin-list">
              {r2Files.map((file) => (
                <div key={file.key} className="admin-row r2-file-row">
                  <div className="grow">
                    <Text as="div" weight="bold" className="r2-file-key">{file.key}</Text>
                    <Text as="div" color="gray" size="2">{formatBytes(file.size)} · อัปโหลด {formatDate(file.uploaded)}</Text>
                  </div>
                  <DeleteR2Dialog file={file} busy={busy} onDelete={deleteR2File} />
                </div>
              ))}
              {r2Files.length === 0 && <Text color="gray">ยังไม่ได้โหลดรายการไฟล์</Text>}
            </div>
            {r2Cursor && (
              <Button variant="soft" color="gray" onClick={() => loadR2Files(false)} disabled={r2Loading}>
                โหลดเพิ่ม
              </Button>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
