import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Child } from '@shared/types';
import { AppState } from '../../components/AppState';
import { ChildAvatar } from '../../components/ChildAvatar';
import { api } from '../../lib/api-client';

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
      <main className="family-home family-home-state">
        <LockKeyhole className="family-home-lock" aria-hidden="true" />
        <AppState
          tone="error"
          title="เข้าสู่ระบบผู้ปกครองก่อน"
          description="บัญชีผู้ปกครองใช้เปิดพื้นที่ครอบครัวและดูแลข้อมูลสมาชิก"
          action={<Link className="cfs-link-button cfs-button-primary" to="/parent/login">เข้าสู่ระบบ</Link>}
        />
      </main>
    );
  }

  if (!children) {
    return (
      <main className="family-home family-home-state">
        <AppState tone="loading" title="กำลังเตรียมพื้นที่ครอบครัว" description="รอสักครู่" />
      </main>
    );
  }

  return (
    <main className="family-home">
      <header className="family-home-header">
        <span>พื้นที่การเรียนรู้ของครอบครัว</span>
        <h1>{familyName}</h1>
        <p>เลือกสมาชิกเพื่อเริ่มใช้งาน</p>
      </header>

      {error && (
        <AppState tone="error" title={error} />
      )}

      <section className="family-member-grid" aria-label="สมาชิกครอบครัว">
        {children.map((child) => (
          <button
            key={child.id}
            className="family-member-card family-member-child"
            type="button"
            onClick={() => selectChild(child.id)}
          >
            <span className="family-member-avatar"><ChildAvatar child={child} size="lg" /></span>
            <span className="family-member-name">{child.name}</span>
            <span className="family-member-action">ทำแบบฝึกหัด <ArrowRight aria-hidden="true" /></span>
          </button>
        ))}

        <Link to="/parent" className="family-member-card family-member-parent">
          <span className="family-parent-icon"><ShieldCheck aria-hidden="true" /></span>
          <span className="family-member-name">ผู้ปกครอง</span>
          <span className="family-member-action">ดูแลข้อมูล <ArrowRight aria-hidden="true" /></span>
        </Link>
      </section>

      {children.length === 0 && (
        <AppState
          tone="empty"
          title="ยังไม่มีสมาชิกเด็ก"
          description="เพิ่มโปรไฟล์เด็กเพื่อเริ่มมอบหมายแบบฝึกหัด"
          action={<Link className="cfs-link-button cfs-button-secondary" to="/parent/children">จัดการสมาชิก</Link>}
        />
      )}
    </main>
  );
}
