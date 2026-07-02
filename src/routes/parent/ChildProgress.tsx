import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { ChildProgress as ChildProgressData } from '@shared/types';

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

export default function ChildProgress() {
  const { id } = useParams();
  const [data, setData] = useState<ChildProgressData | null>(null);

  useEffect(() => {
    api.get<ChildProgressData>(`/api/parent/children/${id}/progress`).then(setData);
  }, [id]);

  if (!data) return <div className="muted">กำลังโหลด...</div>;

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 44 }}>{data.child.avatar}</span>
        <div className="grow">
          <h2 style={{ margin: 0 }}>{data.child.name}</h2>
          <div className="muted">{data.child.ageBand === 'young' ? 'เด็กเล็ก' : 'เด็กโต'}</div>
        </div>
        <Link to="/parent/children"><button className="secondary">← กลับ</button></Link>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <div className="card grow" style={{ textAlign: 'center', marginBottom: 0 }}>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{data.totalCompletedAttempts}</div>
          <div className="muted">ครั้งที่ทำเสร็จ</div>
        </div>
        <div className="card grow" style={{ textAlign: 'center', marginBottom: 0 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--green)' }}>{pct(data.averageScore)}</div>
          <div className="muted">คะแนนเฉลี่ย</div>
        </div>
      </div>

      <div className="card">
        <h3>รายชุดแบบฝึกหัด</h3>
        {data.sets.length === 0 && <div className="muted">ยังไม่มีแบบฝึกหัดที่มอบหมาย</div>}
        {data.sets.map((s) => (
          <div key={s.exerciseSetId} style={{ marginBottom: 14 }}>
            <div className="row">
              <div className="grow">
                <b>{s.title || `ชุดที่ ${s.exerciseSetId}`}</b>
                <span className="muted"> · {s.subjectName ?? 'ไม่ระบุวิชา'} · ทำ {s.attemptCount} ครั้ง</span>
              </div>
              <span style={{ fontWeight: 700, color: 'var(--green)' }}>{pct(s.bestScore)}</span>
            </div>
            <div className="progress-bar-track" style={{ marginTop: 6 }}>
              <div className="progress-bar-fill" style={{ width: `${(s.bestScore ?? 0) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>ประวัติล่าสุด</h3>
        {data.recentAttempts.length === 0 && <div className="muted">ยังไม่มีประวัติ</div>}
        {data.recentAttempts.length > 0 && (
          <table className="data">
            <thead>
              <tr><th>ชุด</th><th>คะแนน</th><th>สถานะ</th><th>เมื่อ</th></tr>
            </thead>
            <tbody>
              {data.recentAttempts.map((a) => (
                <tr key={a.attemptId}>
                  <td>{a.exerciseSetTitle}</td>
                  <td>{pct(a.score)}</td>
                  <td>{a.status === 'completed' ? 'เสร็จ' : 'ค้างอยู่'}</td>
                  <td className="muted">{new Date(a.startedAt + 'Z').toLocaleString('th-TH')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
