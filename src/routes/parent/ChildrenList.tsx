import { useEffect, useMemo, useState } from 'react';
import { AlertDialog, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { AppState } from '../../components/AppState';
import { ChildAvatar, CHILD_AVATAR_OPTIONS } from '../../components/ChildAvatar';
import { EntityList, EntityRow } from '../../components/EntityList';
import { ExplorerLayout } from '../../components/ExplorerLayout';
import { PageHeader } from '../../components/PageHeader';
import { TreePanel, type TreeNodeItem } from '../../components/TreePanel';
import { useNotify } from '../../components/AppNotifications';
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
  const notify = useNotify();
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
      notify('ลบไม่สำเร็จ: ' + String(err), 'error');
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
      notify('ลบไม่สำเร็จ: ' + String(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="parent-stack">
      <PageHeader
        title="เด็ก"
        description="จัดการสมาชิกครอบครัว ความคืบหน้า แบบฝึกหัดที่มอบหมาย และโปรไฟล์"
        actions={<Button onClick={() => { setEditing(null); setShowForm(true); }}>เพิ่มเด็ก</Button>}
      />

      {children.length === 0 && !showForm && (
        <AppState
          tone="empty"
          title="ยังไม่มีโปรไฟล์เด็ก"
          description="เพิ่มสมาชิกเพื่อเริ่มมอบหมายแบบฝึกหัดและติดตามความคืบหน้า"
          action={<Button onClick={() => { setEditing(null); setShowForm(true); }}>เพิ่มเด็ก</Button>}
        />
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
            <section className="parent-panel workspace-section">
              <Heading as="h3" size="4">สมาชิกครอบครัว</Heading>
              <EntityList label="สมาชิกครอบครัว">
                {children.map((child) => (
                  <EntityRow
                    key={child.id}
                    selected={selected.has(child.id)}
                    selection={<input
                        className="compact-checkbox"
                        type="checkbox"
                        checked={selected.has(child.id)}
                        onChange={() => toggleSelected(child.id)}
                        disabled={loading}
                        aria-label={`เลือก ${child.name}`}
                      />}
                    title={<button className="entity-title-button" type="button" onClick={() => setActiveId(nodeId({ kind: 'child', childId: child.id, view: 'progress' }))}>{child.name}</button>}
                    metadata={ageBandLabel(child.ageBand)}
                    actions={<Button variant="soft" color="gray" onClick={() => setActiveId(nodeId({ kind: 'child', childId: child.id, view: 'progress' }))}>ดูความคืบหน้า</Button>}
                  />
                ))}
              </EntityList>
            </section>
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

              {!activeProgress && <AppState tone="loading" title="กำลังโหลดข้อมูลเด็ก" />}

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
    <section className="parent-panel workspace-section">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading as="h3" size="4">ความคืบหน้าตามวิชา</Heading>
        <Link to={`/parent/children/${data.child.id}/progress`}>
          <Button variant="soft" color="gray">ดูประวัติและคำตอบรายข้อ</Button>
        </Link>
      </Flex>
      <EntityList
        label="ความคืบหน้าตามวิชา"
        isEmpty={data.subjects.length === 0}
        empty={<AppState tone="empty" title="ยังไม่มีข้อมูลตามวิชา" />}
      >
        {data.subjects.map((subject) => (
          <EntityRow
            key={subject.subjectName}
            title={subject.subjectName}
            metadata={<>
              <span>ทำครบแล้ว {subject.completedSetCount}/{subject.assignedCount} ชุด · เหลือ {subject.remainingSetCount} ชุด</span>
              <div className="progress-bar-track" aria-label={`ทำสำเร็จ ${completion(subject.completedSetCount, subject.assignedCount)}%`}>
                <div className="progress-bar-fill" style={{ width: `${completion(subject.completedSetCount, subject.assignedCount)}%` }} />
              </div>
            </>}
            status={<span className="progress-value">ดีที่สุด {pct(subject.bestScore)} · {subject.completedAttempts} ครั้ง</span>}
          />
        ))}
      </EntityList>
      <div className="progress-recent-attempts" aria-label="ประวัติการทำล่าสุด">
        <Text as="div" weight="bold" size="2">ประวัติการทำล่าสุด</Text>
        {data.recentAttempts.length === 0 && <Text color="gray" size="2">ยังไม่มีประวัติการทำ</Text>}
        {data.recentAttempts.slice(0, 3).map((attempt) => (
          <div key={attempt.attemptId} className="progress-recent-attempt">
            <div className="grow">
              <Text as="div" weight="medium">{attempt.exerciseSetTitle}</Text>
              <Text as="div" color="gray" size="1">{attempt.status === 'completed' ? `คะแนน ${pct(attempt.score)}` : 'ยังทำไม่เสร็จ'}</Text>
            </div>
            {attempt.status === 'completed' && (
              <Link to={`/parent/children/${data.child.id}/attempts/${attempt.attemptId}`}>
                <Button variant="soft" color="gray" size="1">ดูคำตอบรายข้อ</Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AssignedPanel({ data }: { data: ChildProgressData }) {
  return (
    <section className="parent-panel workspace-section">
      <Heading as="h3" size="4">แบบฝึกหัดที่มอบหมาย</Heading>
      <EntityList
        label="แบบฝึกหัดที่มอบหมาย"
        isEmpty={data.sets.length === 0}
        empty={<AppState tone="empty" title="ยังไม่มีแบบฝึกหัดที่มอบหมาย" />}
      >
        {data.sets.map((set) => (
          <EntityRow
            key={set.exerciseSetId}
            title={set.title || `ชุดที่ ${set.exerciseSetId}`}
            metadata={<>
              <span>{set.subjectName ?? 'ไม่ระบุวิชา'} · ทำ {set.attemptCount} ครั้ง</span>
              <div className="progress-bar-track" aria-label={`คะแนนดีที่สุด ${pct(set.bestScore)}`}>
                <div className="progress-bar-fill" style={{ width: `${(set.bestScore ?? 0) * 100}%` }} />
              </div>
            </>}
            status={<span className="progress-value">{pct(set.bestScore)}</span>}
          />
        ))}
      </EntityList>
    </section>
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
