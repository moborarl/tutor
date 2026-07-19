import type { PlayExercise } from '../../../shared/types';

export const ALL_SUBJECTS = 'ทั้งหมด';
export const UNCATEGORIZED_SUBJECT = 'ไม่ระบุวิชา';

export interface ChildSubjectSummary {
  subjectName: string;
  completed: number;
  total: number;
}

export type ExamQuestionSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export interface ExamQuestionSaveState {
  status: ExamQuestionSaveStatus;
  message: string | null;
}

export interface ExamSaveState {
  questions: Record<number, ExamQuestionSaveState>;
}

export type ExamSaveAction =
  | { type: 'answer-edited'; questionId: number }
  | { type: 'save-started'; questionId: number }
  | { type: 'save-succeeded'; questionId: number }
  | { type: 'save-failed'; questionId: number; message: string };

export const initialExamSaveState: ExamSaveState = { questions: {} };

export function examSaveReducer(state: ExamSaveState, action: ExamSaveAction): ExamSaveState {
  const next: ExamQuestionSaveState = action.type === 'save-failed'
    ? { status: 'failed', message: action.message }
    : action.type === 'save-succeeded'
      ? { status: 'saved', message: null }
      : action.type === 'save-started'
        ? { status: 'saving', message: null }
        : { status: 'idle', message: null };
  return {
    ...state,
    questions: {
      ...state.questions,
      [action.questionId]: next,
    },
  };
}

export function canSubmitExam(state: ExamSaveState): boolean {
  return Object.values(state.questions).every(
    (row) => row.status !== 'saving' && row.status !== 'failed' && row.status !== 'idle',
  );
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
