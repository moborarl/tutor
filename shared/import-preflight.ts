import type { ExtractedQuestion, QuestionType } from './types';
import { validateDiagram } from './diagram';
import { parseJsonWithRepair } from './json-repair';

const VALID_TYPES: QuestionType[] = ['multiple_choice', 'fill_blank', 'matching', 'true_false', 'fraction', 'ordering'];

export type ImportResult =
  | { ok: true; title: string; questions: ExtractedQuestion[] }
  | { ok: false; error: string };

export type ValidationResult = { ok: true } | { ok: false; error: string };

export interface ImportPreflightIssue {
  level: 'error' | 'warning';
  questionNumber?: number;
  message: string;
}

export interface ImportPreflightReport {
  ok: boolean;
  title: string;
  questionCount: number;
  validQuestionCount: number;
  questionTypeCounts: Partial<Record<QuestionType, number>>;
  referencedImagePages: number[];
  diagramCount: number;
  issues: ImportPreflightIssue[];
  repairedJson?: string;
  questions: ExtractedQuestion[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.every(isNonEmptyString) ? value : null;
}

function hasUniqueNumbers(values: number[]): boolean {
  return new Set(values).size === values.length;
}

export function isValidQuestionType(value: string | undefined): value is QuestionType {
  return !!value && (VALID_TYPES as string[]).includes(value);
}

export function validateQuestionPayload(
  questionType: QuestionType,
  content: unknown,
  answer: unknown,
): ValidationResult {
  const c = isPlainObject(content) ? content : {};
  if (!isPlainObject(answer)) return { ok: false, error: 'answer ต้องเป็น object' };
  const a = answer;

  switch (questionType) {
    case 'multiple_choice': {
      const options = stringArray(c.options);
      if (!options || options.length < 2) return { ok: false, error: 'multiple_choice ต้องมี content.options อย่างน้อย 2 ตัวเลือก' };
      if (!isIntegerInRange(a.correctIndex, 0, options.length - 1)) {
        return { ok: false, error: 'multiple_choice.answer.correctIndex ต้องเป็นเลข index ของตัวเลือกที่มีอยู่' };
      }
      return { ok: true };
    }
    case 'fill_blank': {
      const answers = stringArray(a.answers);
      if (!answers) return { ok: false, error: 'fill_blank ต้องมี answer.answers เป็นรายการคำตอบอย่างน้อย 1 ค่า' };
      if (c.hint !== undefined && typeof c.hint !== 'string') {
        return { ok: false, error: 'fill_blank.content.hint ต้องเป็นข้อความ' };
      }
      return { ok: true };
    }
    case 'matching': {
      const left = stringArray(c.left);
      const right = stringArray(c.right);
      if (!left || !right) return { ok: false, error: 'matching ต้องมี content.left และ content.right เป็นรายการข้อความ' };
      if (!Array.isArray(a.pairs) || a.pairs.length !== left.length) {
        return { ok: false, error: 'matching.answer.pairs ต้องมีจำนวนเท่ากับ content.left' };
      }
      const pairs = a.pairs as unknown[];
      if (!pairs.every((v) => isIntegerInRange(v, 0, right.length - 1))) {
        return { ok: false, error: 'matching.answer.pairs ต้องอ้างถึง index ใน content.right เท่านั้น' };
      }
      if (!hasUniqueNumbers(pairs as number[])) return { ok: false, error: 'matching.answer.pairs ต้องไม่ซ้ำกัน' };
      return { ok: true };
    }
    case 'true_false':
      if (typeof a.value !== 'boolean') return { ok: false, error: 'true_false.answer.value ต้องเป็น true หรือ false' };
      return { ok: true };
    case 'fraction':
      if (!Number.isInteger(a.numerator) || !Number.isInteger(a.denominator)) {
        return { ok: false, error: 'fraction.answer ต้องมี numerator และ denominator เป็นจำนวนเต็ม' };
      }
      if (a.denominator === 0) return { ok: false, error: 'fraction.answer.denominator ต้องไม่เป็น 0' };
      return { ok: true };
    case 'ordering': {
      const items = stringArray(c.items);
      if (!items || items.length < 2) return { ok: false, error: 'ordering ต้องมี content.items อย่างน้อย 2 รายการ' };
      if (!Array.isArray(a.indices) || a.indices.length !== items.length) {
        return { ok: false, error: 'ordering.answer.indices ต้องมีจำนวนเท่ากับ content.items' };
      }
      const indices = a.indices as unknown[];
      if (!indices.every((v) => isIntegerInRange(v, 0, items.length - 1))) {
        return { ok: false, error: 'ordering.answer.indices ต้องอ้างถึง index ใน content.items เท่านั้น' };
      }
      if (!hasUniqueNumbers(indices as number[])) return { ok: false, error: 'ordering.answer.indices ต้องไม่ซ้ำกัน' };
      return { ok: true };
    }
  }
}

function unwrapTypeKey(value: unknown, questionType: QuestionType): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1) return value;
  const bareKey = keys[0].replace(/^_/, '');
  if (bareKey === questionType) return obj[keys[0]];
  return value;
}

function stripLeadingNumber(prompt: string): string {
  return prompt.replace(/^\s*\d+[.)]\s*/, '').trim();
}

export function preflightImportedJson(raw: string, options: { uploadedImageCount?: number } = {}): ImportPreflightReport {
  const parsed = parseJsonWithRepair(raw);
  const issues: ImportPreflightIssue[] = [];
  const questionTypeCounts: Partial<Record<QuestionType, number>> = {};
  const referencedImagePages = new Set<number>();
  const questions: ExtractedQuestion[] = [];
  let diagramCount = 0;
  const correctIndexCounts = new Map<number, number>();

  if (parsed === null) {
    return {
      ok: false,
      title: '',
      questionCount: 0,
      validQuestionCount: 0,
      questionTypeCounts,
      referencedImagePages: [],
      diagramCount: 0,
      issues: [{ level: 'error', message: 'รูปแบบ JSON ไม่ถูกต้อง ตรวจสอบว่า copy มาครบและไม่มีข้อความอื่นปน' }],
      questions,
    };
  }
  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      title: '',
      questionCount: 0,
      validQuestionCount: 0,
      questionTypeCounts,
      referencedImagePages: [],
      diagramCount: 0,
      issues: [{ level: 'error', message: 'JSON ต้องเป็น object' }],
      questions,
    };
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.questions)) {
    return {
      ok: false,
      title: typeof obj.title === 'string' ? obj.title : '',
      questionCount: 0,
      validQuestionCount: 0,
      questionTypeCounts,
      referencedImagePages: [],
      diagramCount: 0,
      issues: [{ level: 'error', message: 'ต้องมี field "questions" เป็น array' }],
      repairedJson: JSON.stringify(parsed),
      questions,
    };
  }

  for (let i = 0; i < obj.questions.length; i++) {
    const rawQuestion: unknown = obj.questions[i];
    const questionNumber = i + 1;
    if (!isPlainObject(rawQuestion)) {
      issues.push({ level: 'error', questionNumber, message: 'โจทย์ต้องเป็น object' });
      continue;
    }
    const q = rawQuestion;
    const rawQuestionType = typeof q.questionType === 'string' ? q.questionType : undefined;
    if (!isValidQuestionType(rawQuestionType)) {
      issues.push({ level: 'error', questionNumber, message: `questionType ไม่รองรับ: ${String(q.questionType ?? '(ไม่มี)')}` });
      continue;
    }
    if (typeof q.prompt !== 'string' || q.prompt.trim().length === 0) {
      issues.push({ level: 'error', questionNumber, message: 'prompt ต้องเป็นข้อความที่ไม่ว่าง' });
      continue;
    }

    const questionType: QuestionType = rawQuestionType;
    const content = unwrapTypeKey(q.content ?? {}, questionType);
    const answer = unwrapTypeKey(q.answer ?? {}, questionType);
    const valid = validateQuestionPayload(questionType, content, answer);
    if (!valid.ok) {
      issues.push({ level: 'error', questionNumber, message: valid.error });
      continue;
    }

    let difficulty: ExtractedQuestion['difficulty'];
    let learningObjective: string | undefined;
    let reasoningPrompt: string | undefined;
    let reasoningRubric: ExtractedQuestion['reasoningRubric'];
    let distractorRationales: string[] | undefined;
    if (questionType === 'multiple_choice') {
      const options = (content as { options: string[] }).options;
      const correctIndex = (answer as { correctIndex: number }).correctIndex;
      const normalized = options.map((option) => option.trim().toLocaleLowerCase());
      if (new Set(normalized).size !== normalized.length) {
        issues.push({ level: 'warning', questionNumber, message: 'ตัวเลือกปรนัยมีข้อความซ้ำกัน ควรปรับก่อนเผยแพร่' });
      }
      if (options.length < 4) {
        issues.push({ level: 'warning', questionNumber, message: 'ข้อปรนัยมีน้อยกว่า 4 ตัวเลือก อาจเดาคำตอบได้ง่ายเกินไป' });
      }
      const averageLength = options.reduce((sum, option) => sum + option.length, 0) / options.length;
      if (averageLength > 0 && options[correctIndex].length > averageLength * 1.8 && options[correctIndex].length - averageLength > 12) {
        issues.push({ level: 'warning', questionNumber, message: 'คำตอบถูกยาวกว่าตัวเลือกอื่นมาก อาจทำให้เดาคำตอบได้' });
      }
      if (options.some((option) => /ถูกทุกข้อ|ทุกข้อถูก|ไม่มีข้อใดถูก|none of the above|all of the above/i.test(option))) {
        issues.push({ level: 'warning', questionNumber, message: 'หลีกเลี่ยงตัวเลือก “ถูกทุกข้อ/ไม่มีข้อใดถูก” เพื่อวัดความเข้าใจให้ชัดขึ้น' });
      }
      difficulty = ['easy', 'medium', 'challenging'].includes(String(q.difficulty))
        ? q.difficulty as ExtractedQuestion['difficulty'] : undefined;
      learningObjective = isNonEmptyString(q.learningObjective) ? q.learningObjective.trim() : undefined;
      reasoningPrompt = isNonEmptyString(q.reasoningPrompt) ? q.reasoningPrompt.trim() : undefined;
      const rubric = isPlainObject(q.reasoningRubric) ? q.reasoningRubric : null;
      const keyIdeas = rubric ? stringArray(rubric.keyIdeas) : null;
      const misconceptions = rubric?.misconceptions === undefined ? undefined : stringArray(rubric.misconceptions) ?? undefined;
      reasoningRubric = keyIdeas ? { keyIdeas, misconceptions } : undefined;
      distractorRationales = stringArray(q.distractorRationales) ?? undefined;
      if (!difficulty) issues.push({ level: 'warning', questionNumber, message: 'ควรระบุ difficulty เป็น easy, medium หรือ challenging' });
      if (!learningObjective) issues.push({ level: 'warning', questionNumber, message: 'ควรระบุ learningObjective เพื่อให้โจทย์วัดทักษะที่ชัดเจน' });
      if (!isPlainObject(answer) || !isNonEmptyString(answer.rationale)) {
        issues.push({ level: 'warning', questionNumber, message: 'ควรระบุ answer.rationale ว่าทำไมคำตอบนี้จึงถูก' });
      }
      if (!distractorRationales || distractorRationales.length !== options.length - 1) {
        issues.push({ level: 'warning', questionNumber, message: 'ควรมี distractorRationales สำหรับตัวเลือกที่ผิดทุกข้อ' });
      }
      if (reasoningPrompt && !reasoningRubric) {
        issues.push({ level: 'warning', questionNumber, message: 'มี reasoningPrompt แต่ reasoningRubric.keyIdeas ยังไม่ครบ' });
      }
      correctIndexCounts.set(correctIndex, (correctIndexCounts.get(correctIndex) ?? 0) + 1);
    }

    const imagePage = typeof q.imagePage === 'number' && q.imagePage > 0 ? q.imagePage : undefined;
    if (imagePage !== undefined) {
      referencedImagePages.add(imagePage);
      if (options.uploadedImageCount != null && imagePage > options.uploadedImageCount) {
        issues.push({ level: 'warning', questionNumber, message: `อ้างถึง imagePage ${imagePage} แต่มีรูปที่อัปโหลด ${options.uploadedImageCount} รูป` });
      }
    }

    const diagram = validateDiagram(q.diagram) ?? undefined;
    if (q.diagram && !diagram) {
      issues.push({ level: 'warning', questionNumber, message: 'diagram format ไม่ตรงกับที่ระบบรองรับ ระบบจะไม่ใช้ diagram ข้อนี้' });
    }
    if (diagram) diagramCount += 1;

    questionTypeCounts[questionType] = (questionTypeCounts[questionType] ?? 0) + 1;
    questions.push({
      questionType,
      prompt: stripLeadingNumber(q.prompt),
      content,
      answer,
      explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
      imagePage,
      diagram,
      difficulty,
      learningObjective,
      reasoningPrompt,
      reasoningRubric,
      distractorRationales,
    });
  }

  const multipleChoiceCount = questionTypeCounts.multiple_choice ?? 0;
  if (multipleChoiceCount >= 4 && [...correctIndexCounts.values()].some((count) => count / multipleChoiceCount > 0.6)) {
    issues.push({ level: 'warning', message: 'ตำแหน่งคำตอบถูกของข้อปรนัยกระจุกอยู่ index เดียวมากเกินไป ควรสลับตำแหน่งให้สมดุล' });
  }

  const uploadedImageCount = options.uploadedImageCount ?? 0;
  const unusedImageCount = Math.max(0, uploadedImageCount - referencedImagePages.size);
  if (uploadedImageCount > 0 && referencedImagePages.size === 0 && diagramCount > 0) {
    issues.push({ level: 'warning', message: 'JSON มี diagram แล้ว แต่ไม่ได้อ้างถึงรูปที่อัปโหลด รูปอาจไม่จำเป็นสำหรับแบบฝึกหัดชุดนี้' });
  } else if (unusedImageCount > 0 && referencedImagePages.size > 0) {
    issues.push({ level: 'warning', message: `มีรูปที่อัปโหลด ${unusedImageCount} รูปที่ไม่มีโจทย์อ้างถึง อาจเป็นรูปเกินจำเป็น` });
  }

  if (questions.length === 0 && !issues.some((issue) => issue.level === 'error')) {
    issues.push({ level: 'error', message: 'ไม่พบโจทย์ที่ถูกต้องใน JSON (ตรวจ questionType/prompt ของแต่ละข้อ)' });
  }

  const hasErrors = issues.some((issue) => issue.level === 'error');
  return {
    ok: !hasErrors,
    title: typeof obj.title === 'string' ? obj.title : '',
    questionCount: obj.questions.length,
    validQuestionCount: questions.length,
    questionTypeCounts,
    referencedImagePages: [...referencedImagePages].sort((a, b) => a - b),
    diagramCount,
    issues,
    repairedJson: JSON.stringify(parsed),
    questions,
  };
}

export function parseImportedJson(raw: string): ImportResult {
  const report = preflightImportedJson(raw);
  if (!report.ok) {
    const errors = report.issues.filter((issue) => issue.level === 'error');
    return {
      ok: false,
      error: errors
        .slice(0, 5)
        .map((issue) => issue.questionNumber ? `ข้อ ${issue.questionNumber}: ${issue.message}` : issue.message)
        .join('; '),
    };
  }
  return { ok: true, title: report.title, questions: report.questions };
}
