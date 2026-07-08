import { useEffect, useState } from 'react';
import { AlertDialog, Badge, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { ExerciseSetSummary } from '@shared/types';

const STATUS_TH: Record<string, string> = {
  processing: 'รอคิว Pi',
  extracting: 'AI กำลังแกะโจทย์',
  pending_review: 'รอตรวจ',
  extraction_failed: 'แกะโจทย์ไม่สำเร็จ',
  published: 'เผยแพร่แล้ว',
};

const PROVIDER_TH: Record<string, string> = {
  claude: 'Claude',
  other_cloud: 'Cloud AI สำรอง',
  pi: 'Raspberry Pi',
};

function statusColor(status: string) {
  if (status === 'published') return 'green';
  if (status === 'pending_review') return 'amber';
  if (status === 'processing' || status === 'extracting') return 'blue';
  if (status === 'extraction_failed') return 'red';
  return 'gray';
}

function DeleteSetButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button variant="soft" color="red" disabled={disabled} title="ลบ">ลบ</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>ลบแบบฝึกหัดนี้?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          แบบฝึกหัดและรูปภาพที่เกี่ยวข้องจะถูกลบออกจากบัญชีนี้
        </AlertDialog.Description>
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onConfirm}>ลบ</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

export default function ExerciseList() {
  const nav = useNavigate();
  const [sets, setSets] = useState<ExerciseSetSummary[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);
  const [mergeTitle, setMergeTitle] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    api.get<ExerciseSetSummary[]>('/api/parent/exercise-sets').then(setSets);
    // Poll while any set is still queued/extracting (e.g. waiting on the Pi).
    const t = setInterval(() => {
      api.get<ExerciseSetSummary[]>('/api/parent/exercise-sets').then((data) => {
        setSets(data);
        if (!data.some((s) => s.status === 'processing' || s.status === 'extracting')) {
          clearInterval(t);
        }
      });
    }, 10_000);
    return () => clearInterval(t);
  }, []);

  const handleShare = async (id: number) => {
    setLoading(true);
    try {
      const { token } = await api.post<{ token: string }>(`/api/parent/exercise-sets/${id}/share`);
      setShareUrl(`${window.location.origin}/parent/import/${token}`);
      setShareCopied(false);
    } catch (err) {
      alert('สร้างลิงก์แชร์ไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setLoading(true);
    try {
      await api.delete(`/api/parent/exercise-sets/${id}`);
      setSets(sets.filter((s) => s.id !== id));
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (id: number, newTitle: string) => {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      await api.patch(`/api/parent/exercise-sets/${id}`, { title: newTitle.trim() });
      setSets(sets.map((s) => (s.id === id ? { ...s, title: newTitle.trim() } : s)));
      setEditingId(null);
    } catch (err) {
      alert('เปลี่ยนชื่อไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (s: ExerciseSetSummary) => {
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const toggleSelected = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const openMerge = () => {
    const firstTitle = sets.find((s) => s.id === Math.min(...selected))?.title ?? '';
    setMergeTitle(firstTitle ? `${firstTitle} (รวม)` : '');
    setMerging(true);
  };

  const confirmMerge = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ id: number }>('/api/parent/exercise-sets/merge', {
        setIds: [...selected],
        title: mergeTitle,
      });
      setMerging(false);
      setSelected(new Set());
      nav(`/parent/exercises/${res.id}`);
    } catch (err) {
      alert('รวมชุดไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="parent-stack">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">แบบฝึกหัด</Heading>
          <Text color="gray" size="2">จัดการชุดโจทย์ ตรวจ อนุมัติ แชร์ และมอบหมายให้ลูก</Text>
        </div>
        <Link to="/parent/upload"><Button>อัปโหลด / สร้างใหม่</Button></Link>
      </div>

      {selected.size >= 2 && (
        <Card className="selection-bar">
          <Flex align="center" gap="3" wrap="wrap">
            <Text className="grow" weight="medium">เลือก {selected.size} ชุด</Text>
            <Button onClick={openMerge} disabled={loading}>รวมชุด</Button>
          </Flex>
        </Card>
      )}

      {merging && (
        <Card className="parent-panel">
          <Heading as="h3" size="4">รวม {selected.size} ชุดเป็นชุดเดียว</Heading>
          <Text as="p" color="gray" size="2">โจทย์และรูปทุกหน้าจะถูกรวมกัน สถานะจะกลับเป็น "รอตรวจ" ให้ตรวจซ้ำก่อนเผยแพร่</Text>
          <input
            placeholder="ชื่อชุดที่รวมแล้ว"
            value={mergeTitle}
            onChange={(e) => setMergeTitle(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <Flex gap="2" wrap="wrap">
            <Button onClick={confirmMerge} disabled={loading}>ยืนยันรวมชุด</Button>
            <Button variant="soft" color="gray" onClick={() => setMerging(false)} disabled={loading}>ยกเลิก</Button>
          </Flex>
        </Card>
      )}

      {shareUrl && (
        <Card className="parent-panel">
          <Heading as="h3" size="4">ลิงก์แชร์แบบฝึกหัด</Heading>
          <Text as="p" color="gray" size="2">ส่งลิงก์นี้ให้ผู้ปกครองคนอื่น เขาจะคัดลอกแบบฝึกหัดเข้าคลังของตัวเองได้</Text>
          <div className="row">
            <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
            <Button
              onClick={async () => { await navigator.clipboard.writeText(shareUrl); setShareCopied(true); }}
            >
              {shareCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}
            </Button>
            <Button variant="soft" color="gray" onClick={() => setShareUrl(null)}>ปิด</Button>
          </div>
        </Card>
      )}

      {sets.length === 0 && (
        <Card><Text color="gray">ยังไม่มีแบบฝึกหัด อัปโหลดรูปถ่ายแบบฝึกหัดเพื่อเริ่มต้น</Text></Card>
      )}

      <div className="exercise-list">
        {sets.map((s) => (
        <div key={s.id} className="exercise-list-item">
          {editingId === s.id ? (
            <Card className="exercise-card">
              <div className="row" style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="ชื่อแบบฝึกหัด"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button onClick={() => handleRename(s.id, editTitle)} disabled={loading}>
                  บันทึก
                </Button>
                <Button variant="soft" color="gray" onClick={() => setEditingId(null)} disabled={loading}>
                  ยกเลิก
                </Button>
              </div>
            </Card>
          ) : (
            // Checkbox and action buttons are siblings of the Link, not nested inside
            // it — nesting a checkbox inside an <a> is unreliable on touch devices
            // (iPad Safari can still navigate on tap even with stopPropagation), so
            // keeping them fully outside removes any ambiguity.
            <Card className="exercise-card">
              <div className="exercise-card-row">
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggleSelected(s.id)}
                disabled={loading}
                style={{ width: 22, height: 22, cursor: 'pointer', flexShrink: 0 }}
              />
              <Link
                to={`/parent/exercises/${s.id}`}
                className="grow"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div>
                  <Text as="div" weight="bold">{s.title || `ชุดที่ ${s.id}`}</Text>
                  <Text as="div" color="gray" size="2">
                    {s.subjectName ?? 'ไม่ระบุวิชา'} · {s.questionCount} ข้อ ·{' '}
                    {s.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'}
                    {s.extractionProvider && ` · แกะโดย ${PROVIDER_TH[s.extractionProvider]}`}
                  </Text>
                </div>
              </Link>
              <Badge color={statusColor(s.status)} variant="soft">
                {STATUS_TH[s.status] ?? s.status}
              </Badge>
              <div className="exercise-actions">
                <Button
                  variant="soft"
                  color="gray"
                  onClick={() => handleShare(s.id)}
                  disabled={loading}
                  title="แชร์"
                >
                  แชร์
                </Button>
                <Button
                  variant="soft"
                  color="gray"
                  onClick={() => startEdit(s)}
                  disabled={loading}
                  title="เปลี่ยนชื่อ"
                >
                  แก้ชื่อ
                </Button>
                <DeleteSetButton disabled={loading} onConfirm={() => handleDelete(s.id)} />
              </div>
              </div>
            </Card>
          )}
        </div>
        ))}
      </div>
    </div>
  );
}
