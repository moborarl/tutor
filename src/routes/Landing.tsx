import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="play-root" style={{ justifyContent: 'center' }}>
      <h1 style={{ fontSize: 40 }}>📚 Kids Tutor</h1>
      <p className="muted" style={{ fontSize: 18 }}>ระบบทำแบบฝึกหัดสำหรับเด็ก</p>
      <div className="row" style={{ marginTop: 30, justifyContent: 'center' }}>
        <Link to="/play">
          <button style={{ fontSize: 24, padding: '20px 40px', borderRadius: 20 }}>
            🎮 หนูมาทำแบบฝึกหัด
          </button>
        </Link>
        <Link to="/parent">
          <button className="secondary" style={{ fontSize: 18, padding: '16px 28px' }}>
            👨‍👩‍👧 ผู้ปกครอง
          </button>
        </Link>
      </div>
    </div>
  );
}
