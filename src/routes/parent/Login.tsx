import { useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AppState } from '../../components/AppState';
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
    <main className="auth-shell">
      <section className="auth-intro" aria-labelledby="login-title">
        <Link className="auth-back-link" to="/play">
          <ArrowLeft aria-hidden="true" /> กลับหน้าครอบครัว
        </Link>
        <div className="auth-intro-copy">
          <span className="auth-mark"><ShieldCheck aria-hidden="true" /></span>
          <p className="auth-eyebrow">Kids Tutor</p>
          <h1 id="login-title">พื้นที่สำหรับผู้ปกครอง</h1>
          <p>จัดการสมาชิก แบบฝึกหัด และความคืบหน้าของครอบครัวในที่เดียว</p>
        </div>
      </section>

      <section className="auth-form-panel" aria-label="เข้าสู่ระบบ">
        <div className="auth-form-heading">
          <span>ยินดีต้อนรับกลับ</span>
          <h2>เข้าสู่ระบบ</h2>
          <p>ใช้บัญชีผู้ปกครองของครอบครัว</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="login-email">อีเมล</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="login-password">รหัสผ่าน</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <AppState tone="error" title={error} />}
          <button className="cfs-button cfs-button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        <p className="auth-switch">ยังไม่มีบัญชี? <Link to="/parent/signup">สร้างบัญชีครอบครัว</Link></p>
      </section>
    </main>
  );
}
