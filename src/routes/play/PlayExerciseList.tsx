import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api-client';
import type { Child, PlayExercise } from '@shared/types';

export default function PlayExerciseList() {
  const nav = useNavigate();
  const [exercises, setExercises] = useState<PlayExercise[] | null>(null);
  const child: Child | null = JSON.parse(sessionStorage.getItem('activeChild') ?? 'null');

  useEffect(() => {
    api
      .get<PlayExercise[]>('/api/play/exercises')
      .then(setExercises)
      .catch(() => nav('/play'));
  }, [nav]);

  async function switchProfile() {
    await api.post('/api/play/switch-profile');
    sessionStorage.removeItem('activeChild');
    nav('/play');
  }

  const uiSimple = child?.ageBand === 'young';

  return (
    <div className={`play-root ${uiSimple ? 'ui-simple' : ''}`}>
      <div className="row" style={{ width: '100%', maxWidth: 640 }}>
        <span style={{ fontSize: 40 }}>{child?.avatar ?? '🙂'}</span>
        <h2 className="grow" style={{ margin: 0 }}>{child?.name ?? ''} มาทำแบบฝึกหัดกัน!</h2>
        <button className="secondary" onClick={switchProfile}>สลับคน</button>
      </div>

      {exercises === null && <p>กำลังโหลด...</p>}
      {exercises?.length === 0 && (
        <div style={{ marginTop: 50, textAlign: 'center' }}>
          <div style={{ fontSize: 60 }}>🎉</div>
          <h3>ยังไม่มีแบบฝึกหัดจ้า รอผู้ปกครองมอบหมายนะ</h3>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 640, marginTop: 20 }}>
        {exercises?.map((ex) => (
          <Link key={ex.id} to={`/play/exercises/${ex.id}`} style={{ textDecoration: 'none' }}>
            <div className="card row" style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 36 }}>{ex.bestScore != null && ex.bestScore >= 0.999 ? '🌟' : '📝'}</div>
              <div className="grow">
                <div style={{ fontWeight: 700, fontSize: uiSimple ? 22 : 17 }}>{ex.title || 'แบบฝึกหัด'}</div>
                <div className="muted">
                  {ex.subjectName ? `${ex.subjectName} · ` : ''}{ex.questionCount} ข้อ
                  {ex.bestScore != null && ` · คะแนนดีสุด ${Math.round(ex.bestScore * 100)}%`}
                </div>
              </div>
              <span style={{ fontSize: 26 }}>▶️</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
