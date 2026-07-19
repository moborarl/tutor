import { useEffect, useMemo, useState } from 'react';
import { AlertDialog, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { api, ApiError } from '../../lib/api-client';
import { AppState } from '../../components/AppState';
import { ChildAvatar } from '../../components/ChildAvatar';
import { DataToolbar } from '../../components/DataToolbar';
import { EntityList, EntityRow } from '../../components/EntityList';
import { ExplorerLayout } from '../../components/ExplorerLayout';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { TreePanel, type TreeNodeItem } from '../../components/TreePanel';

type AdminSection = 'overview' | 'profile' | 'password' | 'sets' | 'children' | 'r2' | 'cleanup';
type SetFilter = 'all' | string;
type AdminTreeId =
  | AdminSection
  | 'sets:all'
  | `sets:subject:${string}`;

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
  insights: {
    subjectProgress: Array<{ subjectName: string; setCount: number; assignedChildren: number; completedAttempts: number; lastActivity: string | null }>;
    incompleteSets: Array<{ id: number; title: string; subjectName: string; ageBand: string; childId: number; childName: string }>;
    recentChildren: Array<{ id: number; name: string; avatar: string; ageBand: string; lastActivity: string | null; attemptCount: number }>;
  };
}

interface R2FileRow {
  key: string;
  size: number;
  uploaded: string;
}

interface FamilyProfile {
  id: number;
  email: string;
  familyName: string;
  createdAt: string;
  counts: {
    children: number;
    subjects: number;
    activeExerciseSets: number;
    publishedExerciseSets: number;
    pendingReviewSets: number;
    completedAttempts: number;
  };
  children: Array<{
    id: number;
    name: string;
    avatar: string;
    ageBand: string;
    assignedCount: number;
    completedCount: number;
  }>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function ageBandLabel(value: string) {
  return value === 'young' ? 'เด็กเล็ก' : 'เด็กโต';
}

function ConfirmDanger({
  label,
  title,
  description,
  onConfirm,
  disabled,
  confirmValue = 'ลบ',
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
  confirmValue?: string;
}) {
  const [confirmationInput, setConfirmationInput] = useState('');
  const canConfirm = !disabled && confirmationInput === confirmValue;

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button variant="soft" color="red" disabled={disabled}>{label}</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="460px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{description}</AlertDialog.Description>
        <label className="danger-confirm-field">
          <Text as="div" size="2" weight="bold">พิมพ์ "{confirmValue}" เพื่อยืนยัน</Text>
          <input
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder={confirmValue}
          />
        </label>
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" disabled={!canConfirm} onClick={onConfirm}>ยืนยันลบ</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

function ConfirmR2Delete({
  count,
  onConfirm,
  busy,
  disabled,
}: {
  count: number;
  onConfirm: () => Promise<void>;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger><Button variant="soft" color="red" disabled={disabled || busy}>ลบไฟล์</Button></AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="520px">
        <AlertDialog.Title>{count > 1 ? `ลบไฟล์ R2 ${count} ไฟล์?` : 'ลบไฟล์ R2 นี้?'}</AlertDialog.Title>
        <AlertDialog.Description size="2">
          การลบไฟล์โดยตรงอาจทำให้รูปในแบบฝึกหัดบางหน้าหาย ยืนยันอีกครั้งเมื่อตรวจแล้วว่าไฟล์ที่เลือกไม่ใช้แล้ว
        </AlertDialog.Description>
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel><Button variant="soft" color="gray">ยกเลิก</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" disabled={busy} onClick={onConfirm}>ยืนยันลบ</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

export default function Admin() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [section, setSection] = useState<AdminSection>('overview');
  const [setFilter, setSetFilter] = useState<SetFilter>('all');
  const [selectedSetIds, setSelectedSetIds] = useState<number[]>([]);
  const [familyName, setFamilyName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [r2Files, setR2Files] = useState<R2FileRow[]>([]);
  const [selectedR2Keys, setSelectedR2Keys] = useState<string[]>([]);
  const [r2Cursor, setR2Cursor] = useState<string | null>(null);
  const [r2Loading, setR2Loading] = useState(false);

  function load() {
    api.get<AdminSummary>('/api/parent/admin/summary').then((data) => {
      setSummary(data);
      setSelectedSetIds((ids) => ids.filter((id) => data.sets.some((set) => set.id === id)));
    });
    api.get<FamilyProfile>('/api/parent/profile').then((data) => {
      setProfile(data);
      setFamilyName(data.familyName);
    });
  }

  useEffect(load, []);

  const setGroups = useMemo(() => {
    const groups = new Map<string, { subject: string; young: number; old: number; total: number }>();
    for (const set of summary?.sets ?? []) {
      const subject = set.subjectName || 'ไม่ระบุวิชา';
      const current = groups.get(subject) ?? { subject, young: 0, old: 0, total: 0 };
      current.total += 1;
      if (set.ageBand === 'young') current.young += 1;
      else current.old += 1;
      groups.set(subject, current);
    }
    return [...groups.values()].sort((a, b) => a.subject.localeCompare(b.subject, 'th'));
  }, [summary?.sets]);

  const filteredSets = useMemo(() => {
    const sets = summary?.sets ?? [];
    if (setFilter === 'all') return sets;
    return sets.filter((set) => (set.subjectName || 'ไม่ระบุวิชา') === setFilter);
  }, [setFilter, summary?.sets]);

  async function loadR2Files(reset = false) {
    setR2Loading(true);
    try {
      const cursor = reset ? '' : r2Cursor;
      const data = await api.get<{ files: R2FileRow[]; cursor: string | null }>(
        `/api/parent/admin/r2-files${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      setR2Files((prev) => reset ? data.files : [...prev, ...data.files]);
      setSelectedR2Keys((keys) => keys.filter((key) => (reset ? data.files : [...r2Files, ...data.files]).some((file) => file.key === key)));
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

  async function deleteSelectedSets(ids: number[]) {
    setBusy(true);
    try {
      await api.delete('/api/parent/admin/exercise-sets', { ids });
      setSelectedSetIds([]);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteR2Files(keys: string[]) {
    if (keys.length === 0) return;
    setBusy(true);
    try {
      await api.delete('/api/parent/admin/r2-files', { keys });
      setR2Files((files) => files.filter((file) => !keys.includes(file.key)));
      setSelectedR2Keys((current) => current.filter((key) => !keys.includes(key)));
      load();
    } finally {
      setBusy(false);
    }
  }

  async function saveFamilyName(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    try {
      const res = await api.patch<{ ok: true; familyName: string }>('/api/parent/profile', { familyName });
      setProfile((prev) => prev ? { ...prev, familyName: res.familyName } : prev);
      setProfileMessage('บันทึกชื่อครอบครัวแล้ว');
    } catch {
      setProfileMessage('บันทึกไม่สำเร็จ ชื่อต้องยาวอย่างน้อย 2 ตัวอักษร');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMessage('');
    try {
      await api.post('/api/parent/profile/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage('เปลี่ยนรหัสผ่านแล้ว');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_current_password') {
        setPasswordMessage('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      } else if (err instanceof ApiError && err.code === 'password_too_short') {
        setPasswordMessage('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร');
      } else if (err instanceof ApiError && err.code === 'password_unchanged') {
        setPasswordMessage('รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม');
      } else {
        setPasswordMessage('เปลี่ยนรหัสผ่านไม่สำเร็จ');
      }
    } finally {
      setSavingPassword(false);
    }
  }

  function toggleSet(id: number, checked: boolean) {
    setSelectedSetIds((ids) => checked ? [...new Set([...ids, id])] : ids.filter((setId) => setId !== id));
  }

  function toggleVisibleSets(checked: boolean) {
    const visibleIds = filteredSets.map((set) => set.id);
    setSelectedSetIds((ids) => checked ? [...new Set([...ids, ...visibleIds])] : ids.filter((id) => !visibleIds.includes(id)));
  }

  function toggleR2File(key: string, checked: boolean) {
    setSelectedR2Keys((keys) => checked ? [...new Set([...keys, key])] : keys.filter((item) => item !== key));
  }

  function toggleVisibleR2Files(checked: boolean) {
    const visibleKeys = r2Files.map((file) => file.key);
    setSelectedR2Keys((keys) => checked ? [...new Set([...keys, ...visibleKeys])] : keys.filter((key) => !visibleKeys.includes(key)));
  }

  if (!summary || !profile) {
    return <AppState tone="loading" title="กำลังโหลดข้อมูลครอบครัว" />;
  }
  const c = summary.counts;
  const selectedCount = selectedSetIds.length;
  const allVisibleSelected = filteredSets.length > 0 && filteredSets.every((set) => selectedSetIds.includes(set.id));
  const selectedR2Count = selectedR2Keys.length;
  const selectedR2Bytes = r2Files
    .filter((file) => selectedR2Keys.includes(file.key))
    .reduce((sum, file) => sum + file.size, 0);
  const allVisibleR2Selected = r2Files.length > 0 && r2Files.every((file) => selectedR2Keys.includes(file.key));
  const adminActiveId: AdminTreeId = section === 'sets'
    ? (setFilter === 'all' ? 'sets:all' : `sets:subject:${setFilter}`)
    : section;
  const adminTreeItems: TreeNodeItem[] = [
    { id: 'overview', label: 'ภาพรวมครอบครัว', icon: '⌂', count: c.children },
    { id: 'profile', label: 'โปรไฟล์ครอบครัว', icon: '◎' },
    { id: 'password', label: 'เปลี่ยนรหัสผ่าน', icon: '◇' },
    { id: 'sets:all', label: 'แบบฝึกหัด', icon: '▣', count: c.exerciseSets },
    ...setGroups.map((group) => ({
      id: `sets:subject:${group.subject}`,
      label: group.subject,
      icon: '▸',
      count: group.total,
      depth: 1,
    })),
    { id: 'children', label: 'เด็ก', icon: '●', count: c.children },
    { id: 'r2', label: 'การใช้งานพื้นที่ / R2', icon: '▤', count: c.r2Objects },
    { id: 'cleanup', label: 'ล้างข้อมูล', icon: '!', danger: true },
  ];

  function selectAdminTree(id: string) {
    if (id === 'sets:all') {
      setSection('sets');
      setSetFilter('all');
      return;
    }
    if (id.startsWith('sets:subject:')) {
      setSection('sets');
      setSetFilter(id.slice('sets:subject:'.length));
      return;
    }
    setSection(id as AdminSection);
  }

  return (
    <div className="parent-stack">
      <PageHeader
        eyebrow={profile.familyName}
        title="ดูแลข้อมูล"
        description="จัดการครอบครัว แบบฝึกหัด เด็ก ไฟล์ และพื้นที่ใช้งานจากที่เดียว"
      />

      <ExplorerLayout
        mobileLabel="พื้นที่ดูแลข้อมูล"
        tree={<TreePanel
          label="พื้นที่ดูแลข้อมูล"
          items={adminTreeItems}
          activeId={adminActiveId}
          onSelect={selectAdminTree}
        />}
      >

        <section className="management-workspace">
          {section === 'overview' && (
            <div className="workspace-stack">
              <Card className="parent-panel">
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <div>
                    <Text as="div" size="2" color="gray">บัญชีครอบครัว</Text>
                    <Heading as="h3" size="6">{profile.familyName}</Heading>
                    <Text color="gray" size="2">{profile.email}</Text>
                  </div>
                  <Button variant="soft" color="gray" onClick={() => setSection('profile')}>แก้ไขโปรไฟล์</Button>
                </Flex>
              </Card>
              <div className="summary-grid stats-grid admin-stats">
                <Card className="stat-card"><div className="stat-value">{c.exerciseSets}</div><Text color="gray" size="2">แบบฝึกหัด</Text></Card>
                <Card className="stat-card"><div className="stat-value">{c.archivedSets}</div><Text color="gray" size="2">เก็บเข้าคลัง</Text></Card>
                <Card className="stat-card"><div className="stat-value">{c.children}</div><Text color="gray" size="2">เด็ก</Text></Card>
                <Card className="stat-card"><div className="stat-value">{c.questions}</div><Text color="gray" size="2">โจทย์</Text></Card>
                <Card className="stat-card"><div className="stat-value">{c.attempts}</div><Text color="gray" size="2">ประวัติการทำ</Text></Card>
                <Card className="stat-card"><div className="stat-value">{c.r2Objects}</div><Text color="gray" size="2">ไฟล์ R2</Text></Card>
                <Card className="stat-card"><div className="stat-value">{formatBytes(c.r2Bytes)}</div><Text color="gray" size="2">พื้นที่ไฟล์โดยประมาณ</Text></Card>
              </div>
              <section className="parent-panel workspace-section">
                <Heading as="h3" size="4">สมาชิกครอบครัว</Heading>
                <EntityList
                  label="สมาชิกครอบครัว"
                  isEmpty={profile.children.length === 0}
                  empty={<AppState tone="empty" title="ยังไม่มีโปรไฟล์เด็ก" />}
                >
                  {profile.children.map((child) => (
                    <EntityRow
                      key={child.id}
                      selection={<ChildAvatar child={child} />}
                      title={child.name}
                      metadata={`${ageBandLabel(child.ageBand)} · มอบหมาย ${child.assignedCount} · ทำแล้ว ${child.completedCount}`}
                    />
                  ))}
                </EntityList>
              </section>
              <section className="parent-panel workspace-section">
                <Heading as="h3" size="4">ความคืบหน้าตามวิชา</Heading>
                <EntityList label="ความคืบหน้าตามวิชา" isEmpty={summary.insights.subjectProgress.length === 0} empty={<AppState tone="empty" title="ยังไม่มีข้อมูลความคืบหน้า" />}>
                  {summary.insights.subjectProgress.map((item) => (
                    <EntityRow
                      key={item.subjectName}
                      title={item.subjectName}
                      metadata={`${item.setCount} ชุด · มอบหมาย ${item.assignedChildren} คน · ทำเสร็จ ${item.completedAttempts} ครั้ง`}
                    />
                  ))}
                </EntityList>
              </section>
              <div className="summary-grid">
                <section className="parent-panel workspace-section">
                  <Heading as="h3" size="4">งานที่ยังไม่เสร็จ</Heading>
                  <EntityList label="งานที่ยังไม่เสร็จ" isEmpty={summary.insights.incompleteSets.length === 0} empty={<AppState tone="empty" title="ไม่มีงานค้าง" />}>
                    {summary.insights.incompleteSets.slice(0, 8).map((item) => (
                      <EntityRow key={`${item.id}-${item.childId}`} title={item.title} metadata={`${item.subjectName} · ${item.childName}`} />
                    ))}
                  </EntityList>
                </section>
                <section className="parent-panel workspace-section">
                  <Heading as="h3" size="4">เด็กที่ใช้งานล่าสุด</Heading>
                  <EntityList label="เด็กที่ใช้งานล่าสุด" isEmpty={summary.insights.recentChildren.length === 0} empty={<AppState tone="empty" title="ยังไม่มีประวัติการใช้งาน" />}>
                    {summary.insights.recentChildren.map((child) => (
                      <EntityRow key={child.id} selection={<ChildAvatar child={child} />} title={child.name} metadata={`ทำแบบฝึกหัด ${child.attemptCount} ครั้ง`} />
                    ))}
                  </EntityList>
                </section>
              </div>
            </div>
          )}

          {section === 'profile' && (
            <Card className="parent-panel">
              <Heading as="h3" size="4">โปรไฟล์ครอบครัว</Heading>
              <form className="stack-form" onSubmit={saveFamilyName}>
                <label>
                  <Text as="div" size="2" weight="bold">ชื่อครอบครัว</Text>
                  <input value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="เช่น ครอบครัว Nupark" />
                </label>
                <Text as="div" size="2" color="gray">ใช้ชื่อนี้บนหน้า /play เพื่อให้รู้สึกเป็นบ้านของครอบครัวเดียวกัน</Text>
                {profileMessage && <Text color={profileMessage.includes('แล้ว') ? 'green' : 'red'} size="2">{profileMessage}</Text>}
                <Button type="submit" disabled={savingProfile}>{savingProfile ? 'กำลังบันทึก...' : 'บันทึกชื่อครอบครัว'}</Button>
              </form>
            </Card>
          )}

          {section === 'password' && (
            <Card className="parent-panel">
              <Heading as="h3" size="4">เปลี่ยนรหัสผ่านผู้ปกครอง</Heading>
              <form className="stack-form" onSubmit={changePassword}>
                <input type="password" placeholder="รหัสผ่านปัจจุบัน" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                <input type="password" placeholder="รหัสผ่านใหม่ (8 ตัวขึ้นไป)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
                {passwordMessage && <Text color={passwordMessage.includes('แล้ว') ? 'green' : 'red'} size="2">{passwordMessage}</Text>}
                <Button type="submit" disabled={savingPassword}>{savingPassword ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}</Button>
              </form>
            </Card>
          )}

          {section === 'sets' && (
            <section className="parent-panel workspace-section">
              <div className="workspace-section-heading">
                  <Heading as="h3" size="4">{setFilter === 'all' ? 'แบบฝึกหัดทั้งหมด' : setFilter}</Heading>
                  <Text color="gray" size="2">เลือกหลายชุดแล้วลบพร้อมกันได้จากหน้านี้</Text>
              </div>
              <DataToolbar
                selection={(
                  <label className="select-all-row">
                    <input
                      className="compact-checkbox"
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={filteredSets.length === 0}
                      onChange={(e) => toggleVisibleSets(e.target.checked)}
                    />
                    <span>เลือกทั้งหมดที่เห็น</span>
                  </label>
                )}
                actions={(
                  <ConfirmDanger
                    label={busy ? 'กำลังลบ...' : `ลบที่เลือก (${selectedCount})`}
                    title="ลบแบบฝึกหัดที่เลือก?"
                    description="จะลบโจทย์ รูปภาพ การมอบหมาย และประวัติการทำของแบบฝึกหัดที่เลือกทั้งหมด"
                    disabled={selectedCount === 0 || busy}
                    onConfirm={() => deleteSelectedSets(selectedSetIds)}
                  />
                )}
              />
              <EntityList
                label="แบบฝึกหัด"
                isEmpty={filteredSets.length === 0}
                empty={<AppState tone="empty" title="ไม่มีแบบฝึกหัดในโฟลเดอร์นี้" />}
              >
                {filteredSets.map((s) => (
                  <EntityRow
                    key={s.id}
                    selected={selectedSetIds.includes(s.id)}
                    selection={<input
                        className="compact-checkbox"
                        type="checkbox"
                        checked={selectedSetIds.includes(s.id)}
                        onChange={(e) => toggleSet(s.id, e.target.checked)}
                        aria-label={`เลือก ${s.title || `ชุดที่ ${s.id}`}`}
                      />}
                    title={s.title || `ชุดที่ ${s.id}`}
                    metadata={`${s.subjectName ?? 'ไม่ระบุวิชา'} · ${ageBandLabel(s.ageBand)} · ${s.questionCount} ข้อ · มอบหมาย ${s.assignedCount}`}
                    status={<StatusBadge tone={s.status === 'published' ? 'success' : 'warning'}>{s.status}</StatusBadge>}
                  />
                ))}
              </EntityList>
            </section>
          )}

          {section === 'children' && (
            <section className="parent-panel workspace-section">
              <Heading as="h3" size="4">เด็กทั้งหมด</Heading>
              <EntityList
                label="เด็กทั้งหมด"
                isEmpty={summary.children.length === 0}
                empty={<AppState tone="empty" title="ไม่มีโปรไฟล์เด็ก" />}
              >
                {summary.children.map((ch) => (
                  <EntityRow
                    key={ch.id}
                    selection={<ChildAvatar child={ch} />}
                    title={ch.name}
                    metadata={`${ageBandLabel(ch.ageBand)} · มอบหมาย ${ch.assignedCount} · ทำแล้ว ${ch.attemptCount}`}
                    actions={<ConfirmDanger
                      label="ลบ"
                      title={`ลบ ${ch.name}?`}
                      description="จะลบโปรไฟล์เด็ก การมอบหมาย และประวัติการทำทั้งหมดของเด็กคนนี้"
                      disabled={busy}
                      onConfirm={() => runCleanup(`/api/parent/admin/children/${ch.id}`)}
                    />}
                  />
                ))}
              </EntityList>
            </section>
          )}

          {section === 'r2' && (
            <section className="parent-panel workspace-section">
              <div className="workspace-section-heading">
                  <Heading as="h3" size="4">ไฟล์ R2</Heading>
                  <Text color="gray" size="2">ไฟล์รูปภายใต้บัญชีนี้เท่านั้น ลบเฉพาะไฟล์ที่มั่นใจว่าไม่ใช้แล้ว</Text>
              </div>
              <DataToolbar
                selection={(
                  <label className="select-all-row">
                    <input
                      className="compact-checkbox"
                      type="checkbox"
                      checked={allVisibleR2Selected}
                      disabled={r2Files.length === 0}
                      onChange={(e) => toggleVisibleR2Files(e.target.checked)}
                    />
                    <span>เลือกทั้งหมดที่โหลด</span>
                  </label>
                )}
                actions={<>
                  <ConfirmR2Delete
                    count={selectedR2Count}
                    busy={busy}
                    disabled={selectedR2Count === 0}
                    onConfirm={() => deleteR2Files(selectedR2Keys)}
                  />
                  <Button variant="soft" color="gray" onClick={() => loadR2Files(true)} disabled={r2Loading}>
                    {r2Files.length === 0 ? 'โหลดรายการไฟล์' : 'รีเฟรช'}
                  </Button>
                </>}
              />
              <div className="r2-summary-strip">
                <div><b>{c.r2Objects}</b><span>ไฟล์ทั้งหมด</span></div>
                <div><b>{formatBytes(c.r2Bytes)}</b><span>พื้นที่โดยประมาณ</span></div>
                <div><b>{formatBytes(selectedR2Bytes)}</b><span>พื้นที่ที่เลือก</span></div>
                <div><b>{r2Files.length}</b><span>โหลดมาแล้ว</span></div>
              </div>
              <EntityList
                label="ไฟล์ R2"
                isEmpty={r2Files.length === 0}
                empty={<AppState tone="empty" title="ยังไม่ได้โหลดรายการไฟล์" />}
              >
                {r2Files.map((file) => (
                  <EntityRow
                    key={file.key}
                    selected={selectedR2Keys.includes(file.key)}
                    selection={<input
                        className="compact-checkbox"
                        type="checkbox"
                        checked={selectedR2Keys.includes(file.key)}
                        onChange={(e) => toggleR2File(file.key, e.target.checked)}
                        aria-label={`เลือก ${file.key}`}
                      />}
                    title={<span className="r2-file-key">{file.key}</span>}
                    metadata={`${formatBytes(file.size)} · อัปโหลด ${formatDate(file.uploaded)}`}
                  />
                ))}
              </EntityList>
              {r2Cursor && (
                <Button variant="soft" color="gray" onClick={() => loadR2Files(false)} disabled={r2Loading}>
                  โหลดเพิ่ม
                </Button>
              )}
            </section>
          )}

          {section === 'cleanup' && (
            <Card className="parent-panel">
              <Flex align="center" gap="3" wrap="wrap">
                <div className="grow">
                  <Heading as="h3" size="4">ล้างข้อมูล</Heading>
                  <Text color="gray" size="2">ลบเฉพาะข้อมูลของบัญชีนี้เท่านั้น เหมาะสำหรับเคลียร์พื้นที่หรือเริ่มเก็บผลใหม่</Text>
                </div>
                <ConfirmDanger
                  label={busy ? 'กำลังลบ...' : 'ลบประวัติการทำทั้งหมด'}
                  title="ลบประวัติการทำทั้งหมด?"
                  description="คะแนนและคำตอบที่เด็กเคยทำจะถูกลบ แต่แบบฝึกหัดและโปรไฟล์เด็กจะยังอยู่"
                  disabled={busy}
                  onConfirm={() => runCleanup('/api/parent/admin/attempts')}
                />
              </Flex>
            </Card>
          )}
        </section>
      </ExplorerLayout>
    </div>
  );
}
