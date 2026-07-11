import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { ChildAvatar } from '../../components/ChildAvatar';
import type { Child } from '@shared/types';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function ProfilePicker() {
  const nav = useNavigate();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [familyName, setFamilyName] = useState('ครอบครัว');
  const [error, setError] = useState('');
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ familyName: string }>('/api/play/family'),
      api.get<Child[]>('/api/play/children'),
    ])
      .then(([family, childRows]) => {
        setFamilyName(family.familyName || 'ครอบครัว');
        setChildren(childRows);
      })
      .catch(() => setNeedLogin(true));
  }, []);

  async function selectChild(childId: number) {
    setError('');
    try {
      const { child } = await api.post<{ child: Child }>('/api/play/select-child', { childId });
      sessionStorage.setItem('activeChild', JSON.stringify(child));
      nav('/play/exercises');
    } catch {
      setError('เลือกสมาชิกไม่สำเร็จ ลองเข้าสู่ระบบผู้ปกครองใหม่อีกครั้ง');
    }
  }

  if (needLogin) {
    return (
      <div className="play-root centered-play">
        <div className="state-illustration">🔒</div>
        <h2>ให้ผู้ปกครองเข้าสู่ระบบก่อนนะ</h2>
        <Link to="/parent/login"><button>ผู้ปกครองเข้าสู่ระบบ</button></Link>
      </div>
    );
  }

  if (!children) {
    return (
      <div className="play-root centered-play">
        <div className="state-card">
          <div className="state-spinner" />
          <b>กำลังโหลดโปรไฟล์เด็ก</b>
          <span>รอสักครู่นะ</span>
        </div>
      </div>
    );
  }

  return (
    <div className="play-root">
      <div className="family-home-heading">
        <span className="family-home-eyebrow">พื้นที่การเรียนรู้ของครอบครัว</span>
        <h1 className="kid-page-title">{familyName}</h1>
        <h2 className="family-member-title">วันนี้ใครจะเข้าใช้งาน?</h2>
      </div>
      <div className="profile-grid">
        {children.map((ch) => (
          <button key={ch.id} className="profile-tile" onClick={() => selectChild(ch.id)}>
            <ChildAvatar child={ch} size="lg" />
            <span className="profile-name">{ch.name}</span>
            <span className="profile-action">ทำแบบฝึกหัด <ArrowRight aria-hidden="true" /></span>
          </button>
        ))}
        <Link to="/parent" className="profile-tile parent-profile-tile">
          <span className="parent-avatar"><ShieldCheck aria-hidden="true" /></span>
          <span className="profile-name">ผู้ปกครอง</span>
          <span className="profile-action">ดูแลข้อมูล <ArrowRight aria-hidden="true" /></span>
        </Link>
      </div>
      {error && <div className="error-text" style={{ marginTop: 16, textAlign: 'center' }}>{error}</div>}
      {children.length === 0 && (
        <div className="state-card empty-state">
          <b>ยังไม่มีโปรไฟล์เด็ก</b>
          <span>ให้ผู้ปกครองเพิ่มโปรไฟล์ที่หน้า <Link to="/parent/children">จัดการเด็ก</Link></span>
        </div>
      )}
    </div>
  );
}
