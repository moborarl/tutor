import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api-client';
import type { Child } from '@shared/types';

export default function ProfilePicker() {
  const nav = useNavigate();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [familyName, setFamilyName] = useState('ครอบครัว');
  const [picked, setPicked] = useState<Child | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [needLogin, setNeedLogin] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [parentPassword, setParentPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [resetting, setResetting] = useState(false);

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

  useEffect(() => {
    if (pin.length !== 4 || !picked) return;
    api
      .post<{ child: Child }>('/api/play/select-child', { childId: picked.id, pin })
      .then(({ child }) => {
        sessionStorage.setItem('activeChild', JSON.stringify(child));
        nav('/play/exercises');
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === 'pin_locked') {
          setError('ใส่ PIN ผิดหลายครั้งเกินไป ให้ผู้ปกครองเข้าสู่ระบบใหม่');
        } else {
          setError('PIN ไม่ถูกต้อง ลองใหม่นะ');
        }
        setPin('');
      });
  }, [pin, picked, nav]);

  const handleResetPin = async () => {
    if (!parentPassword || !newPin || !/^\d{4}$/.test(newPin)) {
      setForgotError('ใส่รหัสผ่านผู้ปกครองและ PIN ใหม่ (4 หลัก)');
      return;
    }
    setResetting(true);
    setForgotError('');
    try {
      await api.post('/api/play/forgot-pin', {
        childId: picked!.id,
        parentPassword,
        newPin,
      });
      setShowForgotPin(false);
      setParentPassword('');
      setNewPin('');
      setPin('');
      setError('ตั้ง PIN ใหม่เสร็จแล้ว ลองใส่ PIN ใหม่นะ');
    } catch (err) {
      setForgotError('ตั้ง PIN ไม่สำเร็จ — รหัสผ่านอาจผิด');
    } finally {
      setResetting(false);
    }
  };

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

  if (!picked) {
    return (
      <div className="play-root">
        <div className="family-home-heading">
          <h1 className="kid-page-title">{familyName}</h1>
          <h2 className="family-member-title">สมาชิกครอบครัว</h2>
        </div>
        <div className="profile-grid">
          {children.map((ch) => (
            <button key={ch.id} className="profile-tile" onClick={() => { setPicked(ch); setError(''); }}>
              <span className="avatar">{ch.avatar}</span>
              <span>{ch.name}</span>
            </button>
          ))}
          <Link to="/parent" className="profile-tile parent-profile-tile">
            <span className="avatar">👤</span>
            <span>ผู้ปกครอง</span>
          </Link>
        </div>
        {children.length === 0 && (
          <div className="state-card empty-state">
            <b>ยังไม่มีโปรไฟล์เด็ก</b>
            <span>ให้ผู้ปกครองเพิ่มโปรไฟล์ที่หน้า <Link to="/parent/children">จัดการเด็ก</Link></span>
          </div>
        )}
      </div>
    );
  }

  if (showForgotPin) {
    return (
      <div className="play-root">
        <h2>ตั้ง PIN ใหม่</h2>
        <p style={{ marginBottom: 20 }}>ใส่รหัสผ่านผู้ปกครอง</p>
        <input
          type="password"
          placeholder="รหัสผ่านผู้ปกครอง"
          value={parentPassword}
          onChange={(e) => setParentPassword(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <input
          type="text"
          placeholder="PIN ใหม่ (4 ตัวเลข)"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          maxLength={4}
          style={{ marginBottom: 12 }}
        />
        {forgotError && <div className="error-text" style={{ marginBottom: 12 }}>{forgotError}</div>}
        <div className="row" style={{ gap: 8 }}>
          <button onClick={handleResetPin} disabled={resetting} style={{ flex: 1 }}>
            {resetting ? 'กำลังบันทึก...' : 'บันทึก PIN ใหม่'}
          </button>
          <button className="secondary" onClick={() => { setShowForgotPin(false); setParentPassword(''); setNewPin(''); setForgotError(''); }} disabled={resetting}>
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="play-root">
      <div className="play-mode-actions">
        <button className="secondary play-back-button" onClick={() => { setPicked(null); setPin(''); setError(''); }}>
          ← เลือกใหม่
        </button>
        <Link to="/parent"><button className="secondary">ผู้ปกครอง</button></Link>
      </div>
      <div className="pin-avatar">{picked.avatar}</div>
      <h2>สวัสดี {picked.name}! ใส่ PIN 4 ตัวนะ</h2>
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>
      {error && <div className="error-text" style={{ marginTop: 12, fontSize: 17 }}>{error}</div>}
      <div className="pin-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} className="pin-key" onClick={() => setPin((p) => (p + n).slice(0, 4))}>{n}</button>
        ))}
        <span />
        <button className="pin-key" onClick={() => setPin((p) => (p + '0').slice(0, 4))}>0</button>
        <button className="pin-key" onClick={() => setPin((p) => p.slice(0, -1))}>⌫</button>
      </div>
      <button className="secondary" style={{ marginTop: 16 }} onClick={() => setShowForgotPin(true)}>
        ลืม PIN?
      </button>
    </div>
  );
}
