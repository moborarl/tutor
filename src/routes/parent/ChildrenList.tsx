import { useEffect, useMemo, useState } from 'react';
import { AlertDialog, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { api } from '../../lib/api-client';
import { ChildAvatar, CHILD_AVATAR_OPTIONS } from '../../components/ChildAvatar';
import { ExplorerLayout } from '../../components/ExplorerLayout';
import { TreePanel, type TreeNodeItem } from '../../components/TreePanel';
import type { Child, AgeBand, ChildProgress as ChildProgressData } from '@shared/types';

type ChildNode =
  | { kind: 'home' }
  | { kind: 'child'; childId: number; view: 'progress' | 'assigned' | 'settings' };

function nodeId(node: ChildNode) {
  if (node.kind === 'home') return 'home';
  return `child:${node.childId}:${node.view}`;
}

function parseNode(id: string): ChildNode {
  if (id === 'home') return { kind: 'home' };
  const [, childId, view] = id.split(':');
  return { kind: 'child', childId: Number(childId), view: view as 'progress' | 'assigned' | 'settings' };
}

function ageBandLabel(value: string) {
  return value === 'young' ? 'เด็กเล็ก' : 'เด็กโต';
}

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

function completion(done: number, total: number): number {
  return total <= 0 ? 0 : Math.round((done / total) * 100);
}

export default function ChildrenList() {
  const [children, setChildren] = useState<Child[]>([]);
  const [activeId, setActiveId] = useState('home');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progressCache, setProgressCache] = useState<Record<number, ChildProgressData>>({});

  function load() {
    api.get<Child[]>('/api/parent/children').then((rows) => {
      setChildren(rows);
      setSelected((current) => new Set([...current].filter((id) => rows.some((child) => child.id === id))));
      if (rows.length > 0 && activeId === 'home') setActiveId(nodeId({ kind: 'child', childId: rows[0].id, view: 'progress' }));
    });
  }
  useEffect(load, []);

  const activeNode = parseNode(activeId);
  const activeChild = activeNode.kind === 'child' ? children.find((child) => child.id === activeNode.childId) ?? null : null;
  const activeProgress = activeChild ? progressCache[activeChild.id] : null;

  useEffect(() => {
    if (!activeChild || progressCache[activeChild.id]) return;
    api.get<ChildProgressData>(`/api/parent/children/${activeChild.id}/progress`)
      .then((data) => setProgressCache((cache) => ({ ...cache, [activeChild.id]: data })));
  }, [activeChild, progressCache]);

  const treeItems = useMemo<TreeNodeItem[]>(() => {
    const items: TreeNodeItem[] = [{ id: 'home', label: 'สมาชิกครอบครัว', icon: '⌂', count: children.length }];
    for (const child of children) {
      items.push({ id: nodeId({ kind: 'child', childId: child.id, view: 'progress' }), label: child.name, icon: '•', count: progressCache[child.id]?.sets.length });
      items.push({ id: nodeId({ kind: 'child', childId: child.id, view: 'progress' }), label: 'ความคืบหน้า', icon: '▸', depth: 1 });
      items.push({ id: nodeId({ kind: 'child', childId: child.id, view: 'assigned' }), label: 'แบบฝึกหัดที่มอบหมาย', icon: '▸', depth: 1 });
      items.push({ id: nodeId({ kind: 'child', childId: child.id, view: 'settings' }), label: 'ตั้งค่าโปรไฟล์', icon: '▸', depth: 1 });
    }
    return items;
  }, [children, progressCache]);

  const toggleSelected = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function deleteChild(id: number) {
    setLoading(true);
    try {
      await api.delete(`/api/parent/children/${id}`);
      setProgressCache((cache) => {
        const next = { ...cache };
        delete next[id];
        return next;
      });
      setActiveId('home');
      load();
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      await Promise.all([...selected].map((id) => api.delete(`/api/parent/children/${id}`)));
      setSelected(new Set());
      setActiveId('home');
      setProgressCache({});
      load();
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="parent-stack">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">เด็ก</Heading>
          <Text color="gray" size="2">จัดการสมาชิกครอบครัว ความคืบหน้า แบบฝึกหัดที่มอบหมาย และโปรไฟล์</Text>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>เพิ่มเด็ก</Button>
      </div>

      {children.length === 0 && !showForm && (
        <Card className="parent-panel"><Text color="gray">ยังไม่มีโปรไฟล์เด็ก กด “เพิ่มเด็ก” เพื่อเริ่มต้น</Text></Card>
      )}

      {children.length > 0 && (
        <ExplorerLayout tree={<TreePanel label="สมาชิกครอบครัว" items={treeItems} activeId={activeId} onSelect={setActiveId} />}>
          {selected.size > 0 && (
            <Card className="selection-bar">
              <Flex align="center" gap="3" wrap="wrap">
                <Text className="grow" weight="medium">เลือก {selected.size} คน</Text>
                <AlertDialog.Root>
                  <AlertDialog.Trigger><Button color="red" variant="soft" disabled={loading}>ลบที่เลือก</Button></AlertDialog.Trigger>
                  <AlertDialog.Content maxWidth="420px">
                    <AlertDialog.Title>ลบ {selected.size} โปรไฟล์?</AlertDialog.Title>
                    <AlertDialog.Description size="2">ข้อมูลความก้าวหน้าของโปรไฟล์ที่เลือกจะถูกลบด้วย</AlertDialog.Description>
                    <Flex gap="3" justify="end" mt="4">
                      <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
                      <AlertDialog.Action><Button color="red" onClick={deleteSelected}>ลบ</Button></AlertDialog.Action>
                    </Flex>
                  </AlertDialog.Content>
                </AlertDialog.Root>
              </Flex>
            </Card>
          )}

          {activeNode.kind === 'home' && (
            <Card className="parent-panel">
              <Heading as="h3" size="4">สมาชิกครอบครัว</Heading>
              <div className="children-explorer-list">
                {children.map((child) => (
                  <div key={child.id} className="child-explorer-row">
                    <input className="compact-checkbox" type="checkbox" checked={selected.has(child.id)} onChange={() => toggleSelected(child.id)} disabled={loading} />
                    <ChildAvatar child={child} />
                    <button className="plain-row-button" type="button" onClick={() => setActiveId(nodeId({ kind: 'child', childId: child.id, view: 'progress' }))}>
                      <Text as="div" weight="bold">{child.name}</Text>
                      <Text as="div" color="gray" size="2">{ageBandLabel(child.ageBand)}</Text>
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeChild && activeNode.kind === 'child' && (
            <>
              <Card className="parent-panel">
                <Flex align="center" gap="3" wrap="wrap">
                  <ChildAvatar child={activeChild} size="lg" />
                  <div className="grow">
                    <Heading as="h3" size="5">{activeChild.name}</Heading>
                    <Text color="gray" size="2">{ageBandLabel(activeChild.ageBand)}</Text>
                  </div>
                  <Button variant="soft" color="gray" onClick={() => { setEditing(activeChild); setShowForm(true); }}>แก้ไขโปรไฟล์</Button>
                </Flex>
              </Card>

              {!activeProgress && <Card className="parent-panel"><Flex align="center" gap="3"><div className="state-spinner" /><Text color="gray">กำลังโหลดข้อมูล...</Text></Flex></Card>}

              {activeProgress && activeNode.view === 'progress' && <ProgressPanel data={activeProgress} />}
              {activeProgress && activeNode.view === 'assigned' && <AssignedPanel data={activeProgress} />}
              {activeNode.view === 'settings' && (
                <Card className="parent-panel">
                  <Heading as="h3" size="4">ตั้งค่าโปรไฟล์</Heading>
                  <Text color="gray" size="2">แก้ไขข้อมูลหรือถอดโปรไฟล์นี้ออกจากครอบครัว</Text>
                  <Flex gap="2" wrap="wrap" mt="4">
                    <Button onClick={() => { setEditing(activeChild); setShowForm(true); }}>แก้ไข</Button>
                    <AlertDialog.Root>
                      <AlertDialog.Trigger><Button variant="soft" color="red" disabled={loading}>ลบโปรไฟล์</Button></AlertDialog.Trigger>
                      <AlertDialog.Content maxWidth="420px">
                        <AlertDialog.Title>ลบ {activeChild.name}?</AlertDialog.Title>
                        <AlertDialog.Description size="2">ข้อมูลความก้าวหน้าของโปรไฟล์นี้จะถูกลบด้วย</AlertDialog.Description>
                        <Flex gap="3" justify="end" mt="4">
                          <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
                          <AlertDialog.Action><Button color="red" onClick={() => deleteChild(activeChild.id)}>ลบ</Button></AlertDialog.Action>
                        </Flex>
                      </AlertDialog.Content>
                    </AlertDialog.Root>
                  </Flex>
                </Card>
              )}
            </>
          )}
        </ExplorerLayout>
      )}

      {showForm && (
        <ChildForm
          child={editing}
          onDone={() => { setShowForm(false); setEditing(null); setProgressCache({}); load(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ProgressPanel({ data }: { data: ChildProgressData }) {
  return (
    <Card className="parent-panel">
      <Heading as="h3" size="4">ความคืบหน้าตามวิชา</Heading>
      {data.subjects.length === 0 && <Text color="gray">ยังไม่มีข้อมูลตามวิชา</Text>}
      <div className="subject-progress-grid">
        {data.subjects.map((subject) => (
          <div key={subject.subjectName} className="subject-progress-card">
            <Text as="div" weight="bold">{subject.subjectName}</Text>
            <Text as="div" color="gray" size="2">ทำครบแล้ว {subject.completedSetCount}/{subject.assignedCount} ชุด · เหลือ {subject.remainingSetCount} ชุด</Text>
            <div className="progress-bar-track" style={{ marginTop: 8 }}>
              <div className="progress-bar-fill" style={{ width: `${completion(subject.completedSetCount, subject.assignedCount)}%` }} />
            </div>
            <Text as="div" size="2" weight="bold" style={{ color: 'var(--green)', marginTop: 6 }}>คะแนนดีที่สุด {pct(subject.bestScore)} · ทำทั้งหมด {subject.completedAttempts} ครั้ง</Text>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AssignedPanel({ data }: { data: ChildProgressData }) {
  return (
    <Card className="parent-panel">
      <Heading as="h3" size="4">แบบฝึกหัดที่มอบหมาย</Heading>
      {data.sets.length === 0 && <Text color="gray">ยังไม่มีแบบฝึกหัดที่มอบหมาย</Text>}
      <div className="progress-set-list">
        {data.sets.map((set) => (
          <div key={set.exerciseSetId} className="progress-set-row">
            <div className="row">
              <div className="grow">
                <Text as="div" weight="bold">{set.title || `ชุดที่ ${set.exerciseSetId}`}</Text>
                <Text as="div" color="gray" size="2">{set.subjectName ?? 'ไม่ระบุวิชา'} · ทำ {set.attemptCount} ครั้ง</Text>
              </div>
              <Text weight="bold" style={{ color: 'var(--green)' }}>{pct(set.bestScore)}</Text>
            </div>
            <div className="progress-bar-track" style={{ marginTop: 8 }}>
              <div className="progress-bar-fill" style={{ width: `${(set.bestScore ?? 0) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ChildForm({ child, onDone, onCancel }: { child: Child | null; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(child?.name ?? '');
  const [avatar, setAvatar] = useState(child?.avatar ?? CHILD_AVATAR_OPTIONS[0].key);
  const [ageBand, setAgeBand] = useState<AgeBand>(child?.ageBand ?? 'young');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (child) {
        await api.patch(`/api/parent/children/${child.id}`, { name, avatar, ageBand });
      } else {
        await api.post('/api/parent/children', { name, avatar, ageBand });
      }
      onDone();
    } catch {
      setError('บันทึกไม่สำเร็จ ตรวจสอบข้อมูลแล้วลองใหม่');
    }
  }

  return (
    <Card className="parent-panel">
      <Heading as="h3" size="4">{child ? `แก้ไข ${child.name}` : 'เพิ่มเด็ก'}</Heading>
      <form onSubmit={submit} className="stack-form">
        <input placeholder="ชื่อเล่น" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="avatar-picker-grid">
          {CHILD_AVATAR_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`avatar-picker-option ${avatar === option.key ? 'selected' : ''}`}
              onClick={() => setAvatar(option.key)}
              title={option.label}
              aria-label={option.label}
            >
              <ChildAvatar avatar={option.key} name={name || option.label} size="sm" />
            </button>
          ))}
        </div>
        <select value={ageBand} onChange={(e) => setAgeBand(e.target.value as AgeBand)}>
          <option value="young">เด็กเล็ก (UI ง่าย ปุ่มใหญ่)</option>
          <option value="older">เด็กโต</option>
        </select>
        {error && <div className="error-text">{error}</div>}
        <div className="row">
          <Button type="submit">บันทึก</Button>
          <Button type="button" variant="soft" color="gray" onClick={onCancel}>ยกเลิก</Button>
        </div>
      </form>
    </Card>
  );
}
