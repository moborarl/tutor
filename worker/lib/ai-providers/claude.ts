import type { ExtractedQuestion, QuestionType } from '@shared/types';
import type { AiExtractionProvider, ExtractionInput, ExtractionOutcome } from './types';

const MODEL = 'claude-sonnet-5';
const VALID_TYPES: QuestionType[] = ['multiple_choice', 'fill_blank', 'matching', 'true_false'];

const EXTRACT_TOOL = {
  name: 'record_questions',
  description: 'Record the exercise questions extracted from the worksheet photo.',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short title for this worksheet, in the same language as the worksheet.',
      },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            questionType: {
              type: 'string',
              enum: ['multiple_choice', 'fill_blank', 'matching', 'true_false'],
            },
            prompt: {
              type: 'string',
              description:
                'The question text. For fill_blank use ___ to mark the blank position.',
            },
            content: {
              type: 'object',
              description:
                'multiple_choice: {"options": string[]}. fill_blank: {"hint"?: string}. matching: {"left": string[], "right": string[]}. true_false: {}.',
            },
            answer: {
              type: 'object',
              description:
                'multiple_choice: {"correctIndex": number}. fill_blank: {"answers": string[]} (all acceptable answers). matching: {"pairs": number[]} where pairs[i] is the index in right matching left[i]. true_false: {"value": boolean}.',
            },
          },
          required: ['questionType', 'prompt', 'content', 'answer'],
        },
      },
    },
    required: ['title', 'questions'],
  },
};

function buildSystemPrompt(ageBand: 'young' | 'older'): string {
  return [
    'You extract exercise questions from a photo of a school worksheet or lesson.',
    'The worksheet may be in Thai, English, or mixed. Keep the original language of the questions.',
    'Extract every question you can identify. Produce the correct answer for each question yourself if the worksheet does not show answers.',
    ageBand === 'young'
      ? 'This worksheet is for a young child (early childhood): prefer multiple_choice and true_false forms; keep prompts short and simple.'
      : 'This worksheet is for an older child: preserve the original question forms where possible.',
    'Call the record_questions tool exactly once with all extracted questions.',
  ].join(' ');
}

function isQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status === 529) return true; // overloaded
  if (status === 400 && /credit|billing|quota/i.test(body)) return true;
  return false;
}

function validateQuestions(raw: unknown): ExtractedQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtractedQuestion[] = [];
  for (const q of raw) {
    if (
      q &&
      typeof q === 'object' &&
      VALID_TYPES.includes((q as Record<string, unknown>).questionType as QuestionType) &&
      typeof (q as Record<string, unknown>).prompt === 'string'
    ) {
      const item = q as Record<string, unknown>;
      out.push({
        questionType: item.questionType as QuestionType,
        prompt: item.prompt as string,
        content: item.content ?? {},
        answer: item.answer ?? {},
      });
    }
  }
  return out;
}

export function createClaudeProvider(apiKey: string | undefined): AiExtractionProvider {
  return {
    name: 'claude',
    isConfigured: () => Boolean(apiKey),
    async extract(input: ExtractionInput): Promise<ExtractionOutcome> {
      if (!apiKey) return { ok: false, quotaExhausted: false, error: 'not configured' };

      let b64 = '';
      const bytes = new Uint8Array(input.imageBytes);
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      b64 = btoa(b64);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          system: buildSystemPrompt(input.ageBand),
          tools: [EXTRACT_TOOL],
          tool_choice: { type: 'tool', name: 'record_questions' },
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: input.contentType, data: b64 },
                },
                { type: 'text', text: 'Extract all questions from this worksheet photo.' },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        return {
          ok: false,
          quotaExhausted: isQuotaError(res.status, body),
          error: `claude http ${res.status}: ${body.slice(0, 300)}`,
        };
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; name?: string; input?: unknown }>;
      };
      const toolUse = data.content?.find(
        (b) => b.type === 'tool_use' && b.name === 'record_questions',
      );
      const toolInput = (toolUse?.input ?? {}) as { title?: unknown; questions?: unknown };
      const questions = validateQuestions(toolInput.questions);
      if (questions.length === 0) {
        return { ok: false, quotaExhausted: false, error: 'claude returned no valid questions' };
      }
      return {
        ok: true,
        questions,
        title: typeof toolInput.title === 'string' ? toolInput.title : '',
      };
    },
  };
}
