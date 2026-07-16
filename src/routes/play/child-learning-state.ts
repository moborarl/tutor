import type { PlayExercise } from '../../../shared/types';

export const ALL_SUBJECTS = 'ทั้งหมด';
export const UNCATEGORIZED_SUBJECT = 'ไม่ระบุวิชา';

export interface ChildSubjectSummary {
  subjectName: string;
  completed: number;
  total: number;
}

export function normalizeSubjectName(subjectName: string | null): string {
  return subjectName ?? UNCATEGORIZED_SUBJECT;
}

export function selectResumeExercise(rows: PlayExercise[]): PlayExercise | null {
  return rows.find((row) => row.hasInProgress) ?? null;
}

export function filterExercisesBySubject(rows: PlayExercise[], subject: string): PlayExercise[] {
  return subject === ALL_SUBJECTS
    ? rows
    : rows.filter((row) => normalizeSubjectName(row.subjectName) === subject);
}

export function summarizeExercisesBySubject(rows: PlayExercise[]): ChildSubjectSummary[] {
  const subjects = new Map<string, ChildSubjectSummary>();
  for (const exercise of rows) {
    const subjectName = normalizeSubjectName(exercise.subjectName);
    const summary = subjects.get(subjectName) ?? { subjectName, completed: 0, total: 0 };
    summary.total += 1;
    if (exercise.completedCount > 0 || exercise.bestScore != null) summary.completed += 1;
    subjects.set(subjectName, summary);
  }
  return [...subjects.values()];
}
