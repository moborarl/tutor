import { useEffect, useMemo, useState } from 'react';
import { AlertDialog, Badge, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { ExplorerLayout } from '../../components/ExplorerLayout';
import { TreePanel, type TreeNodeItem } from '../../components/TreePanel';
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

type ExerciseNode =
  | { kind: 'subject'; subjectName: string }
  | { kind: 'age'; subjectName: string; ageBand: AgeBand };

function nodeId(node: ExerciseNode) {
  if (node.kind === 'subject') return `subject:${node.subjectName}`;
  return `age:${node.subjectName}:${node.ageBand}`;
}

function parseNode(id: string): ExerciseNode {
  const [kind, subjectName, ageBand] = id.split(':');
  if (kind === 'age') return { kind: 'age', subjectName, ageBand: ageBand as AgeBand };
  return { kind: 'subject', subjectName };
}

function ageBandLabel(ageBand: AgeBand) {
  return ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต';
}

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
        <Button variant="soft" color="red" disabled={disabled}>เก็บเข้าคลัง</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>เก็บแบบฝึกหัดนี้เข้าคลัง?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          แบบฝึกหัดจะหายจากหน้าจัดการและเด็กจะไม่เห็นอีก แต่ข้อมูลเดิมยังอยู่ให้ล้างถาวรได้จากหน้าดูแลข้อมูล
        </AlertDialog.Description>
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onConfirm}>เก็บเข้าคลัง</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

function DeleteSubjectButton({
  disabled,
  subjectName,
  setCount,
  onConfirm,
}: {
  disabled: boolean;
  subjectName: string;
  setCount: number;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button variant="soft" color="red" disabled={disabled}>ลบวิชา</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="440px">
        <AlertDialog.Title>ลบวิชา "{subjectName}"?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          วิชานี้จะถูกลบออกจาก tree แต่แบบฝึกหัด {setCount} ชุดจะยังอยู่ และถูกย้ายไปอยู่กลุ่ม "ไม่ระบุวิชา"
        </AlertDialog.Description>
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onConfirm}>ลบวิชา</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

function SubjectCreateForm({
  value,
  loading,
  compact = false,
  onChange,
  onCreate,
}: {
  value: string;
  loading: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className={compact ? 'subject-create-mini compact' : 'subject-create-mini'}>
      {!compact && (
        <div>
          <Text as="div" size="2" weight="bold">สร้างวิชา</Text>
          <Text as="div" size="1" color="gray">เพิ่มโฟลเดอร์วิชาใหม่ในคลังแบบฝึกหัด</Text>
        </div>
      )}
      <div className="inline-create-row">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCreate();
            }
          }}
          placeholder="สร้างวิชา เช่น คณิตศาสตร์"
        />
        <Button type="button" variant={compact ? 'solid' : 'soft'} onClick={onCreate} disabled={loading || !value.trim()}>
          สร้างวิชา
        </Button>
      </div>
    </div>
  );
}

export default function ExerciseList() {
  const nav = useNavigate();
  const [sets, setSets] = useState<ExerciseSetSummary[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeId, setActiveId] = useState('subject:ทั้งหมด');
  const [activeSetId, setActiveSetId] = useState<number | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editAgeBand, setEditAgeBand] = useState<AgeBand>('young');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);
  const [mergeTitle, setMergeTitle] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  function loadSets() {
    api.get<ExerciseSetSummary[]>('/api/parent/exercise-sets')
      .then((data) => {
        setSets(data);
        setSelected((current) => new Set([...current].filter((id) => data.some((set) => set.id === id))));
      })
      .catch(() => setListError('โหลดรายการแบบฝึกหัดไม่สำเร็จ'))
      .finally(() => setListLoading(false));
  }

  useEffect(() => {
    loadSets();
    api.get<Subject[]>('/api/parent/subjects').then(setSubjects);
    const t = setInterval(() => {
      api.get<ExerciseSetSummary[]>('/api/parent/exercise-sets').then((data) => {
        setSets(data);
        if (!data.some((s) => s.status === 'processing' || s.status === 'extracting')) clearInterval(t);
      });
    }, 10_000);
    return () => clearInterval(t);
  }, []);

  const subjectGroups = useMemo(() => {
    const map = new Map<string, { subjectName: string; young: ExerciseSetSummary[]; older: ExerciseSetSummary[] }>();
    for (const set of sets) {
      const subjectName = set.subjectName ?? 'ไม่ระบุวิชา';
      const group = map.get(subjectName) ?? { subjectName, young: [], older: [] };
      group[set.ageBand].push(set);
      map.set(subjectName, group);
    }
    const names = new Set([...subjects.map((s) => s.name), ...map.keys()]);
    return [...names].map((subjectName) => map.get(subjectName) ?? { subjectName, young: [], older: [] })
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'th'));
  }, [sets, subjects]);

  const treeItems = useMemo<TreeNodeItem[]>(() => {
    const items: TreeNodeItem[] = [{ id: 'subject:ทั้งหมด', label: 'ทั้งหมด', icon: '▣', count: sets.length }];
    for (const group of subjectGroups) {
      items.push({ id: nodeId({ kind: 'subject', subjectName: group.subjectName }), label: group.subjectName, icon: '▸', count: group.young.length + group.older.length });
      items.push({ id: nodeId({ kind: 'age', subjectName: group.subjectName, ageBand: 'young' }), label: 'เด็กเล็ก', icon: '•', count: group.young.length, depth: 1 });
      items.push({ id: nodeId({ kind: 'age', subjectName: group.subjectName, ageBand: 'older' }), label: 'เด็กโต', icon: '•', count: group.older.length, depth: 1 });
    }
    return items;
  }, [sets, subjectGroups]);

  const activeNode = parseNode(activeId);
  const activeSet = activeSetId == null ? null : sets.find((set) => set.id === activeSetId) ?? null;
  const activeSubject = activeNode.kind === 'subject'
    ? subjects.find((subject) => subject.name === activeNode.subjectName) ?? null
    : null;
  const visibleSets = useMemo(() => {
    if (activeNode.kind === 'subject') {
      if (activeNode.subjectName === 'ทั้งหมด') return sets;
      return sets.filter((set) => (set.subjectName ?? 'ไม่ระบุวิชา') === activeNode.subjectName);
    }
    return sets.filter((set) => (set.subjectName ?? 'ไม่ระบุวิชา') === activeNode.subjectName && set.ageBand === activeNode.ageBand);
  }, [activeNode, sets]);

  const summary = {
    total: visibleSets.length,
    young: visibleSets.filter((set) => set.ageBand === 'young').length,
    older: visibleSets.filter((set) => set.ageBand === 'older').length,
    published: visibleSets.filter((set) => set.status === 'published').length,
    review: visibleSets.filter((set) => set.status === 'pending_review').length,
  };

  const toggleSelected = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openMerge = () => {
    const firstTitle = sets.find((s) => s.id === Math.min(...selected))?.title ?? '';
    setMergeTitle(firstTitle ? `${firstTitle} (รวม)` : '');
    setMerging(true);
  };

  async function confirmMerge() {
    setLoading(true);
    try {
      const res = await api.post<{ id: number }>('/api/parent/exercise-sets/merge', { setIds: [...selected], title: mergeTitle });
      setMerging(false);
      setSelected(new Set());
      nav(`/parent/exercises/${res.id}`);
    } catch (err) {
      alert('รวมชุดไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleShare(id: number) {
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
  }

  async function handleDelete(id: number) {
    setLoading(true);
    try {
      await api.delete(`/api/parent/exercise-sets/${id}`);
      setSets((current) => current.filter((set) => set.id !== id));
      setActiveId('subject:ทั้งหมด');
      setActiveSetId(null);
    } catch (err) {
      alert('เก็บเข้าคลังไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  }

  async function publishSet(id: number) {
    setLoading(true);
    try {
      await api.post(`/api/parent/exercise-sets/${id}/publish`);
      loadSets();
    } catch (err) {
      alert('เผยแพร่ไม่สำเร็จ: ต้องอนุมัติทุกข้อก่อน');
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(id: number, newTitle: string) {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      const nextSubjectId = editSubjectId ? Number(editSubjectId) : null;
      await api.patch(`/api/parent/exercise-sets/${id}`, { title: newTitle.trim(), subjectId: nextSubjectId, ageBand: editAgeBand });
      setSets((current) => current.map((s) => (s.id === id ? {
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
  }

  function startEdit(set: ExerciseSetSummary) {
    setEditingId(set.id);
    setEditTitle(set.title);
    setEditSubjectId(set.subjectId == null ? '' : String(set.subjectId));
    setEditAgeBand(set.ageBand);
  }

  async function createSubject() {
    const name = newSubjectName.trim();
    if (!name) return;
    setLoading(true);
    try {
      const created = await api.post<Subject>('/api/parent/subjects', { name });
      setSubjects((current) => {
        if (current.some((subject) => subject.id === created.id || subject.name === created.name)) return current;
        return [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'th'));
      });
      setActiveId(nodeId({ kind: 'subject', subjectName: created.name }));
      setActiveSetId(null);
      setNewSubjectName('');
    } catch (err) {
      alert('สร้างวิชาไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteSubject(subject: Subject) {
    setLoading(true);
    try {
      await api.delete(`/api/parent/subjects/${subject.id}`);
      setSubjects((current) => current.filter((item) => item.id !== subject.id));
      setSets((current) => current.map((set) => (
        set.subjectId === subject.id ? { ...set, subjectId: null, subjectName: null } : set
      )));
      setActiveId('subject:ทั้งหมด');
      setActiveSetId(null);
    } catch (err) {
      alert('ลบวิชาไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="parent-stack">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">แบบฝึกหัด</Heading>
          <Text color="gray" size="2">จัดการเป็นโฟลเดอร์ วิชา &gt; เด็กเล็ก/เด็กโต &gt; แบบฝึกหัด</Text>
        </div>
        <div className="page-actions">
          <SubjectCreateForm
            compact
            value={newSubjectName}
            loading={loading}
            onChange={setNewSubjectName}
            onCreate={createSubject}
          />
          <Link to="/parent/upload"><Button>อัปโหลด / สร้างใหม่</Button></Link>
        </div>
      </div>

      {listLoading && (
        <Card className="parent-panel"><Flex align="center" gap="3"><div className="state-spinner" /><Text color="gray">กำลังโหลดแบบฝึกหัด...</Text></Flex></Card>
      )}
      {listError && <Card className="parent-panel"><Text color="red">{listError}</Text></Card>}

      {!listLoading && sets.length === 0 && subjects.length === 0 && (
        <Card className="parent-panel empty-state-panel">
          <Heading as="h3" size="4">ยังไม่มีแบบฝึกหัด</Heading>
          <Text color="gray">อัปโหลดรูปถ่ายหรือวาง JSON เพื่อสร้างชุดแรก</Text>
          <SubjectCreateForm value={newSubjectName} loading={loading} onChange={setNewSubjectName} onCreate={createSubject} />
          <Link to="/parent/upload"><Button style={{ marginTop: 12 }}>อัปโหลด / สร้างใหม่</Button></Link>
        </Card>
      )}

      {(sets.length > 0 || subjects.length > 0) && (
        <ExplorerLayout
          tree={(
            <>
              <TreePanel label="คลังแบบฝึกหัด" items={treeItems} activeId={activeId} onSelect={(id) => { setActiveId(id); setActiveSetId(null); }} />
              <SubjectCreateForm value={newSubjectName} loading={loading} onChange={setNewSubjectName} onCreate={createSubject} />
            </>
          )}
        >
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
              <Text as="p" color="gray" size="2">โจทย์และรูปทุกหน้าจะถูกรวมกัน สถานะจะกลับเป็น "รอตรวจ"</Text>
              <input placeholder="ชื่อชุดที่รวมแล้ว" value={mergeTitle} onChange={(e) => setMergeTitle(e.target.value)} style={{ marginBottom: 12 }} />
              <Flex gap="2" wrap="wrap">
                <Button onClick={confirmMerge} disabled={loading}>ยืนยันรวมชุด</Button>
                <Button variant="soft" color="gray" onClick={() => setMerging(false)} disabled={loading}>ยกเลิก</Button>
              </Flex>
            </Card>
          )}

          {shareUrl && (
            <Card className="parent-panel">
              <Heading as="h3" size="4">ลิงก์แชร์แบบฝึกหัด</Heading>
              <div className="row">
                <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
                <Button onClick={async () => { await navigator.clipboard.writeText(shareUrl); setShareCopied(true); }}>{shareCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}</Button>
                <Button variant="soft" color="gray" onClick={() => setShareUrl(null)}>ปิด</Button>
              </div>
            </Card>
          )}

          {!activeSet && (
            <>
              <Card className="parent-panel">
                <Flex align="start" justify="between" gap="3" wrap="wrap">
                  <Heading as="h3" size="4">
                    {activeNode.kind === 'subject'
                      ? activeNode.subjectName
                      : `${activeNode.subjectName} · ${ageBandLabel(activeNode.ageBand)}`}
                  </Heading>
                  {activeSubject && (
                    <DeleteSubjectButton
                      disabled={loading}
                      subjectName={activeSubject.name}
                      setCount={visibleSets.length}
                      onConfirm={() => deleteSubject(activeSubject)}
                    />
                  )}
                </Flex>
                <div className="stats-grid admin-stats" style={{ marginTop: 12 }}>
                  <Card className="stat-card"><div className="stat-value">{summary.total}</div><Text color="gray" size="2">ทั้งหมด</Text></Card>
                  <Card className="stat-card"><div className="stat-value">{summary.young}</div><Text color="gray" size="2">เด็กเล็ก</Text></Card>
                  <Card className="stat-card"><div className="stat-value">{summary.older}</div><Text color="gray" size="2">เด็กโต</Text></Card>
                  <Card className="stat-card"><div className="stat-value">{summary.published}</div><Text color="gray" size="2">เผยแพร่แล้ว</Text></Card>
                  <Card className="stat-card"><div className="stat-value">{summary.review}</div><Text color="gray" size="2">รอตรวจ</Text></Card>
                </div>
              </Card>
              <ExerciseRows
                sets={visibleSets}
                selected={selected}
                loading={loading}
                onToggle={toggleSelected}
                onOpen={setActiveSetId}
              />
            </>
          )}

          {activeSet && (
            <Card className="parent-panel">
              {editingId === activeSet.id ? (
                <div className="stack-form">
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="ชื่อแบบฝึกหัด" />
                  <select value={editSubjectId} onChange={(e) => setEditSubjectId(e.target.value)}>
                    <option value="">ไม่ระบุวิชา</option>
                    {subjects.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                  </select>
                  <select value={editAgeBand} onChange={(e) => setEditAgeBand(e.target.value as AgeBand)}>
                    <option value="young">เด็กเล็ก</option>
                    <option value="older">เด็กโต</option>
                  </select>
                  <Flex gap="2" wrap="wrap">
                    <Button onClick={() => handleRename(activeSet.id, editTitle)} disabled={loading}>บันทึก</Button>
                    <Button variant="soft" color="gray" onClick={() => setEditingId(null)} disabled={loading}>ยกเลิก</Button>
                  </Flex>
                </div>
              ) : (
                <div className="workspace-stack">
                  <div>
                    <Badge color={statusColor(activeSet.status)} variant="soft">{STATUS_TH[activeSet.status] ?? activeSet.status}</Badge>
                    <Heading as="h3" size="5" style={{ marginTop: 10 }}>{activeSet.title || `ชุดที่ ${activeSet.id}`}</Heading>
                    <Text color="gray" size="2">
                      {activeSet.subjectName ?? 'ไม่ระบุวิชา'} · {ageBandLabel(activeSet.ageBand)} · {activeSet.questionCount} ข้อ
                      {activeSet.extractionProvider && ` · แกะโดย ${PROVIDER_TH[activeSet.extractionProvider]}`}
                    </Text>
                  </div>
                  <Flex gap="2" wrap="wrap">
                    <Link to={`/parent/exercises/${activeSet.id}`}><Button>ตรวจ/แก้ไข</Button></Link>
                    <Button variant="soft" color="green" onClick={() => publishSet(activeSet.id)} disabled={loading || activeSet.status !== 'pending_review'}>เผยแพร่</Button>
                    <Button variant="soft" color="gray" onClick={() => startEdit(activeSet)} disabled={loading}>แก้ข้อมูล</Button>
                    <Button variant="soft" color="gray" onClick={() => handleShare(activeSet.id)} disabled={loading}>แชร์</Button>
                    <Link to={`/parent/exercises/${activeSet.id}/teacher`}><Button variant="soft" color="gray">ฉบับเฉลย</Button></Link>
                    <Link to={`/parent/exercises/${activeSet.id}/student`}><Button variant="soft" color="gray">ฉบับเด็ก</Button></Link>
                    <ArchiveSetButton disabled={loading} onConfirm={() => handleDelete(activeSet.id)} />
                  </Flex>
                </div>
              )}
            </Card>
          )}
        </ExplorerLayout>
      )}
    </div>
  );
}

function ExerciseRows({
  sets,
  selected,
  loading,
  onToggle,
  onOpen,
}: {
  sets: ExerciseSetSummary[];
  selected: Set<number>;
  loading: boolean;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
}) {
  return (
    <Card className="parent-panel">
      <Heading as="h3" size="4">รายการแบบฝึกหัด</Heading>
      <div className="admin-list selectable-list">
        {sets.map((set) => (
          <div key={set.id} className={`admin-row selectable-row ${selected.has(set.id) ? 'selected' : ''}`}>
            <input className="compact-checkbox" type="checkbox" checked={selected.has(set.id)} onChange={() => onToggle(set.id)} disabled={loading} />
            <button type="button" className="plain-row-button" onClick={() => onOpen(set.id)}>
              <Text as="div" weight="bold">{set.title || `ชุดที่ ${set.id}`}</Text>
              <Text as="div" color="gray" size="2">{set.subjectName ?? 'ไม่ระบุวิชา'} · {ageBandLabel(set.ageBand)} · {set.questionCount} ข้อ</Text>
            </button>
            <Badge color={statusColor(set.status)} variant="soft">{STATUS_TH[set.status] ?? set.status}</Badge>
          </div>
        ))}
        {sets.length === 0 && <Text color="gray">ไม่มีแบบฝึกหัดในกลุ่มนี้</Text>}
      </div>
    </Card>
  );
}
