import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { Child, PlayExercise } from '@shared/types';

export default function PlayExerciseList() {
  const nav = useNavigate();
  const [exercises, setExercises] = useState<PlayExercise[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const child: Child | null = JSON.parse(sessionStorage.getItem('activeChild') ?? 'null');

  useEffect(() => {
    api
      .get<PlayExercise[]>('/api/play/exercises')
      .then(setExercises)
      .catch(() => setLoadError(true));
  }, [nav]);

  async function switchProfile() {
    await api.post('/api/play/switch-profile');
    sessionStorage.removeItem('activeChild');
    nav('/play');
  }

  const uiSimple = child?.ageBand === 'young';
  const subjectRows = exercises
    ? [...exercises.reduce((map, ex) => {
      const name = ex.subjectName ?? 'ไม่ระบุวิชา';
      const row = map.get(name) ?? { subjectName: name, total: 0, completed: 0 };
      row.total += 1;
      if (ex.bestScore != null) row.completed += 1;
      map.set(name, row);
      return map;
    }, new Map<string, { subjectName: string; total: number; completed: number }>()).values()]
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'th'))
    : [];
  const groupedExercises = exercises
    ? [...exercises.reduce((map, ex) => {
      const name = ex.subjectName ?? 'ไม่ระบุวิชา';
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(ex);
      return map;
    }, new Map<string, PlayExercise[]>()).entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'th'))
    : [];

  return (
    <div className={`play-root ${uiSimple ? 'ui-simple' : ''}`}>
      <div className="kid-topbar">
        <span className="kid-topbar-avatar">{child?.avatar ?? '🙂'}</span>
        <h2>{child?.name ?? ''} มาทำแบบฝึกหัดกัน!</h2>
        <Link to="/play/progress"><button className="secondary">ดูความคืบหน้า</button></Link>
        <button className="secondary" onClick={switchProfile}>สลับคน</button>
      </div>

      {exercises === null && !loadError && (
        <div className="state-card">
          <div className="state-spinner" />
          <b>กำลังโหลดแบบฝึกหัด</b>
          <span>รอสักครู่นะ</span>
        </div>
      )}
      {loadError && (
        <div className="state-card error-state">
          <b>โหลดแบบฝึกหัดไม่สำเร็จ</b>
          <span>ลองกลับไปเลือกโปรไฟล์ใหม่อีกครั้ง</span>
          <button className="secondary" onClick={() => nav('/play')}>กลับไปเลือกโปรไฟล์</button>
        </div>
      )}
      {exercises?.length === 0 && (
        <div className="state-card empty-state">
          <div className="state-illustration">🎉</div>
          <h3>ยังไม่มีแบบฝึกหัด</h3>
          <span>รอผู้ปกครองมอบหมายแบบฝึกหัดให้นะ</span>
        </div>
      )}

      {subjectRows.length > 0 && (
        <div className="kid-dashboard">
          {subjectRows.map((s) => (
            <div key={s.subjectName} className="kid-dashboard-card">
              <b>{s.subjectName}</b>
              <span>{s.completed}/{s.total} ชุด</span>
              <small>{s.total - s.completed === 0 ? 'ครบแล้ว' : `เหลือ ${s.total - s.completed} ชุด`}</small>
            </div>
          ))}
        </div>
      )}

      <div className="kid-exercise-list">
        {groupedExercises.map(([subjectName, items]) => (
          <div key={subjectName} className="kid-subject-section">
            <h3>{subjectName}</h3>
            {items.map((ex) => (
          <Link key={ex.id} to={`/play/exercises/${ex.id}`} style={{ textDecoration: 'none' }}>
            <div className="card row kid-exercise-card">
              <div className="kid-exercise-icon">{ex.bestScore != null && ex.bestScore >= 0.999 ? '🌟' : '📝'}</div>
              <div className="grow">
                <div className="kid-exercise-title">{ex.title || 'แบบฝึกหัด'}</div>
                <div className="muted">
                  {ex.subjectName ? `${ex.subjectName} · ` : ''}{ex.questionCount} ข้อ
                  {ex.bestScore != null && ` · คะแนนดีสุด ${Math.round(ex.bestScore * 100)}%`}
                </div>
              </div>
              <span className="kid-exercise-arrow">▶️</span>
            </div>
          </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
