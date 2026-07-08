import { useEffect, useState } from 'react';
import { AlertDialog, Badge, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { api } from '../../lib/api-client';

interface AdminSummary {
  counts: {
    children: number;
    subjects: number;
    exerciseSets: number;
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function Admin() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get<AdminSummary>('/api/parent/admin/summary').then(setSummary);
  }

  useEffect(load, []);

  async function runCleanup(path: string) {
    setBusy(true);
    try {
      await api.delete(path);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!summary) return <div className="muted">กำลังโหลด...</div>;
  const c = summary.counts;

  return (
    <div className="parent-stack">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">Admin</Heading>
          <Text color="gray" size="2">ดูภาพรวมข้อมูลของบัญชีนี้ และลบข้อมูลที่ไม่ใช้เพื่อลดพื้นที่ฐานข้อมูล/ไฟล์</Text>
        </div>
      </div>

      <div className="stats-grid admin-stats">
        <Card className="stat-card"><div className="stat-value">{c.exerciseSets}</div><Text color="gray" size="2">แบบฝึกหัด</Text></Card>
        <Card className="stat-card"><div className="stat-value">{c.children}</div><Text color="gray" size="2">เด็ก</Text></Card>
        <Card className="stat-card"><div className="stat-value">{c.questions}</div><Text color="gray" size="2">โจทย์</Text></Card>
        <Card className="stat-card"><div className="stat-value">{c.attempts}</div><Text color="gray" size="2">attempts</Text></Card>
        <Card className="stat-card"><div className="stat-value">{c.r2Objects}</div><Text color="gray" size="2">ไฟล์ R2</Text></Card>
        <Card className="stat-card"><div className="stat-value">{formatBytes(c.r2Bytes)}</div><Text color="gray" size="2">storage โดยประมาณ</Text></Card>
      </div>

      <Card className="parent-panel">
        <Flex align="center" gap="3" wrap="wrap">
          <div className="grow">
            <Heading as="h3" size="4">Cleanup</Heading>
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
