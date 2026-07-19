import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Child, ChildProgress } from '@shared/types';
import { AppState } from '../../components/AppState';
import { api } from '../../lib/api-client';
import { ALL_SUBJECTS } from './child-learning-state';
import { ChildLearningShell } from './components/ChildLearningShell';
import { ChildProgressMeter } from './components/ChildProgressMeter';
import { getSubjectTabId, SubjectSwitcher } from './components/SubjectSwitcher';

const FALLBACK_SUBJECT = 'ไม่ระบุวิชา';
const PROGRESS_SETS_PANEL_ID = 'child-progress-sets-panel';

function pct(value: number | null): string {
  return value == null ? 'ยังไม่มีคะแนน' : `${Math.round(value * 100)}%`;
}

export default function PlayProgress() {
  const [data, setData] = useState<ChildProgress | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [activeSubject, setActiveSubject] = useState(ALL_SUBJECTS);
  const activeChild: Child | null = JSON.parse(sessionStorage.getItem('activeChild') ?? 'null');

  const loadProgress = useCallback(() => {
    setLoadError(false);
    setData(null);
    api.get<ChildProgress>('/api/play/progress')
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const child = data?.child ?? activeChild;
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

  const assignedTotal = data?.subjects.reduce((sum, subject) => sum + subject.assignedCount, 0) ?? 0;
  const completedTotal = data?.subjects.reduce((sum, subject) => sum + subject.completedSetCount, 0) ?? 0;
  const visibleSets = data
    ? activeSubject === ALL_SUBJECTS
      ? data.sets
      : data.sets.filter((set) => (set.subjectName ?? FALLBACK_SUBJECT) === activeSubject)
    : [];
  const activeSubjectIndex = Math.max(
    0,
    [ALL_SUBJECTS, ...(data?.subjects.map((subject) => subject.subjectName) ?? [])].indexOf(activeSubject),
  );

  return (
    <ChildLearningShell
      child={child}
      eyebrow="ความคืบหน้าการเรียนรู้"
      title={`ความคืบหน้าของ ${child.name}`}
      summary={`ทำเสร็จแล้ว ${completedTotal} ชุด · เหลือ ${Math.max(0, assignedTotal - completedTotal)} ชุด`}
      actions={(
        <>
          <Link className="child-secondary-action" to="/play/exercises">
            <ArrowLeft aria-hidden="true" />
            แบบฝึกหัด
          </Link>
          <Link className="child-secondary-action" to="/parent/exercises">
            <ShieldCheck aria-hidden="true" />
            ผู้ปกครอง
          </Link>
        </>
      )}
    >
      {!data && !loadError && (
        <AppState tone="loading" title="กำลังโหลดความคืบหน้า" description="กำลังรวบรวมแบบฝึกหัดที่ทำเสร็จและที่เหลืออยู่" />
      )}

      {loadError && (
        <AppState
          tone="error"
          title="โหลดความคืบหน้าไม่สำเร็จ"
          description="ลองใหม่อีกครั้งได้จากหน้านี้"
          action={(
            <div className="child-state-actions">
              <button className="child-primary-action" type="button" onClick={loadProgress}>
                <RefreshCw aria-hidden="true" />
                ลองใหม่
              </button>
              <Link className="child-secondary-action" to="/play/exercises">
                <ArrowLeft aria-hidden="true" />
                แบบฝึกหัด
              </Link>
            </div>
          )}
        />
      )}

      {data && (
        <>
          <section className="child-overall-progress" aria-labelledby="progress-overall-heading">
            <div>
              <p className="child-section-kicker">แบบฝึกหัดทั้งหมด</p>
              <h2 id="progress-overall-heading">ทำเสร็จแล้วและที่เหลือ</h2>
              <p>ทำเสร็จแล้วทั้งหมด {data.totalCompletedAttempts} ครั้ง</p>
            </div>
            <ChildProgressMeter
              value={completedTotal}
              max={assignedTotal}
              label={`ทำแบบฝึกหัดเสร็จแล้ว ${completedTotal} จาก ${assignedTotal} ชุด`}
            />
          </section>

          {data.subjects.length === 0 ? (
            <AppState
              tone="empty"
              title="ยังไม่มีความคืบหน้า"
              description="ความคืบหน้าจะแสดงเมื่อมีแบบฝึกหัดที่ได้รับมอบหมาย"
              action={<Link className="child-secondary-action" to="/play/exercises">ไปที่แบบฝึกหัด</Link>}
            />
          ) : (
            <>
              <SubjectSwitcher
                subjects={data.subjects.map((subject) => ({
                  subjectName: subject.subjectName,
                  completed: subject.completedSetCount,
                  total: subject.assignedCount,
                }))}
                activeSubject={activeSubject}
                onChange={setActiveSubject}
                panelId={PROGRESS_SETS_PANEL_ID}
              />

              <section className="child-progress-section" aria-labelledby="subject-progress-heading">
                <div className="child-section-heading">
                  <div>
                    <p className="child-section-kicker">แยกตามวิชา</p>
                    <h2 id="subject-progress-heading">ความคืบหน้าของชุดแบบฝึกหัด</h2>
                  </div>
                </div>
                <div className="child-progress-subject-list" role="list">
                  {data.subjects.map((subject) => (
                    <article className="child-progress-subject" role="listitem" key={subject.subjectName}>
                      <div className="child-progress-subject-heading">
                        <div>
                          <h3>{subject.subjectName}</h3>
                          <strong>เสร็จแล้ว {subject.completedSetCount} ชุด · เหลือ {subject.remainingSetCount} ชุด</strong>
                        </div>
                        <span>คะแนนดีที่สุด {pct(subject.bestScore)}</span>
                      </div>
                      <ChildProgressMeter
                        value={subject.completedSetCount}
                        max={subject.assignedCount}
                        label={`${subject.subjectName}: ทำเสร็จแล้ว ${subject.completedSetCount} จาก ${subject.assignedCount} ชุด`}
                      />
                    </article>
                  ))}
                </div>
              </section>

              <section
                className="child-progress-section"
                role="tabpanel"
                id={PROGRESS_SETS_PANEL_ID}
                aria-labelledby={getSubjectTabId(PROGRESS_SETS_PANEL_ID, activeSubjectIndex)}
                tabIndex={0}
              >
                <div className="child-section-heading">
                  <div>
                    <p className="child-section-kicker">ชุดแบบฝึกหัด</p>
                    <h2 id="progress-sets-heading">ประวัติการทำ</h2>
                  </div>
                  <span>{visibleSets.length} ชุด</span>
                </div>
                {visibleSets.length === 0 ? (
                  <p className="child-inline-empty">ยังไม่มีชุดแบบฝึกหัดในวิชานี้</p>
                ) : (
                  <ul className="child-progress-set-list" role="list">
                    {visibleSets.map((set) => (
                      <li key={set.exerciseSetId}>
                        <Link className="child-progress-set-row" to={`/play/exercises/${set.exerciseSetId}`}>
                          <span>
                            <strong>{set.title || `Set ${set.exerciseSetId}`}</strong>
                            <small>{set.subjectName ?? FALLBACK_SUBJECT} · ทำ {set.attemptCount} ครั้ง</small>
                          </span>
                          <span>
                            <strong>{set.hasInProgress ? 'กำลังทำ' : pct(set.bestScore)}</strong>
                            <small>คะแนนดีที่สุด</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </ChildLearningShell>
  );
}
