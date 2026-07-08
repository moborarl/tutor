import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { ChildProgress } from '@shared/types';

function pct(v: number | null): string {
  return v == null ? 'ยังไม่มีคะแนน' : `${Math.round(v * 100)}%`;
}

export default function PlayProgress() {
  const nav = useNavigate();
  const [data, setData] = useState<ChildProgress | null>(null);

  useEffect(() => {
    api.get<ChildProgress>('/api/play/progress').then(setData).catch(() => nav('/play'));
  }, [nav]);

  if (!data) return <div className="play-root" style={{ justifyContent: 'center' }}>กำลังโหลด...</div>;
  const uiSimple = data.child.ageBand === 'young';

  return (
    <div className={`play-root ${uiSimple ? 'ui-simple' : ''}`}>
      <div className="play-progress-shell">
        <div className="row">
          <span style={{ fontSize: 44 }}>{data.child.avatar}</span>
          <div className="grow">
            <h2 style={{ margin: 0 }}>ความคืบหน้าของ {data.child.name}</h2>
            <div className="muted">ดูคะแนนและแบบฝึกหัดที่เคยทำ</div>
          </div>
          <Link to="/play/exercises"><button className="secondary">กลับ</button></Link>
        </div>

        <div className="play-progress-stats">
          <div className="card">
            <div className="play-progress-number">{data.totalCompletedAttempts}</div>
            <div className="muted">ทำเสร็จแล้ว</div>
          </div>
          <div className="card">
            <div className="play-progress-number">{data.subjects.length}</div>
            <div className="muted">วิชาที่ฝึกอยู่</div>
          </div>
        </div>

        <div className="card">
          <h3>ความคืบหน้าตามวิชา</h3>
          {data.subjects.length === 0 && <div className="muted">ยังไม่มีข้อมูลตามวิชา</div>}
          {data.subjects.map((s) => (
            <div key={s.subjectName} className="play-progress-row">
              <div className="grow">
                <b>{s.subjectName}</b>
                <div className="muted">{s.assignedCount} ชุด · ทำเสร็จ {s.completedAttempts} ครั้ง</div>
              </div>
              <b className="good-text">{pct(s.bestScore)}</b>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>แบบฝึกหัดของฉัน</h3>
          {data.sets.length === 0 && <div className="muted">ยังไม่มีแบบฝึกหัดที่มอบหมาย</div>}
          {data.sets.map((s) => (
            <div key={s.exerciseSetId} className="play-progress-row">
              <div className="grow">
                <b>{s.title || `ชุดที่ ${s.exerciseSetId}`}</b>
                <div className="muted">{s.subjectName ?? 'ไม่ระบุวิชา'} · ทำ {s.attemptCount} ครั้ง</div>
              </div>
              <b className="good-text">{pct(s.bestScore)}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
