import type { PlayExercise } from '../../../shared/types';

export const ALL_SUBJECTS = 'ทั้งหมด';

export function selectResumeExercise(rows: PlayExercise[]): PlayExercise | null {
  return rows.find((row) => row.hasInProgress) ?? null;
}

export function filterExercisesBySubject(rows: PlayExercise[], subject: string): PlayExercise[] {
  return subject === ALL_SUBJECTS ? rows : rows.filter((row) => row.subjectName === subject);
}
