import type { ExtractedQuestion, QuestionType } from '@shared/types';
import { validateDiagram } from '@shared/diagram';
import { parseJsonWithRepair } from '@shared/json-repair';

const VALID_TYPES: QuestionType[] = ['multiple_choice', 'fill_blank', 'matching', 'true_false', 'fraction', 'ordering'];

export type ImportResult =
  | { ok: true; title: string; questions: ExtractedQuestion[] }
  | { ok: false; error: string };

type ValidationResult = { ok: true } | { ok: false; error: string };

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

// Some AI chats echo the schema documentation literally and wrap content/answer in a
// key like "_multiple_choice" or "multiple_choice" instead of putting the fields
// directly. If we see an object with exactly one key that matches the question's
// type (with or without a leading underscore), unwrap it.
function unwrapTypeKey(value: unknown, questionType: QuestionType): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1) return value;
  const bareKey = keys[0].replace(/^_/, '');
  if (bareKey === questionType) return obj[keys[0]];
  return value;
}

// The original worksheet often numbers questions ("58. ..."), but that numbering
// rarely matches our own sequential question order (e.g. a set extracted from page
// 2 of a bigger worksheet, or questions the AI skipped). Showing both together is
// confusing, so strip a leading "N." / "N)" marker and let our own order_index-based
// numbering (shown in Review/Player) be the single source of truth.
function stripLeadingNumber(prompt: string): string {
  return prompt.replace(/^\s*\d+[.)]\s*/, '').trim();
}

// Parses and validates JSON pasted by a parent (produced by an external AI chat,
// e.g. ChatGPT/Claude/Gemini web) against our questions schema.
export function parseImportedJson(raw: string): ImportResult {
  const parsed = parseJsonWithRepair(raw);
  if (parsed === null) {
    return { ok: false, error: 'รูปแบบ JSON ไม่ถูกต้อง ตรวจสอบว่า copy มาครบและไม่มีข้อความอื่นปน' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'JSON ต้องเป็น object' };
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.questions)) {
    return { ok: false, error: 'ต้องมี field "questions" เป็น array' };
  }

  const questions: ExtractedQuestion[] = [];
  const errors: string[] = [];
  for (let i = 0; i < obj.questions.length; i++) {
    const q = obj.questions[i];
    if (
      q &&
      typeof q === 'object' &&
      isValidQuestionType((q as Record<string, unknown>).questionType as string | undefined) &&
      typeof (q as Record<string, unknown>).prompt === 'string'
    ) {
      const item = q as Record<string, unknown>;
      const questionType = item.questionType as QuestionType;
      const content = unwrapTypeKey(item.content ?? {}, questionType);
      const answer = unwrapTypeKey(item.answer ?? {}, questionType);
      const valid = validateQuestionPayload(questionType, content, answer);
      if (!valid.ok) {
        errors.push(`ข้อ ${i + 1}: ${valid.error}`);
        continue;
      }
      const imagePage = typeof item.imagePage === 'number' && item.imagePage > 0 ? item.imagePage : undefined;
      const diagram = validateDiagram(item.diagram) ?? undefined;
      questions.push({
        questionType,
        prompt: stripLeadingNumber(item.prompt as string),
        content,
        answer,
        explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
        imagePage,
        diagram,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.slice(0, 5).join('; ') };
  }

  if (questions.length === 0) {
    return { ok: false, error: 'ไม่พบโจทย์ที่ถูกต้องใน JSON (ตรวจ questionType/prompt ของแต่ละข้อ)' };
  }

  return { ok: true, title: typeof obj.title === 'string' ? obj.title : '', questions };
}
