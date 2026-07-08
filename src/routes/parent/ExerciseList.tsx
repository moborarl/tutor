import { useEffect, useState } from 'react';
import { AlertDialog, Badge, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { AgeBand, ExerciseSetSummary, Subject } from '@shared/types';

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

const PAGE_SIZE = 20;

function statusColor(status: string) {
  if (status === 'published') return 'green';
  if (status === 'pending_review') return 'amber';
  if (status === 'processing' || status === 'extracting') return 'blue';
  if (status === 'extraction_failed') return 'red';
  return 'gray';
}

function ArchiveSetButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button variant="soft" color="red" disabled={disabled} title="เก็บเข้าคลัง">เก็บเข้าคลัง</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>เก็บแบบฝึกหัดนี้เข้าคลัง?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          แบบฝึกหัดจะหายจากหน้าจัดการและเด็กจะไม่เห็นอีก แต่ข้อมูลเดิมยังอยู่ให้ล้างถาวรได้จากหน้า Admin
        </AlertDialog.Description>
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onConfirm}>เก็บเข้าคลัง</Button></AlertDialog.Action>
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterAgeBand, setFilterAgeBand] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState('subject');
  const [page, setPage] = useState(1);
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editAgeBand, setEditAgeBand] = useState<AgeBand>('young');

  useEffect(() => {
    api.get<ExerciseSetSummary[]>('/api/parent/exercise-sets').then(setSets);
    api.get<Subject[]>('/api/parent/subjects').then(setSubjects);
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
      alert('เก็บเข้าคลังไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (id: number, newTitle: string) => {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      const nextSubjectId = editSubjectId ? Number(editSubjectId) : null;
      await api.patch(`/api/parent/exercise-sets/${id}`, { title: newTitle.trim(), subjectId: nextSubjectId, ageBand: editAgeBand });
      setSets(sets.map((s) => (s.id === id ? {
        ...s,
        title: newTitle.trim(),
        subjectId: nextSubjectId,
        subjectName: subjects.find((sub) => sub.id === nextSubjectId)?.name ?? null,
        ageBand: editAgeBand,
      } : s)));
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
    setEditSubjectId(s.subjectId == null ? '' : String(s.subjectId));
    setEditAgeBand(s.ageBand);
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

  const filteredSets = sets.filter((s) => {
    const q = query.trim().toLowerCase();
    if (q && !`${s.title} ${s.subjectName ?? ''}`.toLowerCase().includes(q)) return false;
    if (filterSubject === 'none' && s.subjectId != null) return false;
    if (filterSubject && filterSubject !== 'none' && String(s.subjectId ?? '') !== filterSubject) return false;
    if (filterAgeBand && s.ageBand !== filterAgeBand) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });
  const sortedSets = [...filteredSets].sort((a, b) => {
    if (sortMode === 'title') return (a.title || '').localeCompare(b.title || '', 'th');
    if (sortMode === 'status') return a.status.localeCompare(b.status) || (a.title || '').localeCompare(b.title || '', 'th');
    if (sortMode === 'newest') return String(b.createdAt).localeCompare(String(a.createdAt));
    return (a.subjectName ?? 'ไม่ระบุวิชา').localeCompare(b.subjectName ?? 'ไม่ระบุวิชา', 'th')
      || a.ageBand.localeCompare(b.ageBand)
      || String(b.createdAt).localeCompare(String(a.createdAt));
  });
  const totalPages = Math.max(1, Math.ceil(sortedSets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSets = sortedSets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const subjectSummary = [...sets.reduce((map, s) => {
    const name = s.subjectName ?? 'ไม่ระบุวิชา';
    const existing = map.get(name) ?? { subjectName: name, young: 0, older: 0, total: 0 };
    existing[s.ageBand] += 1;
    existing.total += 1;
    map.set(name, existing);
    return map;
  }, new Map<string, { subjectName: string; young: number; older: number; total: number }>()).values()]
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'th'));
  const groupedSets = [...pagedSets.reduce((map, s) => {
    const name = s.subjectName ?? 'ไม่ระบุวิชา';
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(s);
    return map;
  }, new Map<string, ExerciseSetSummary[]>()).entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'th'));

  return (
    <div className="parent-stack">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">แบบฝึกหัด</Heading>
          <Text color="gray" size="2">จัดการชุดโจทย์ ตรวจ อนุมัติ แชร์ และมอบหมายให้เด็ก</Text>
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

      {sets.length > 0 && (
        <Card className="subject-summary-panel">
          <Heading as="h3" size="4">สรุปตามวิชา</Heading>
          <div className="subject-summary-grid">
            {subjectSummary.map((s) => (
              <div key={s.subjectName} className="subject-summary-card">
                <Text as="div" weight="bold">{s.subjectName}</Text>
                <Text as="div" color="gray" size="2">รวม {s.total} ชุด</Text>
                <div className="subject-summary-counts">
                  <Badge color="blue" variant="soft">เด็กเล็ก {s.young}</Badge>
                  <Badge color="green" variant="soft">เด็กโต {s.older}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {sets.length > 0 && (
        <Card className="management-filters">
          <input placeholder="ค้นหาชื่อหรือวิชา" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
          <select value={filterSubject} onChange={(e) => { setFilterSubject(e.target.value); setPage(1); }}>
            <option value="">ทุกวิชา</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="none">ไม่ระบุวิชา</option>
          </select>
          <select value={filterAgeBand} onChange={(e) => { setFilterAgeBand(e.target.value); setPage(1); }}>
            <option value="">ทุกวัย</option>
            <option value="young">เด็กเล็ก</option>
            <option value="older">เด็กโต</option>
          </select>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">ทุกสถานะ</option>
            {Object.entries(STATUS_TH).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={sortMode} onChange={(e) => { setSortMode(e.target.value); setPage(1); }}>
            <option value="subject">เรียงตามวิชา</option>
            <option value="newest">ล่าสุดก่อน</option>
            <option value="title">ชื่อ ก-ฮ</option>
            <option value="status">สถานะ</option>
          </select>
          <Button variant="soft" color="gray" onClick={() => { setQuery(''); setFilterSubject(''); setFilterAgeBand(''); setFilterStatus(''); setSortMode('subject'); setPage(1); }}>
            ล้างตัวกรอง
          </Button>
        </Card>
      )}

      {sets.length > 0 && (
        <Card className="list-toolbar">
          <Text color="gray" size="2" className="grow">
            แสดง {pagedSets.length === 0 ? 0 : ((safePage - 1) * PAGE_SIZE) + 1}-{Math.min(safePage * PAGE_SIZE, sortedSets.length)} จาก {sortedSets.length} ชุด
          </Text>
          <Button variant="soft" color="gray" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>ก่อนหน้า</Button>
          <Text size="2">หน้า {safePage}/{totalPages}</Text>
          <Button variant="soft" color="gray" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>ถัดไป</Button>
        </Card>
      )}

      <div className="exercise-list">
        {groupedSets.map(([subjectName, subjectSets]) => (
        <div key={subjectName} className="subject-group">
          <Heading as="h3" size="4">{subjectName}</Heading>
          {subjectSets.map((s) => (
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
                <select value={editSubjectId} onChange={(e) => setEditSubjectId(e.target.value)}>
                  <option value="">ไม่ระบุวิชา</option>
                  {subjects.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
                <select value={editAgeBand} onChange={(e) => setEditAgeBand(e.target.value as AgeBand)}>
                  <option value="young">เด็กเล็ก</option>
                  <option value="older">เด็กโต</option>
                </select>
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
                <ArchiveSetButton disabled={loading} onConfirm={() => handleDelete(s.id)} />
              </div>
              </div>
            </Card>
          )}
          </div>
          ))}
        </div>
        ))}
        {sets.length > 0 && sortedSets.length === 0 && (
          <Card><Text color="gray">ไม่พบแบบฝึกหัดตามตัวกรองนี้</Text></Card>
        )}
      </div>
    </div>
  );
}
