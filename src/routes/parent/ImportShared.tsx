import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api-client';

interface SharePreview {
  title: string;
  ageBand: 'young' | 'older';
  subjectName: string | null;
  questionCount: number;
}

// Landing page for a share link (/parent/import/:token): previews the shared
// set, then copies it into the current parent's library on confirm.
export default function ImportShared() {
  const { token } = useParams();
  const nav = useNavigate();
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<SharePreview>(`/api/parent/shared/${token}`).then(setPreview).catch(() => setNotFound(true));
  }, [token]);

  async function doImport() {
    setBusy(true);
    try {
      const res = await api.post<{ id: number }>(`/api/parent/shared/${token}/import`);
      nav(`/parent/exercises/${res.id}`);
    } catch {
      setBusy(false);
      alert('เพิ่มเข้าคลังไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  }

  if (notFound) {
    return (
      <div className="card">
        <h3>ไม่พบแบบฝึกหัดที่แชร์</h3>
        <p className="muted">ลิงก์อาจหมดอายุ หรือเจ้าของยกเลิกการแชร์แล้ว</p>
        <Link to="/parent/exercises"><button className="secondary">← กลับหน้าแบบฝึกหัด</button></Link>
      </div>
    );
  }
  if (!preview) return <div className="muted">กำลังโหลด...</div>;

  return (
    <div>
      <h2>แบบฝึกหัดที่แชร์มา</h2>
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 18 }}>{preview.title || 'แบบฝึกหัด'}</div>
        <div className="muted" style={{ marginTop: 4 }}>
          {preview.subjectName ?? 'ไม่ระบุวิชา'} · {preview.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'} · {preview.questionCount} ข้อ
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          กด "เพิ่มเข้าคลังของฉัน" เพื่อคัดลอกแบบฝึกหัดนี้เป็นของคุณ — คุณจะแก้ไข มอบหมายให้เด็ก และจัดการได้เองอย่างอิสระ
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <button onClick={doImport} disabled={busy}>{busy ? 'กำลังเพิ่ม...' : '+ เพิ่มเข้าคลังของฉัน'}</button>
          <Link to="/parent/exercises"><button className="secondary">ยกเลิก</button></Link>
        </div>
      </div>
    </div>
  );
}
