import type { ExtractedQuestion, QuestionType } from '@shared/types';

const VALID_TYPES: QuestionType[] = ['multiple_choice', 'fill_blank', 'matching', 'true_false'];

export type ImportResult =
  | { ok: true; title: string; questions: ExtractedQuestion[] }
  | { ok: false; error: string };

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

// Parses and validates JSON pasted by a parent (produced by an external AI chat,
// e.g. ChatGPT/Claude/Gemini web) against our questions schema.
export function parseImportedJson(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `รูปแบบ JSON ไม่ถูกต้อง: ${String(e).slice(0, 150)}` };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'JSON ต้องเป็น object' };
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.questions)) {
    return { ok: false, error: 'ต้องมี field "questions" เป็น array' };
  }

  const questions: ExtractedQuestion[] = [];
  for (const q of obj.questions) {
    if (
      q &&
      typeof q === 'object' &&
      VALID_TYPES.includes((q as Record<string, unknown>).questionType as QuestionType) &&
      typeof (q as Record<string, unknown>).prompt === 'string'
    ) {
      const item = q as Record<string, unknown>;
      const questionType = item.questionType as QuestionType;
      questions.push({
        questionType,
        prompt: item.prompt as string,
        content: unwrapTypeKey(item.content ?? {}, questionType),
        answer: unwrapTypeKey(item.answer ?? {}, questionType),
        explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
      });
    }
  }

  if (questions.length === 0) {
    return { ok: false, error: 'ไม่พบโจทย์ที่ถูกต้องใน JSON (ตรวจ questionType/prompt ของแต่ละข้อ)' };
  }

  return { ok: true, title: typeof obj.title === 'string' ? obj.title : '', questions };
}
