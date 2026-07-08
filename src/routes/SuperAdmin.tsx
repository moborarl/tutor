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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
          การลบนี้จะลบผู้ปกครอง เด็ก แบบฝึกหัด โจทย์ attempts sessions และไฟล์ R2 ใต้บัญชีนี้ทั้งหมด พิมพ์อีเมลบัญชีให้ตรงเพื่อยืนยัน
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

export default function SuperAdmin() {
  const [token, setToken] = useState(sessionStorage.getItem('superAdminToken') ?? '');
  const [summary, setSummary] = useState<SuperAdminSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

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
            <Card className="stat-card"><div className="stat-value">{summary.totals.attempts}</div><Text color="gray" size="2">attempts</Text></Card>
            <Card className="stat-card"><div className="stat-value">{formatBytes(summary.totals.r2Bytes)}</div><Text color="gray" size="2">storage</Text></Card>
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
                      เด็ก {p.childCount} · แบบฝึกหัด {p.exerciseSetCount} · โจทย์ {p.questionCount} · attempts {p.attemptCount}
                    </Text>
                  </div>
                  <DeleteParentDialog parent={p} busy={busy} onDelete={deleteParent} />
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
