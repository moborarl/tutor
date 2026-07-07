import type { ExtractedQuestion, QuestionType } from '@shared/types';
import { validateDiagram } from '@shared/diagram';
import { parseJsonWithRepair } from '@shared/json-repair';

const VALID_TYPES: QuestionType[] = ['multiple_choice', 'fill_blank', 'matching', 'true_false', 'fraction', 'ordering'];

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
  for (const q of obj.questions) {
    if (
      q &&
      typeof q === 'object' &&
      VALID_TYPES.includes((q as Record<string, unknown>).questionType as QuestionType) &&
      typeof (q as Record<string, unknown>).prompt === 'string'
    ) {
      const item = q as Record<string, unknown>;
      const questionType = item.questionType as QuestionType;
      const imagePage = typeof item.imagePage === 'number' && item.imagePage > 0 ? item.imagePage : undefined;
      const diagram = validateDiagram(item.diagram) ?? undefined;
      questions.push({
        questionType,
        prompt: stripLeadingNumber(item.prompt as string),
        content: unwrapTypeKey(item.content ?? {}, questionType),
        answer: unwrapTypeKey(item.answer ?? {}, questionType),
        explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
        imagePage,
        diagram,
      });
    }
  }

  if (questions.length === 0) {
    return { ok: false, error: 'ไม่พบโจทย์ที่ถูกต้องใน JSON (ตรวจ questionType/prompt ของแต่ละข้อ)' };
  }

  return { ok: true, title: typeof obj.title === 'string' ? obj.title : '', questions };
}
