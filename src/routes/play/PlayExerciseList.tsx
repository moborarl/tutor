import { useCallback, useEffect, useState } from 'react';
import { BarChart3, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Child, PlayExercise } from '@shared/types';
import { AppState } from '../../components/AppState';
import { api } from '../../lib/api-client';
import {
  ALL_SUBJECTS,
  filterExercisesBySubject,
  selectResumeExercise,
  summarizeExercisesBySubject,
} from './child-learning-state';
import { ChildExerciseList } from './components/ChildExerciseList';
import { ChildLearningShell } from './components/ChildLearningShell';
import { ChildProgressMeter } from './components/ChildProgressMeter';
import { ResumeExercisePanel } from './components/ResumeExercisePanel';
import { getSubjectTabId, SubjectSwitcher } from './components/SubjectSwitcher';
import '../../styles/child-learning.css';

const DASHBOARD_EXERCISE_PANEL_ID = 'child-dashboard-exercise-panel';

export default function PlayExerciseList() {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<PlayExercise[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [activeSubject, setActiveSubject] = useState(ALL_SUBJECTS);
  const child: Child | null = JSON.parse(sessionStorage.getItem('activeChild') ?? 'null');

  const loadExercises = useCallback(() => {
    setLoadError(false);
    setExercises(null);
    api.get<PlayExercise[]>('/api/play/exercises')
      .then(setExercises)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  async function switchProfile() {
    await api.post('/api/play/switch-profile');
    sessionStorage.removeItem('activeChild');
    navigate('/play');
  }

  if (!child) {
    return (
      <main className="child-learning child-learning-entry-state">
        <AppState
          tone="empty"
          title="เลือกสมาชิกครอบครัว"
          description="เลือกเด็กก่อนเปิดหน้าความคืบหน้า"
          action={<Link className="child-primary-action" to="/play">เลือกสมาชิก</Link>}
        />
      </main>
    );
  }

  const rows = exercises ?? [];
  const completedCount = rows.filter((exercise) => exercise.completedCount > 0 || exercise.bestScore != null).length;
  const resumeExercise = selectResumeExercise(rows);
  const subjectSummaries = summarizeExercisesBySubject(rows);
  const filteredExercises = filterExercisesBySubject(rows, activeSubject);
  const activeSubjectIndex = Math.max(
    0,
    [ALL_SUBJECTS, ...subjectSummaries.map((subject) => subject.subjectName)].indexOf(activeSubject),
  );

  return (
    <ChildLearningShell
      child={child}
      eyebrow="การเรียนรู้ของฉัน"
      title={`${child.name} พร้อมทำแบบฝึกหัดหรือยัง?`}
      summary={`ทำเสร็จแล้ว ${completedCount} จาก ${rows.length} ชุด`}
      actions={(
        <>
          <Link className="child-secondary-action" to="/play/progress">
            <BarChart3 aria-hidden="true" />
            ความคืบหน้า
          </Link>
          <button className="child-secondary-action" type="button" onClick={switchProfile}>
            <Users aria-hidden="true" />
            สลับสมาชิก
          </button>
          <Link className="child-secondary-action" to="/parent/exercises">
            <ShieldCheck aria-hidden="true" />
            ผู้ปกครอง
          </Link>
        </>
      )}
    >
      {exercises === null && !loadError && (
        <AppState tone="loading" title="กำลังโหลดแบบฝึกหัด" description="อีกสักครู่จะพร้อมเริ่มทำแบบฝึกหัด" />
      )}

      {loadError && (
        <AppState
          tone="error"
          title="โหลดแบบฝึกหัดไม่สำเร็จ"
          description="ลองใหม่อีกครั้ง หรือเปิดหน้าผู้ปกครองหากยังมีปัญหา"
          action={(
            <div className="child-state-actions">
              <button className="child-primary-action" type="button" onClick={loadExercises}>
                <RefreshCw aria-hidden="true" />
                ลองใหม่
              </button>
              <Link className="child-secondary-action" to="/parent/exercises">
                <ShieldCheck aria-hidden="true" />
                หน้าผู้ปกครอง
              </Link>
            </div>
          )}
        />
      )}

      {exercises?.length === 0 && (
        <AppState
          tone="empty"
          title="ยังไม่มีแบบฝึกหัด"
          description="ผู้ปกครองสามารถมอบหมายชุดแบบฝึกหัดให้ได้เมื่อพร้อม"
          action={<Link className="child-secondary-action" to="/play">กลับไปเลือกสมาชิก</Link>}
        />
      )}

      {exercises && exercises.length > 0 && (
        <>
          <section className="child-overall-progress" aria-labelledby="overall-progress-heading">
            <div>
              <p className="child-section-kicker">วันนี้และต่อไป</p>
              <h2 id="overall-progress-heading">ความคืบหน้าโดยรวม</h2>
            </div>
            <ChildProgressMeter
              value={completedCount}
              max={exercises.length}
              label={`ทำแบบฝึกหัดเสร็จแล้ว ${completedCount} จาก ${exercises.length} ชุด`}
            />
          </section>

          {resumeExercise && <ResumeExercisePanel exercise={resumeExercise} />}

          <section className="child-assigned-work" aria-labelledby="assigned-work-heading">
            <div className="child-section-heading">
              <div>
                <p className="child-section-kicker">แบบฝึกหัดที่ได้รับมอบหมาย</p>
                <h2 id="assigned-work-heading">เลือกแบบฝึกหัด</h2>
              </div>
              <span>{filteredExercises.length} ชุด</span>
            </div>
            <SubjectSwitcher
              subjects={subjectSummaries}
              activeSubject={activeSubject}
              onChange={setActiveSubject}
              panelId={DASHBOARD_EXERCISE_PANEL_ID}
            />
            <div
              className="child-exercise-panel"
              role="tabpanel"
              id={DASHBOARD_EXERCISE_PANEL_ID}
              aria-labelledby={getSubjectTabId(DASHBOARD_EXERCISE_PANEL_ID, activeSubjectIndex)}
              tabIndex={0}
            >
              <ChildExerciseList exercises={filteredExercises} />
            </div>
          </section>
        </>
      )}
    </ChildLearningShell>
  );
}
