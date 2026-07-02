import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api-client';
import type { Child } from '@shared/types';

export default function ProfilePicker() {
  const nav = useNavigate();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [picked, setPicked] = useState<Child | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    api
      .get<Child[]>('/api/play/children')
      .then(setChildren)
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

  if (needLogin) {
    return (
      <div className="play-root" style={{ justifyContent: 'center' }}>
        <div style={{ fontSize: 60 }}>🔒</div>
        <h2>ให้ผู้ปกครองเข้าสู่ระบบก่อนนะ</h2>
        <Link to="/parent/login"><button>ผู้ปกครองเข้าสู่ระบบ</button></Link>
      </div>
    );
  }

  if (!children) return <div className="play-root" style={{ justifyContent: 'center' }}>กำลังโหลด...</div>;

  if (!picked) {
    return (
      <div className="play-root">
        <h1 style={{ fontSize: 34 }}>หนูคือใครเอ่ย? 👋</h1>
        <div className="profile-grid">
          {children.map((ch) => (
            <button key={ch.id} className="profile-tile" onClick={() => { setPicked(ch); setError(''); }}>
              <span className="avatar">{ch.avatar}</span>
              <span>{ch.name}</span>
            </button>
          ))}
        </div>
        {children.length === 0 && (
          <p className="muted" style={{ marginTop: 30 }}>
            ยังไม่มีโปรไฟล์ — ให้ผู้ปกครองเพิ่มที่หน้า <Link to="/parent/children">จัดการลูกๆ</Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="play-root">
      <button className="secondary" style={{ alignSelf: 'flex-start' }} onClick={() => { setPicked(null); setPin(''); }}>
        ← เลือกใหม่
      </button>
      <div style={{ fontSize: 70, marginTop: 10 }}>{picked.avatar}</div>
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
    </div>
  );
}
