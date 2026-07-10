import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api-client';
import { ChildAvatar } from '../../components/ChildAvatar';
import type { ChildProgress } from '@shared/types';

function pct(v: number | null): string {
  return v == null ? 'ยังไม่มีคะแนน' : `${Math.round(v * 100)}%`;
}

function completion(done: number, total: number): number {
  return total <= 0 ? 0 : Math.round((done / total) * 100);
}

function scoreClass(score: number | null) {
  if (score == null) return 'todo';
  if (score >= 0.8) return 'great';
  if (score >= 0.5) return 'done';
  return 'review';
}

export default function PlayProgress() {
  const nav = useNavigate();
  const [data, setData] = useState<ChildProgress | null>(null);
  const [activeSubject, setActiveSubject] = useState('all');

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
  const assignedTotal = data.subjects.reduce((sum, s) => sum + s.assignedCount, 0);
  const completedTotal = data.subjects.reduce((sum, s) => sum + s.completedSetCount, 0);
  const overall = completion(completedTotal, assignedTotal);
  const visibleSets = activeSubject === 'all'
    ? data.sets
    : data.sets.filter((set) => (set.subjectName ?? 'ไม่ระบุวิชา') === activeSubject);

  return (
    <div className={`play-root ${uiSimple ? 'ui-simple' : ''}`}>
      <div className="play-progress-shell">
        <div className="play-progress-hero">
          <ChildAvatar child={data.child} size="lg" />
          <div className="grow">
            <h2>ความคืบหน้าของ {data.child.name}</h2>
            <div className="muted">ทำครบแล้ว {completedTotal}/{assignedTotal} ชุด · ทั้งหมด {data.totalCompletedAttempts} ครั้ง</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${overall}%` }} /></div>
          </div>
          <Link to="/play/exercises"><button className="secondary">กลับ</button></Link>
          <Link to="/parent/exercises"><button className="secondary">ผู้ปกครอง</button></Link>
        </div>

        <div className="play-progress-stats">
          <div className="card">
            <div className="play-progress-number">{overall}%</div>
            <div className="muted">ความคืบหน้ารวม</div>
          </div>
          <div className="card">
            <div className="play-progress-number">{data.subjects.length}</div>
            <div className="muted">วิชาที่ฝึกอยู่</div>
          </div>
        </div>

        <div className="progress-explorer">
          <aside className="progress-tree">
            <button className={activeSubject === 'all' ? 'active' : ''} onClick={() => setActiveSubject('all')}>
              <span>ทั้งหมด</span><b>{assignedTotal}</b>
            </button>
            {data.subjects.map((s) => (
              <button key={s.subjectName} className={activeSubject === s.subjectName ? 'active' : ''} onClick={() => setActiveSubject(s.subjectName)}>
                <span>{s.subjectName}</span><b>{s.completedSetCount}/{s.assignedCount}</b>
              </button>
            ))}
          </aside>

          <section className="progress-workspace">
            <div className="card">
              <h3>ความคืบหน้าตามวิชา</h3>
              {data.subjects.length === 0 && <div className="muted">ยังไม่มีข้อมูลตามวิชา</div>}
              {data.subjects.map((s) => {
                const done = completion(s.completedSetCount, s.assignedCount);
                return (
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
                    <div className="progress-track" aria-label={`ความคืบหน้า ${done}%`}>
                      <div className="progress-fill" style={{ width: `${done}%` }} />
                    </div>
                    <div className="muted">คะแนนดีที่สุด {pct(s.bestScore)} · ทำทั้งหมด {s.completedAttempts} ครั้ง</div>
                  </div>
                );
              })}
            </div>

            <div className="card">
              <h3>แบบฝึกหัดของฉัน</h3>
              {visibleSets.length === 0 && <div className="muted">ยังไม่มีแบบฝึกหัดในกลุ่มนี้</div>}
              {visibleSets.map((s) => (
                <Link key={s.exerciseSetId} to={`/play/exercises/${s.exerciseSetId}`} className="play-progress-row progress-set-link">
                  <div className="grow">
                    <b>{s.title || `ชุดที่ ${s.exerciseSetId}`}</b>
                    <div className="muted">{s.subjectName ?? 'ไม่ระบุวิชา'} · ทำ {s.attemptCount} ครั้ง{s.hasInProgress ? ' · มีงานค้าง' : ''}</div>
                  </div>
                  <b className={`kid-exercise-status ${scoreClass(s.bestScore)}`}>{pct(s.bestScore)}</b>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
