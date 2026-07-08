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

export default function SuperAdmin() {
  const [token, setToken] = useState(sessionStorage.getItem('superAdminToken') ?? '');
  const [summary, setSummary] = useState<SuperAdminSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function deleteParent(id: number) {
    setBusy(true);
    try {
      await request(`/api/super-admin/parents/${id}`, token, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(false);
    }
  }

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
            <Heading as="h3" size="4">บัญชีทั้งหมด</Heading>
            <div className="admin-list">
              {summary.parents.map((p) => (
                <div key={p.id} className="admin-row">
                  <div className="grow">
                    <Text as="div" weight="bold">{p.email}</Text>
                    <Text as="div" color="gray" size="2">
                      เด็ก {p.childCount} · แบบฝึกหัด {p.exerciseSetCount} · โจทย์ {p.questionCount} · attempts {p.attemptCount}
                    </Text>
                  </div>
                  <AlertDialog.Root>
                    <AlertDialog.Trigger><Button variant="soft" color="red" disabled={busy}>ลบบัญชี</Button></AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="460px">
                      <AlertDialog.Title>ลบบัญชี {p.email}?</AlertDialog.Title>
                      <AlertDialog.Description size="2">
                        จะลบผู้ปกครอง เด็ก แบบฝึกหัด โจทย์ attempts sessions และไฟล์ R2 ใต้บัญชีนี้ทั้งหมด
                      </AlertDialog.Description>
                      <Flex gap="3" justify="end" mt="4">
                        <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
                        <AlertDialog.Action><Button color="red" onClick={() => deleteParent(p.id)}>ลบบัญชี</Button></AlertDialog.Action>
                      </Flex>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
