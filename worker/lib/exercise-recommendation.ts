import type { PlayExercise } from '../../shared/types';

export function recommendNextExercise(
  exercises: PlayExercise[],
  currentExerciseId?: number,
): PlayExercise | null {
  const current = exercises.find((row) => row.id === currentExerciseId);
  const oldest = (rows: PlayExercise[]) =>
    [...rows].sort((a, b) => a.assignedAt.localeCompare(b.assignedAt))[0] ?? null;

  return oldest(exercises.filter((row) => row.id !== currentExerciseId && row.hasInProgress)) ??
    oldest(exercises.filter((row) => row.id !== currentExerciseId && row.completedCount === 0 && row.subjectName === current?.subjectName)) ??
    oldest(exercises.filter((row) => row.id !== currentExerciseId && row.completedCount === 0)) ??
    current ?? null;
}
