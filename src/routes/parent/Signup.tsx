import { useState } from 'react';
import { ArrowLeft, UsersRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AppState } from '../../components/AppState';
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
    <main className="auth-shell">
      <section className="auth-intro" aria-labelledby="signup-title">
        <Link className="auth-back-link" to="/play">
          <ArrowLeft aria-hidden="true" /> กลับหน้าครอบครัว
        </Link>
        <div className="auth-intro-copy">
          <span className="auth-mark auth-mark-warm"><UsersRound aria-hidden="true" /></span>
          <p className="auth-eyebrow">Kids Tutor</p>
          <h1 id="signup-title">เริ่มพื้นที่การเรียนรู้ของครอบครัว</h1>
          <p>สร้างบัญชีผู้ปกครอง แล้วเพิ่มสมาชิกและแบบฝึกหัดได้ทันที</p>
        </div>
      </section>

      <section className="auth-form-panel" aria-label="สร้างบัญชีครอบครัว">
        <div className="auth-form-heading">
          <span>เริ่มต้นใช้งาน</span>
          <h2>สร้างบัญชีครอบครัว</h2>
          <p>ข้อมูลนี้แก้ไขภายหลังได้ในหน้าดูแลข้อมูล</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="signup-family">ชื่อครอบครัว</label>
          <input
            id="signup-family"
            type="text"
            autoComplete="organization"
            placeholder="เช่น ครอบครัวนุภาค"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
          <label htmlFor="signup-email">อีเมล</label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="signup-password">รหัสผ่าน</label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            aria-describedby="signup-password-help"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <span id="signup-password-help" className="auth-field-help">อย่างน้อย 8 ตัวอักษร</span>
          {error && <AppState tone="error" title={error} />}
          <button className="cfs-button cfs-button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี'}
          </button>
        </form>
        <p className="auth-switch">มีบัญชีแล้ว? <Link to="/parent/login">เข้าสู่ระบบ</Link></p>
      </section>
    </main>
  );
}
