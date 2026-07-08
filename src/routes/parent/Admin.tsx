import { useEffect, useState } from 'react';
import { AlertDialog, Badge, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { api } from '../../lib/api-client';

interface AdminSummary {
  counts: {
    children: number;
    subjects: number;
    exerciseSets: number;
    archivedSets: number;
    questions: number;
    attempts: number;
    answers: number;
    images: number;
    r2Objects: number;
    r2Bytes: number;
  };
  sets: Array<{
    id: number;
    title: string;
    status: string;
    ageBand: string;
    subjectName: string | null;
    questionCount: number;
    assignedCount: number;
  }>;
  children: Array<{
    id: number;
    name: string;
    avatar: string;
    ageBand: string;
    assignedCount: number;
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

function ConfirmDanger({
  label,
  title,
  description,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger><Button variant="soft" color="red">{label}</Button></AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="460px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{description}</AlertDialog.Description>
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onConfirm}>ยืนยันลบ</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

function ConfirmR2Delete({
  file,
  onConfirm,
  busy,
}: {
  file: R2FileRow;
  onConfirm: (key: string) => Promise<void>;
  busy: boolean;
}) {
  const [confirmKey, setConfirmKey] = useState('');
  const canDelete = confirmKey === file.key && !busy;
  return (
    <AlertDialog.Root onOpenChange={(open) => { if (!open) setConfirmKey(''); }}>
      <AlertDialog.Trigger><Button variant="soft" color="red" disabled={busy}>ลบไฟล์</Button></AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="520px">
        <AlertDialog.Title>ลบไฟล์ R2 นี้?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          การลบไฟล์โดยตรงอาจทำให้รูปในแบบฝึกหัดบางหน้าหาย พิมพ์ key ให้ตรงเพื่อยืนยัน
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
          <AlertDialog.Action><Button color="red" disabled={!canDelete} onClick={() => onConfirm(file.key)}>ลบไฟล์</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

export default function Admin() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [r2Files, setR2Files] = useState<R2FileRow[]>([]);
  const [r2Cursor, setR2Cursor] = useState<string | null>(null);
  const [r2Loading, setR2Loading] = useState(false);

  function load() {
    api.get<AdminSummary>('/api/parent/admin/summary').then(setSummary);
  }

  useEffect(load, []);

  async function loadR2Files(reset = false) {
    setR2Loading(true);
    try {
      const cursor = reset ? '' : r2Cursor;
      const data = await api.get<{ files: R2FileRow[]; cursor: string | null }>(
        `/api/parent/admin/r2-files${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      setR2Files((prev) => reset ? data.files : [...prev, ...data.files]);
      setR2Cursor(data.cursor);
    } finally {
      setR2Loading(false);
    }
  }

  async function runCleanup(path: string) {
    setBusy(true);
    try {
      await api.delete(path);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteR2File(key: string) {
    setBusy(true);
    try {
      await api.delete('/api/parent/admin/r2-files', { key, confirmKey: key });
      setR2Files((files) => files.filter((file) => file.key !== key));
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!summary) {
    return (
      <Card className="parent-panel">
        <Flex align="center" gap="3">
          <div className="state-spinner" />
          <Text color="gray">กำลังโหลดข้อมูล...</Text>
        </Flex>
      </Card>
    );
  }
  const c = summary.counts;

  return (
    <div className="parent-stack">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">ดูแลข้อมูล</Heading>
          <Text color="gray" size="2">ดูภาพรวมข้อมูลของบัญชีนี้ และลบข้อมูลที่ไม่ใช้เพื่อลดพื้นที่ฐานข้อมูล/ไฟล์</Text>
        </div>
      </div>

      <div className="stats-grid admin-stats">
        <Card className="stat-card"><div className="stat-value">{c.exerciseSets}</div><Text color="gray" size="2">แบบฝึกหัด</Text></Card>
        <Card className="stat-card"><div className="stat-value">{c.archivedSets}</div><Text color="gray" size="2">เก็บเข้าคลัง</Text></Card>
        <Card className="stat-card"><div className="stat-value">{c.children}</div><Text color="gray" size="2">เด็ก</Text></Card>
        <Card className="stat-card"><div className="stat-value">{c.questions}</div><Text color="gray" size="2">โจทย์</Text></Card>
        <Card className="stat-card"><div className="stat-value">{c.attempts}</div><Text color="gray" size="2">ประวัติการทำ</Text></Card>
        <Card className="stat-card"><div className="stat-value">{c.r2Objects}</div><Text color="gray" size="2">ไฟล์ R2</Text></Card>
        <Card className="stat-card"><div className="stat-value">{formatBytes(c.r2Bytes)}</div><Text color="gray" size="2">พื้นที่ไฟล์โดยประมาณ</Text></Card>
      </div>

      <Card className="parent-panel">
        <Flex align="center" gap="3" wrap="wrap">
          <div className="grow">
            <Heading as="h3" size="4">ล้างข้อมูล</Heading>
            <Text color="gray" size="2">ลบเฉพาะข้อมูลของบัญชีนี้เท่านั้น</Text>
          </div>
          <ConfirmDanger
            label={busy ? 'กำลังลบ...' : 'ลบประวัติการทำทั้งหมด'}
            title="ลบประวัติการทำทั้งหมด?"
            description="คะแนนและคำตอบที่เด็กเคยทำจะถูกลบ แต่แบบฝึกหัดและโปรไฟล์เด็กจะยังอยู่"
            onConfirm={() => runCleanup('/api/parent/admin/attempts')}
          />
        </Flex>
      </Card>

      <Card className="parent-panel">
        <Heading as="h3" size="4">แบบฝึกหัดทั้งหมด</Heading>
        <div className="admin-list">
          {summary.sets.map((s) => (
            <div key={s.id} className="admin-row">
              <div className="grow">
                <Text as="div" weight="bold">{s.title || `ชุดที่ ${s.id}`}</Text>
                <Text as="div" color="gray" size="2">{s.subjectName ?? 'ไม่ระบุวิชา'} · {s.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'} · {s.questionCount} ข้อ · มอบหมาย {s.assignedCount}</Text>
              </div>
              <Badge variant="soft">{s.status}</Badge>
              <ConfirmDanger
                label="ลบ"
                title="ลบแบบฝึกหัดนี้?"
                description="จะลบโจทย์ รูปภาพ การมอบหมาย และประวัติการทำของชุดนี้"
                onConfirm={() => runCleanup(`/api/parent/admin/exercise-sets/${s.id}`)}
              />
            </div>
          ))}
          {summary.sets.length === 0 && <Text color="gray">ไม่มีแบบฝึกหัด</Text>}
        </div>
      </Card>

      <Card className="parent-panel">
        <Flex align="center" gap="3" wrap="wrap">
          <div className="grow">
            <Heading as="h3" size="4">ไฟล์ R2</Heading>
            <Text color="gray" size="2">ไฟล์รูปภายใต้บัญชีนี้เท่านั้น ลบเฉพาะไฟล์ที่มั่นใจว่าไม่ใช้แล้ว</Text>
          </div>
          <Button variant="soft" color="gray" onClick={() => loadR2Files(true)} disabled={r2Loading}>
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
              <ConfirmR2Delete file={file} busy={busy} onConfirm={deleteR2File} />
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

      <Card className="parent-panel">
        <Heading as="h3" size="4">เด็กทั้งหมด</Heading>
        <div className="admin-list">
          {summary.children.map((ch) => (
            <div key={ch.id} className="admin-row">
              <span className="child-avatar">{ch.avatar}</span>
              <div className="grow">
                <Text as="div" weight="bold">{ch.name}</Text>
                <Text as="div" color="gray" size="2">{ch.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'} · มอบหมาย {ch.assignedCount} · ทำแล้ว {ch.attemptCount}</Text>
              </div>
              <ConfirmDanger
                label="ลบ"
                title={`ลบ ${ch.name}?`}
                description="จะลบโปรไฟล์เด็ก การมอบหมาย และประวัติการทำทั้งหมดของเด็กคนนี้"
                onConfirm={() => runCleanup(`/api/parent/admin/children/${ch.id}`)}
              />
            </div>
          ))}
          {summary.children.length === 0 && <Text color="gray">ไม่มีโปรไฟล์เด็ก</Text>}
        </div>
      </Card>
    </div>
  );
}
