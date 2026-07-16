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
  return value == null ? 'No score yet' : `${Math.round(value * 100)}%`;
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
          title="Choose a family member"
          description="Select a learner before opening progress."
          action={<Link className="child-primary-action" to="/play">Choose member</Link>}
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
      eyebrow="Learning progress"
      title={`${child.name}'s progress`}
      summary={`${completedTotal} completed · ${Math.max(0, assignedTotal - completedTotal)} remaining`}
      actions={(
        <>
          <Link className="child-secondary-action" to="/play/exercises">
            <ArrowLeft aria-hidden="true" />
            Dashboard
          </Link>
          <Link className="child-secondary-action" to="/parent/exercises">
            <ShieldCheck aria-hidden="true" />
            Parent
          </Link>
        </>
      )}
    >
      {!data && !loadError && (
        <AppState tone="loading" title="Loading progress" description="Collecting completed and remaining work." />
      )}

      {loadError && (
        <AppState
          tone="error"
          title="Progress could not be loaded"
          description="Try again without leaving this page."
          action={(
            <div className="child-state-actions">
              <button className="child-primary-action" type="button" onClick={loadProgress}>
                <RefreshCw aria-hidden="true" />
                Retry
              </button>
              <Link className="child-secondary-action" to="/play/exercises">
                <ArrowLeft aria-hidden="true" />
                Dashboard
              </Link>
            </div>
          )}
        />
      )}

      {data && (
        <>
          <section className="child-overall-progress" aria-labelledby="progress-overall-heading">
            <div>
              <p className="child-section-kicker">All assigned work</p>
              <h2 id="progress-overall-heading">Completed and remaining</h2>
              <p>{data.totalCompletedAttempts} completed attempts in total</p>
            </div>
            <ChildProgressMeter
              value={completedTotal}
              max={assignedTotal}
              label={`${completedTotal} of ${assignedTotal} exercise sets completed`}
            />
          </section>

          {data.subjects.length === 0 ? (
            <AppState
              tone="empty"
              title="No progress yet"
              description="Completed and remaining work will appear after exercises are assigned."
              action={<Link className="child-secondary-action" to="/play/exercises">Dashboard</Link>}
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
                    <p className="child-section-kicker">By subject</p>
                    <h2 id="subject-progress-heading">Set progress</h2>
                  </div>
                </div>
                <div className="child-progress-subject-list" role="list">
                  {data.subjects.map((subject) => (
                    <article className="child-progress-subject" role="listitem" key={subject.subjectName}>
                      <div className="child-progress-subject-heading">
                        <div>
                          <h3>{subject.subjectName}</h3>
                          <strong>{subject.completedSetCount} completed · {subject.remainingSetCount} remaining</strong>
                        </div>
                        <span>Best score {pct(subject.bestScore)}</span>
                      </div>
                      <ChildProgressMeter
                        value={subject.completedSetCount}
                        max={subject.assignedCount}
                        label={`${subject.subjectName}: ${subject.completedSetCount} of ${subject.assignedCount} sets completed`}
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
                    <p className="child-section-kicker">Exercise sets</p>
                    <h2 id="progress-sets-heading">Practice history</h2>
                  </div>
                  <span>{visibleSets.length} sets</span>
                </div>
                {visibleSets.length === 0 ? (
                  <p className="child-inline-empty">No exercise sets in this subject.</p>
                ) : (
                  <ul className="child-progress-set-list" role="list">
                    {visibleSets.map((set) => (
                      <li key={set.exerciseSetId}>
                        <Link className="child-progress-set-row" to={`/play/exercises/${set.exerciseSetId}`}>
                          <span>
                            <strong>{set.title || `Set ${set.exerciseSetId}`}</strong>
                            <small>{set.subjectName ?? FALLBACK_SUBJECT} · {set.attemptCount} attempts</small>
                          </span>
                          <span>
                            <strong>{set.hasInProgress ? 'In progress' : pct(set.bestScore)}</strong>
                            <small>Best score</small>
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
