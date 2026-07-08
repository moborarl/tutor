import { useEffect, useMemo, useState } from 'react';
import { AlertDialog, Badge, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { api, ApiError } from '../../lib/api-client';
import { ChildAvatar } from '../../components/ChildAvatar';

type AdminSection = 'overview' | 'profile' | 'password' | 'sets' | 'children' | 'r2' | 'cleanup';
type SetFilter = 'all' | string;

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
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button variant="soft" color="red" disabled={disabled}>{label}</Button>
      </AlertDialog.Trigger>
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

  if (!summary || !profile) {
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
  const selectedCount = selectedSetIds.length;
  const allVisibleSelected = filteredSets.length > 0 && filteredSets.every((set) => selectedSetIds.includes(set.id));

  return (
    <div className="parent-stack">
      <div className="page-heading">
        <div>
          <Heading as="h2" size="6">ดูแลข้อมูล</Heading>
          <Text color="gray" size="2">{profile.familyName} · จัดการครอบครัว แบบฝึกหัด เด็ก ไฟล์ และพื้นที่ใช้งานจากที่เดียว</Text>
        </div>
      </div>

      <div className="management-shell admin-management-shell">
        <aside className="folder-tree">
          <Text as="div" size="1" weight="bold" color="gray" className="tree-label">พื้นที่ดูแลข้อมูล</Text>
          <button className={`tree-node ${section === 'overview' ? 'active' : ''}`} onClick={() => setSection('overview')}>
            <span className="tree-icon">⌂</span><span>ภาพรวมครอบครัว</span><Badge variant="soft">{c.children}</Badge>
          </button>
          <button className={`tree-node ${section === 'profile' ? 'active' : ''}`} onClick={() => setSection('profile')}>
            <span className="tree-icon">◎</span><span>โปรไฟล์ครอบครัว</span>
          </button>
          <button className={`tree-node ${section === 'password' ? 'active' : ''}`} onClick={() => setSection('password')}>
            <span className="tree-icon">◇</span><span>เปลี่ยนรหัสผ่าน</span>
          </button>

          <button
            className={`tree-node ${section === 'sets' && setFilter === 'all' ? 'active' : ''}`}
            onClick={() => { setSection('sets'); setSetFilter('all'); }}
          >
            <span className="tree-icon">▣</span><span>แบบฝึกหัด</span><Badge variant="soft">{c.exerciseSets}</Badge>
          </button>
          <div className="tree-children">
            {setGroups.map((group) => (
              <button
                key={group.subject}
                className={`tree-node child ${section === 'sets' && setFilter === group.subject ? 'active' : ''}`}
                onClick={() => { setSection('sets'); setSetFilter(group.subject); }}
              >
                <span className="tree-icon">▸</span>
                <span>{group.subject}</span>
                <Badge variant="soft">{group.total}</Badge>
              </button>
            ))}
          </div>

          <button className={`tree-node ${section === 'children' ? 'active' : ''}`} onClick={() => setSection('children')}>
            <span className="tree-icon">●</span><span>เด็ก</span><Badge variant="soft">{c.children}</Badge>
          </button>
          <button className={`tree-node ${section === 'r2' ? 'active' : ''}`} onClick={() => setSection('r2')}>
            <span className="tree-icon">▤</span><span>การใช้งานพื้นที่ / R2</span><Badge variant="soft">{c.r2Objects}</Badge>
          </button>
          <button className={`tree-node danger ${section === 'cleanup' ? 'active' : ''}`} onClick={() => setSection('cleanup')}>
            <span className="tree-icon">!</span><span>ล้างข้อมูล</span>
          </button>
        </aside>

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
                <Heading as="h3" size="4">สมาชิกครอบครัว</Heading>
                <div className="family-child-list">
                  {profile.children.map((child) => (
                    <div key={child.id} className="family-child-row">
                      <ChildAvatar child={child} />
                      <div className="grow">
                        <Text as="div" weight="bold">{child.name}</Text>
                        <Text as="div" color="gray" size="2">
                          {ageBandLabel(child.ageBand)} · มอบหมาย {child.assignedCount} · ทำแล้ว {child.completedCount}
                        </Text>
                      </div>
                    </div>
                  ))}
                  {profile.children.length === 0 && <Text color="gray">ยังไม่มีโปรไฟล์เด็ก</Text>}
                </div>
              </Card>
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
            <Card className="parent-panel">
              <Flex align="center" gap="3" wrap="wrap" className="list-toolbar">
                <div className="grow">
                  <Heading as="h3" size="4">{setFilter === 'all' ? 'แบบฝึกหัดทั้งหมด' : setFilter}</Heading>
                  <Text color="gray" size="2">เลือกหลายชุดแล้วลบพร้อมกันได้จากหน้านี้</Text>
                </div>
                <label className="select-all-row">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={filteredSets.length === 0}
                    onChange={(e) => toggleVisibleSets(e.target.checked)}
                  />
                  <span>เลือกทั้งหมดที่เห็น</span>
                </label>
                <ConfirmDanger
                  label={busy ? 'กำลังลบ...' : `ลบที่เลือก (${selectedCount})`}
                  title="ลบแบบฝึกหัดที่เลือก?"
                  description="จะลบโจทย์ รูปภาพ การมอบหมาย และประวัติการทำของแบบฝึกหัดที่เลือกทั้งหมด"
                  disabled={selectedCount === 0 || busy}
                  onConfirm={() => deleteSelectedSets(selectedSetIds)}
                />
              </Flex>
              <div className="admin-list selectable-list">
                {filteredSets.map((s) => (
                  <div key={s.id} className={`admin-row selectable-row ${selectedSetIds.includes(s.id) ? 'selected' : ''}`}>
                    <input
                      className="compact-checkbox"
                      type="checkbox"
                      checked={selectedSetIds.includes(s.id)}
                      onChange={(e) => toggleSet(s.id, e.target.checked)}
                      aria-label={`เลือก ${s.title || `ชุดที่ ${s.id}`}`}
                    />
                    <div className="grow">
                      <Text as="div" weight="bold">{s.title || `ชุดที่ ${s.id}`}</Text>
                      <Text as="div" color="gray" size="2">{s.subjectName ?? 'ไม่ระบุวิชา'} · {ageBandLabel(s.ageBand)} · {s.questionCount} ข้อ · มอบหมาย {s.assignedCount}</Text>
                    </div>
                    <Badge variant="soft">{s.status}</Badge>
                  </div>
                ))}
                {filteredSets.length === 0 && <Text color="gray">ไม่มีแบบฝึกหัดในโฟลเดอร์นี้</Text>}
              </div>
            </Card>
          )}

          {section === 'children' && (
            <Card className="parent-panel">
              <Heading as="h3" size="4">เด็กทั้งหมด</Heading>
              <div className="admin-list">
                {summary.children.map((ch) => (
                  <div key={ch.id} className="admin-row">
                    <ChildAvatar child={ch} />
                    <div className="grow">
                      <Text as="div" weight="bold">{ch.name}</Text>
                      <Text as="div" color="gray" size="2">{ageBandLabel(ch.ageBand)} · มอบหมาย {ch.assignedCount} · ทำแล้ว {ch.attemptCount}</Text>
                    </div>
                    <ConfirmDanger
                      label="ลบ"
                      title={`ลบ ${ch.name}?`}
                      description="จะลบโปรไฟล์เด็ก การมอบหมาย และประวัติการทำทั้งหมดของเด็กคนนี้"
                      disabled={busy}
                      onConfirm={() => runCleanup(`/api/parent/admin/children/${ch.id}`)}
                    />
                  </div>
                ))}
                {summary.children.length === 0 && <Text color="gray">ไม่มีโปรไฟล์เด็ก</Text>}
              </div>
            </Card>
          )}

          {section === 'r2' && (
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
      </div>
    </div>
  );
}
