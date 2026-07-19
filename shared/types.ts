// Shared types between the Worker API and the React SPA.
import type { DiagramSpec } from './diagram';

export type AgeBand = 'young' | 'older';

export type LearningMode = 'guided' | 'exam';

export type ExerciseSetStatus =
  | 'processing'
  | 'extracting'
  | 'pending_review'
  | 'extraction_failed'
  | 'published'
  | 'archived';

export type ExtractionProvider = 'claude' | 'other_cloud' | 'pi';

export type QuestionType = 'multiple_choice' | 'fill_blank' | 'matching' | 'true_false' | 'fraction' | 'ordering';

export interface Child {
  id: number;
  name: string;
  avatar: string;
  ageBand: AgeBand;
}

export interface Subject {
  id: number;
  name: string;
}

export interface ExerciseSetSummary {
  id: number;
  title: string;
  subjectId: number | null;
  subjectName: string | null;
  ageBand: AgeBand;
  status: ExerciseSetStatus;
  learningMode: LearningMode;
  extractionProvider: ExtractionProvider | null;
  extractionError: string | null;
  questionCount: number;
  createdAt: string;
}

// --- Question content/answer payloads by type ---

export interface MultipleChoiceContent {
  options: string[];
}
export interface MultipleChoiceAnswer {
  correctIndex: number;
  rationale?: string;
}

export type QuestionDifficulty = 'easy' | 'medium' | 'challenging';
export type AiProvider = 'openai' | 'gemini' | 'anthropic' | 'custom';
export type CustomAiFormat = 'responses' | 'chat_completions';

export interface ReasoningRubric {
  keyIdeas: string[];
  misconceptions?: string[];
}

export interface ReasoningFeedback {
  status: 'completed' | 'unavailable' | 'limit_reached' | 'failed';
  assessment?: 'understands' | 'partial' | 'misconception';
  message: string;
}

export interface AttemptAnswerView {
  questionId: number;
  givenAnswer: unknown;
  timeSpentMs: number | null;
  reasoningText: string | null;
  isCorrect?: boolean;
  correctAnswer?: unknown;
  explanation?: string | null;
  reasoningFeedback?: ReasoningFeedback | null;
}

export interface AttemptStartResponse {
  attemptId: number;
  learningMode: LearningMode;
  existingAnswers: AttemptAnswerView[];
}

export interface AttemptCompletionResponse {
  score: number;
  correct: number;
  total: number;
  learningMode: LearningMode;
  subjectProgress: {
    subjectName: string | null;
    completed: number;
    assigned: number;
  };
}

export interface AttemptResultQuestion extends Required<Pick<AttemptAnswerView, 'questionId' | 'givenAnswer'>> {
  prompt: string;
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string | null;
  reasoningText: string | null;
  reasoningFeedback: ReasoningFeedback | null;
}

export interface AttemptResult {
  attemptId: number;
  exerciseSetId: number;
  exerciseTitle: string;
  subjectName: string | null;
  learningMode: LearningMode;
  score: number;
  correct: number;
  total: number;
  subjectCompleted: number;
  subjectAssigned: number;
  questions: AttemptResultQuestion[];
  recommendation: PlayExercise | null;
}

// prompt contains ___ where the blank goes; answers accepts any listed string
export interface FillBlankContent {
  hint?: string;
}
export interface FillBlankAnswer {
  answers: string[];
}

export interface MatchingContent {
  left: string[];
  right: string[]; // shuffled for display
}
export interface MatchingAnswer {
  // pairs[i] = index into right[] that matches left[i]
  pairs: number[];
}

export interface TrueFalseContent {}
export interface TrueFalseAnswer {
  value: boolean;
}

// Child enters numerator + denominator separately; accepts reduced forms (2/4 = 1/2)
export interface FractionContent {}
export interface FractionAnswer {
  numerator: number;
  denominator: number;
}

// Child drags items into correct order; accepts any correct arrangement
export interface OrderingContent {
  items: string[];
}
export interface OrderingAnswer {
  // indices[i] = index of the i-th item in the correct order
  indices: number[];
}

export interface Question {
  id: number;
  orderIndex: number;
  questionType: QuestionType;
  prompt: string;
  content: unknown;
  status: 'draft' | 'approved';
  explanation: string | null;
  imageId: number | null;
  // Structured diagram data, rendered deterministically by our own components.
  // Only used when imageId is not set (a real photo always takes priority).
  diagram: DiagramSpec | null;
  difficulty?: QuestionDifficulty | null;
  learningObjective?: string | null;
  reasoningPrompt?: string | null;
  reasoningRubric?: ReasoningRubric | null;
}

// Parent review view includes the answer; kid play view does not.
export interface QuestionWithAnswer extends Question {
  answer: unknown;
}

export interface ExerciseSetDetail extends ExerciseSetSummary {
  questions: QuestionWithAnswer[];
  assignedChildIds: number[];
  images: { id: number; orderIndex: number }[];
}

// --- Play (kid) side ---

export interface PlayExercise {
  id: number;
  title: string;
  subjectName: string | null;
  questionCount: number;
  // best completed score 0..1, null if never completed
  bestScore: number | null;
  completedCount: number;
  learningMode: LearningMode;
  hasInProgress: boolean;
  inProgressAnsweredCount: number;
  assignedAt: string;
}

export interface PlayQuestion {
  id: number;
  orderIndex: number;
  questionType: QuestionType;
  prompt: string;
  content: unknown;
  imageId: number | null;
  diagram: DiagramSpec | null;
  reasoningPrompt: string | null;
}

export interface AnswerResult {
  isCorrect: boolean;
  // revealed after answering so the kid gets feedback
  correctAnswer: unknown;
  explanation: string | null;
  reasoningFeedback?: ReasoningFeedback | null;
}

// --- Progress (parent dashboard) ---

export interface ProgressSetRow {
  exerciseSetId: number;
  title: string;
  subjectName: string | null;
  attemptCount: number;
  bestScore: number | null;
  lastScore: number | null;
  lastAttemptAt: string | null;
  // true if the child has an unfinished attempt on this set (exited before
  // completing) — only a parent-triggered reset clears this, so surface it
  // so the parent knows there's something to reset.
  hasInProgress: boolean;
}

export interface SubjectProgressRow {
  subjectName: string;
  assignedCount: number;
  completedSetCount: number;
  remainingSetCount: number;
  completedAttempts: number;
  bestScore: number | null;
}

export interface RecentAttemptRow {
  attemptId: number;
  exerciseSetTitle: string;
  score: number | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface ChildProgress {
  child: Child;
  totalCompletedAttempts: number;
  averageScore: number | null;
  subjects: SubjectProgressRow[];
  sets: ProgressSetRow[];
  recentAttempts: RecentAttemptRow[];
}

// AI extraction output shape (shared with Pi service contract)
export interface ExtractedQuestion {
  questionType: QuestionType;
  prompt: string;
  content: unknown;
  answer: unknown;
  explanation?: string;
  // 1-indexed reference to the uploaded worksheet photo (in upload order) that
  // contains a diagram/figure this question depends on, if any.
  imagePage?: number;
  // Structured diagram data (e.g. force arrows) for questions that need a
  // visual — rendered deterministically by our own components, not AI-drawn.
  diagram?: DiagramSpec;
  difficulty?: QuestionDifficulty;
  learningObjective?: string;
  reasoningPrompt?: string;
  reasoningRubric?: ReasoningRubric;
  distractorRationales?: string[];
}
