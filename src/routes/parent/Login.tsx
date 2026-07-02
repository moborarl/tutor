import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api-client';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/auth/login', { email, password });
      nav('/parent');
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'invalid_credentials'
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div className="card">
        <h2>เข้าสู่ระบบผู้ปกครอง</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="อีเมล" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="รหัสผ่าน" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error-text">{error}</div>}
          <button type="submit" disabled={busy}>เข้าสู่ระบบ</button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>
          ยังไม่มีบัญชี? <Link to="/parent/signup">สมัครสมาชิก</Link>
        </p>
      </div>
    </div>
  );
}
