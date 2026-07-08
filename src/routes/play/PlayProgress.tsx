import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { ChildProgress } from '@shared/types';

function pct(v: number | null): string {
  return v == null ? 'ยังไม่มีคะแนน' : `${Math.round(v * 100)}%`;
}

function completion(done: number, total: number): number {
  return total <= 0 ? 0 : Math.round((done / total) * 100);
}

export default function PlayProgress() {
  const nav = useNavigate();
  const [data, setData] = useState<ChildProgress | null>(null);

  useEffect(() => {
    api.get<ChildProgress>('/api/play/progress').then(setData).catch(() => nav('/play'));
  }, [nav]);

  if (!data) {
    return (
      <div className="play-root centered-play">
        <div className="state-card">
          <div className="state-spinner" />
          <b>กำลังโหลดความคืบหน้า</b>
          <span>รอสักครู่นะ</span>
        </div>
      </div>
    );
  }
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
          <Link to="/parent/exercises"><button className="secondary">ผู้ปกครอง</button></Link>
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
          <h3>วันนี้ควรทำอะไรต่อ</h3>
          {data.subjects.length === 0 && <div className="muted">ยังไม่มีข้อมูลตามวิชา</div>}
          {data.subjects.map((s) => (
            <div key={s.subjectName} className="subject-dashboard-row">
              <div className="subject-dashboard-head">
                <div>
                  <b>{s.subjectName}</b>
                  <div className="muted">ทำครบแล้ว {s.completedSetCount}/{s.assignedCount} ชุด</div>
                </div>
                <b className={s.remainingSetCount === 0 ? 'good-text' : ''}>
                  {s.remainingSetCount === 0 ? 'ครบแล้ว' : `เหลือ ${s.remainingSetCount} ชุด`}
                </b>
              </div>
              <div className="progress-track" aria-label={`ความคืบหน้า ${completion(s.completedSetCount, s.assignedCount)}%`}>
                <div className="progress-fill" style={{ width: `${completion(s.completedSetCount, s.assignedCount)}%` }} />
              </div>
              <div className="muted">คะแนนดีที่สุด {pct(s.bestScore)} · ทำทั้งหมด {s.completedAttempts} ครั้ง</div>
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
