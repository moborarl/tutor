import { useCallback, useEffect, useState } from 'react';
import { AlertDialog, Badge, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { ChildProgress as ChildProgressData } from '@shared/types';

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

export default function ChildProgress() {
  const { id } = useParams();
  const [data, setData] = useState<ChildProgressData | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);

  const load = useCallback(() => {
    api.get<ChildProgressData>(`/api/parent/children/${id}/progress`).then(setData);
  }, [id]);

  useEffect(load, [load]);

  async function resetInProgress(exerciseSetId: number) {
    setResettingId(exerciseSetId);
    try {
      await api.post(`/api/parent/children/${id}/exercise-sets/${exerciseSetId}/reset-in-progress`);
      load();
    } catch (err) {
      alert('รีเซ็ตไม่สำเร็จ: ' + String(err));
    } finally {
      setResettingId(null);
    }
  }

  if (!data) return <div className="muted">กำลังโหลด...</div>;

  return (
    <div className="parent-stack">
      <div className="page-heading">
        <div className="child-progress-title">
          <span style={{ fontSize: 44 }}>{data.child.avatar}</span>
          <div>
            <Heading as="h2" size="6">{data.child.name}</Heading>
            <Text color="gray" size="2">{data.child.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'}</Text>
          </div>
        </div>
        <Link to="/parent/children"><Button variant="soft" color="gray">กลับ</Button></Link>
      </div>

      <div className="stats-grid">
        <Card className="stat-card">
          <div style={{ fontSize: 32, fontWeight: 800 }}>{data.totalCompletedAttempts}</div>
          <Text color="gray" size="2">ครั้งที่ทำเสร็จ</Text>
        </Card>
        <Card className="stat-card">
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--green)' }}>{pct(data.averageScore)}</div>
          <Text color="gray" size="2">คะแนนเฉลี่ย</Text>
        </Card>
      </div>

      <Card className="parent-panel">
        <Heading as="h3" size="4">รายชุดแบบฝึกหัด</Heading>
        {data.sets.length === 0 && <Text color="gray">ยังไม่มีแบบฝึกหัดที่มอบหมาย</Text>}
        <div className="progress-set-list">
        {data.sets.map((s) => (
          <div key={s.exerciseSetId} className="progress-set-row">
            <div className="row">
              <div className="grow">
                <Text as="div" weight="bold">{s.title || `ชุดที่ ${s.exerciseSetId}`}</Text>
                <Text as="div" color="gray" size="2">{s.subjectName ?? 'ไม่ระบุวิชา'} · ทำ {s.attemptCount} ครั้ง</Text>
              </div>
              <Text weight="bold" style={{ color: 'var(--green)' }}>{pct(s.bestScore)}</Text>
            </div>
            {s.hasInProgress && (
              <div className="row" style={{ marginTop: 8 }}>
                <Badge color="amber" variant="soft">ทำค้างอยู่</Badge>
                <AlertDialog.Root>
                  <AlertDialog.Trigger>
                    <Button
                      variant="soft"
                      color="gray"
                      disabled={resettingId === s.exerciseSetId}
                      size="1"
                    >
                      {resettingId === s.exerciseSetId ? 'กำลังรีเซ็ต...' : 'รีเซ็ตให้ทำใหม่'}
                    </Button>
                  </AlertDialog.Trigger>
                  <AlertDialog.Content maxWidth="440px">
                    <AlertDialog.Title>ให้เริ่มชุดนี้ใหม่?</AlertDialog.Title>
                    <AlertDialog.Description size="2">
                      จะล้างค่าที่ทำค้างไว้เท่านั้น คะแนนที่เคยทำเสร็จแล้วจะไม่หาย
                    </AlertDialog.Description>
                    <Flex gap="3" justify="end" mt="4">
                      <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
                      <AlertDialog.Action><Button onClick={() => resetInProgress(s.exerciseSetId)}>รีเซ็ต</Button></AlertDialog.Action>
                    </Flex>
                  </AlertDialog.Content>
                </AlertDialog.Root>
              </div>
            )}
            <div className="progress-bar-track" style={{ marginTop: 8 }}>
              <div className="progress-bar-fill" style={{ width: `${(s.bestScore ?? 0) * 100}%` }} />
            </div>
          </div>
        ))}
        </div>
      </Card>

      <Card className="parent-panel">
        <Heading as="h3" size="4">ประวัติล่าสุด</Heading>
        {data.recentAttempts.length === 0 && <Text color="gray">ยังไม่มีประวัติ</Text>}
        {data.recentAttempts.length > 0 && (
          <table className="data">
            <thead>
              <tr><th>ชุด</th><th>คะแนน</th><th>สถานะ</th><th>เมื่อ</th></tr>
            </thead>
            <tbody>
              {data.recentAttempts.map((a) => (
                <tr key={a.attemptId}>
                  <td>{a.exerciseSetTitle}</td>
                  <td>{pct(a.score)}</td>
                  <td>{a.status === 'completed' ? 'เสร็จ' : 'ค้างอยู่'}</td>
                  <td className="muted">{new Date(a.startedAt + 'Z').toLocaleString('th-TH')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
