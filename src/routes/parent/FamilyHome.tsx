import { useEffect, useState } from 'react';
import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api-client';

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

export default function FamilyHome() {
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  function load() {
    api.get<FamilyProfile>('/api/parent/profile').then((data) => {
      setProfile(data);
      setFamilyName(data.familyName);
    });
  }

  useEffect(load, []);

  async function saveFamilyName(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    try {
      const res = await api.patch<{ ok: true; familyName: string }>('/api/parent/profile', { familyName });
      setProfile((prev) => prev ? { ...prev, familyName: res.familyName } : prev);
      setProfileMessage('บันทึกชื่อครอบครัวแล้ว');
    } catch (err) {
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

  if (!profile) {
    return (
      <Card className="parent-panel">
        <Flex align="center" gap="3">
          <div className="state-spinner" />
          <Text color="gray">กำลังโหลดหน้าครอบครัว...</Text>
        </Flex>
      </Card>
    );
  }

  return (
    <div className="parent-stack">
      <div className="family-hero">
        <div>
          <Text as="div" size="2" color="gray">บัญชีครอบครัว</Text>
          <Heading as="h2" size="7">{profile.familyName}</Heading>
          <Text color="gray">{profile.email}</Text>
        </div>
        <Flex gap="2" wrap="wrap">
          <Link to="/parent/upload"><Button>สร้างแบบฝึกหัด</Button></Link>
          <Link to="/play"><Button variant="soft" color="gray">โหมดเด็ก</Button></Link>
        </Flex>
      </div>

      <div className="stats-grid admin-stats">
        <Card className="stat-card"><div className="stat-value">{profile.counts.children}</div><Text color="gray" size="2">เด็ก</Text></Card>
        <Card className="stat-card"><div className="stat-value">{profile.counts.activeExerciseSets}</div><Text color="gray" size="2">แบบฝึกหัดที่ใช้ได้</Text></Card>
        <Card className="stat-card"><div className="stat-value">{profile.counts.pendingReviewSets}</div><Text color="gray" size="2">รอตรวจ</Text></Card>
        <Card className="stat-card"><div className="stat-value">{profile.counts.completedAttempts}</div><Text color="gray" size="2">ประวัติการทำ</Text></Card>
      </div>

      <div className="family-grid">
        <Card className="parent-panel">
          <Heading as="h3" size="4">โปรไฟล์ครอบครัว</Heading>
          <form className="stack-form" onSubmit={saveFamilyName}>
            <label>
              <Text as="div" size="2" weight="bold">ชื่อครอบครัว</Text>
              <input value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="เช่น ครอบครัวนุภาค" />
            </label>
            {profileMessage && <Text color={profileMessage.includes('แล้ว') ? 'green' : 'red'} size="2">{profileMessage}</Text>}
            <Button type="submit" disabled={savingProfile}>{savingProfile ? 'กำลังบันทึก...' : 'บันทึกชื่อครอบครัว'}</Button>
          </form>
        </Card>

        <Card className="parent-panel">
          <Heading as="h3" size="4">เปลี่ยนรหัสผ่านผู้ปกครอง</Heading>
          <form className="stack-form" onSubmit={changePassword}>
            <input type="password" placeholder="รหัสผ่านปัจจุบัน" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            <input type="password" placeholder="รหัสผ่านใหม่ (8 ตัวขึ้นไป)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            {passwordMessage && <Text color={passwordMessage.includes('แล้ว') ? 'green' : 'red'} size="2">{passwordMessage}</Text>}
            <Button type="submit" disabled={savingPassword}>{savingPassword ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}</Button>
          </form>
        </Card>
      </div>

      <Card className="parent-panel">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Heading as="h3" size="4">เด็กในครอบครัว</Heading>
          <Link to="/parent/children"><Button variant="soft" color="gray">จัดการเด็ก</Button></Link>
        </Flex>
        <div className="family-child-list">
          {profile.children.map((child) => (
            <Link key={child.id} to={`/parent/children/${child.id}/progress`} className="family-child-row">
              <span className="child-avatar">{child.avatar}</span>
              <div className="grow">
                <Text as="div" weight="bold">{child.name}</Text>
                <Text as="div" color="gray" size="2">
                  {child.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'} · มอบหมาย {child.assignedCount} · ทำแล้ว {child.completedCount}
                </Text>
              </div>
            </Link>
          ))}
          {profile.children.length === 0 && (
            <Text color="gray">ยังไม่มีโปรไฟล์เด็ก เพิ่มเด็กก่อนเพื่อเริ่มใช้งานโหมดเด็ก</Text>
          )}
        </div>
      </Card>
    </div>
  );
}
