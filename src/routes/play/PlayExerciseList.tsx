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
} from './child-learning-state';
import { ChildExerciseList } from './components/ChildExerciseList';
import { ChildLearningShell } from './components/ChildLearningShell';
import { ChildProgressMeter } from './components/ChildProgressMeter';
import { ResumeExercisePanel } from './components/ResumeExercisePanel';
import { SubjectSwitcher, type ChildSubjectSummary } from './components/SubjectSwitcher';

function summarizeSubjects(exercises: PlayExercise[]): ChildSubjectSummary[] {
  const subjects = new Map<string, ChildSubjectSummary>();
  for (const exercise of exercises) {
    if (!exercise.subjectName) continue;
    const summary = subjects.get(exercise.subjectName) ?? {
      subjectName: exercise.subjectName,
      completed: 0,
      total: 0,
    };
    summary.total += 1;
    if (exercise.completedCount > 0 || exercise.bestScore != null) summary.completed += 1;
    subjects.set(exercise.subjectName, summary);
  }
  return [...subjects.values()];
}

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
          title="Choose a family member"
          description="Select a learner before opening the dashboard."
          action={<Link className="child-primary-action" to="/play">Choose member</Link>}
        />
      </main>
    );
  }

  const rows = exercises ?? [];
  const completedCount = rows.filter((exercise) => exercise.completedCount > 0 || exercise.bestScore != null).length;
  const resumeExercise = selectResumeExercise(rows);
  const subjectSummaries = summarizeSubjects(rows);
  const filteredExercises = filterExercisesBySubject(rows, activeSubject);

  return (
    <ChildLearningShell
      child={child}
      eyebrow="My learning"
      title={`Ready, ${child.name}?`}
      summary={`${completedCount} of ${rows.length} sets completed`}
      actions={(
        <>
          <Link className="child-secondary-action" to="/play/progress">
            <BarChart3 aria-hidden="true" />
            Progress
          </Link>
          <button className="child-secondary-action" type="button" onClick={switchProfile}>
            <Users aria-hidden="true" />
            Switch member
          </button>
          <Link className="child-secondary-action" to="/parent/exercises">
            <ShieldCheck aria-hidden="true" />
            Parent
          </Link>
        </>
      )}
    >
      {exercises === null && !loadError && (
        <AppState tone="loading" title="Loading your exercises" description="Your next activity will be ready shortly." />
      )}

      {loadError && (
        <AppState
          tone="error"
          title="Exercises could not be loaded"
          description="Try again, or use parent access if the problem continues."
          action={(
            <div className="child-state-actions">
              <button className="child-primary-action" type="button" onClick={loadExercises}>
                <RefreshCw aria-hidden="true" />
                Retry
              </button>
              <Link className="child-secondary-action" to="/parent/exercises">
                <ShieldCheck aria-hidden="true" />
                Parent access
              </Link>
            </div>
          )}
        />
      )}

      {exercises?.length === 0 && (
        <AppState
          tone="empty"
          title="No exercises yet"
          description="A parent can assign practice sets when they are ready."
          action={<Link className="child-secondary-action" to="/play">Back to member selection</Link>}
        />
      )}

      {exercises && exercises.length > 0 && (
        <>
          <section className="child-overall-progress" aria-labelledby="overall-progress-heading">
            <div>
              <p className="child-section-kicker">Today and beyond</p>
              <h2 id="overall-progress-heading">Overall progress</h2>
            </div>
            <ChildProgressMeter
              value={completedCount}
              max={exercises.length}
              label={`${completedCount} of ${exercises.length} exercise sets completed`}
            />
          </section>

          {resumeExercise && <ResumeExercisePanel exercise={resumeExercise} />}

          <section className="child-assigned-work" aria-labelledby="assigned-work-heading">
            <div className="child-section-heading">
              <div>
                <p className="child-section-kicker">Assigned work</p>
                <h2 id="assigned-work-heading">Choose an exercise</h2>
              </div>
              <span>{filteredExercises.length} sets</span>
            </div>
            <SubjectSwitcher
              subjects={subjectSummaries}
              activeSubject={activeSubject}
              onChange={setActiveSubject}
            />
            <ChildExerciseList exercises={filteredExercises} />
          </section>
        </>
      )}
    </ChildLearningShell>
  );
}
