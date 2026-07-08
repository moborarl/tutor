import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api-client';

export default function Signup() {
  const nav = useNavigate();
  const [familyName, setFamilyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/auth/signup', { email, password, familyName });
      nav('/parent');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_taken') setError('อีเมลนี้ถูกใช้แล้ว');
      else if (err instanceof ApiError && err.code === 'password_too_short') setError('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
      else setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div className="card">
        <h2>สมัครสมาชิกผู้ปกครอง</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="text" placeholder="ชื่อครอบครัว เช่น ครอบครัวนุภาค" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
          <input type="email" placeholder="อีเมล" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="รหัสผ่าน (8 ตัวขึ้นไป)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          {error && <div className="error-text">{error}</div>}
          <button type="submit" disabled={busy}>สมัครสมาชิก</button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>
          มีบัญชีแล้ว? <Link to="/parent/login">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}
