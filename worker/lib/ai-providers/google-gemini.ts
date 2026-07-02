import type { ExtractedQuestion, QuestionType } from '@shared/types';
import type { AiExtractionProvider, ExtractionInput, ExtractionOutcome } from './types';

const MODEL = 'gemini-3.5-flash';
const VALID_TYPES: QuestionType[] = ['multiple_choice', 'fill_blank', 'matching', 'true_false'];

function buildSystemPrompt(ageBand: 'young' | 'older'): string {
  return [
    'You extract exercise questions from a photo of a school worksheet or lesson.',
    'The worksheet may be in Thai, English, or mixed. Keep the original language of the questions.',
    'Extract every question you can identify. Produce the correct answer for each question yourself if the worksheet does not show answers.',
    ageBand === 'young'
      ? 'This worksheet is for a young child (early childhood): prefer multiple_choice and true_false forms; keep prompts short and simple.'
      : 'This worksheet is for an older child: preserve the original question forms where possible.',
    'Return ONLY a valid JSON object (no markdown code blocks, no extra text before or after).',
    'Use this exact JSON schema:',
    JSON.stringify(
      {
        title: 'Short worksheet title in the same language as the worksheet',
        questions: [
          {
            questionType: 'multiple_choice (or fill_blank, matching, true_false)',
            prompt: 'The question text. For fill_blank use ___ to mark the blank position.',
            content: {
              'multiple_choice': { options: ['option a', 'option b'] },
              'fill_blank': { hint: 'optional hint' },
              'matching': { left: ['item 1'], right: ['item a'] },
              'true_false': {},
            },
            answer: {
              'multiple_choice': { correctIndex: 0 },
              'fill_blank': { answers: ['acceptable answer 1', 'answer 2'] },
              'matching': { pairs: [0] },
              'true_false': { value: true },
            },
          },
        ],
      },
      null,
      2,
    ),
  ].join('\n');
}

function isQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status === 500 && /overloaded|quota|rate/i.test(body)) return true;
  if (status === 403 && /quota|billing|credit/i.test(body)) return true;
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

export function createGoogleGeminiProvider(apiKey: string | undefined): AiExtractionProvider {
  return {
    name: 'other_cloud',
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

      const prompt = [
        'Extract all exercise questions from this worksheet photo.',
        buildSystemPrompt(input.ageBand),
      ].join('\n\n');

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: input.contentType,
                      data: b64,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 4096,
            },
          }),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        return {
          ok: false,
          quotaExhausted: isQuotaError(res.status, body),
          error: `google gemini http ${res.status}: ${body.slice(0, 300)}`,
        };
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textPart) {
        return { ok: false, quotaExhausted: false, error: 'google gemini returned no text' };
      }

      // Parse JSON from response (Gemini might return markdown or plain JSON)
      let jsonStr = textPart.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        return {
          ok: false,
          quotaExhausted: false,
          error: `google gemini returned invalid json: ${String(e).slice(0, 100)}`,
        };
      }

      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, quotaExhausted: false, error: 'google gemini response is not an object' };
      }

      const obj = parsed as Record<string, unknown>;
      const questions = validateQuestions(obj.questions);
      if (questions.length === 0) {
        return { ok: false, quotaExhausted: false, error: 'google gemini returned no valid questions' };
      }

      return {
        ok: true,
        questions,
        title: typeof obj.title === 'string' ? obj.title : '',
      };
    },
  };
}
