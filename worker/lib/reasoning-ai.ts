import type { AiProvider, CustomAiFormat, ReasoningFeedback, ReasoningRubric } from '@shared/types';
import { parseJsonWithRepair } from '@shared/json-repair';

export interface ReasoningRequest {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl?: string | null;
  apiFormat?: CustomAiFormat | null;
  question: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number;
  reasoningText: string;
  reasoningPrompt: string;
  rubric: ReasoningRubric | null;
}

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยการเรียนสำหรับเด็ก ประเมินเฉพาะเหตุผลที่เด็กเขียน ไม่เปลี่ยนผลถูกหรือผิดของคำตอบปรนัย
ตอบเป็น JSON ล้วนรูปแบบ {"assessment":"understands|partial|misconception","message":"คำแนะนำภาษาไทยสั้นๆ ไม่เกิน 2 ประโยค"}
ห้ามกล่าวถึงคะแนน ห้ามตำหนิเด็ก ห้ามขอหรือเดาข้อมูลส่วนตัว และใช้เฉพาะข้อมูลที่ได้รับ`;

function buildPrompt(input: ReasoningRequest): string {
  return `${SYSTEM_PROMPT}\n\nโจทย์: ${input.question}\nตัวเลือก: ${JSON.stringify(input.options)}\nคำตอบที่ถูก: ${input.options[input.correctIndex] ?? ''}\nคำตอบที่เด็กเลือก: ${input.options[input.selectedIndex] ?? ''}\nคำถามชวนอธิบาย: ${input.reasoningPrompt}\nเกณฑ์: ${JSON.stringify(input.rubric ?? {})}\nคำอธิบายของเด็ก: ${input.reasoningText}`;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function providerText(input: ReasoningRequest): Promise<string> {
  const prompt = buildPrompt(input);
  let response: Response;

  if (input.provider === 'openai') {
    response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${input.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: input.model, input: prompt, max_output_tokens: 220 }),
    });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    return data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join('') ?? '';
  }

  if (input.provider === 'anthropic') {
    response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': input.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: input.model, max_tokens: 220, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    return data.content?.filter((item) => item.type === 'text').map((item) => item.text ?? '').join('') ?? '';
  }

  if (input.provider === 'custom') {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (input.apiKey) headers.authorization = `Bearer ${input.apiKey}`;
    const baseUrl = (input.baseUrl ?? '').replace(/\/+$/, '');
    if (!baseUrl) throw new Error('provider_invalid_config');

    if (input.apiFormat === 'chat_completions') {
      response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: input.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 220,
        }),
      });
      if (!response.ok) throw new Error(`provider_http_${response.status}`);
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? '';
    }

    response = await fetchWithTimeout(`${baseUrl}/responses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: input.model, input: prompt, max_output_tokens: 220 }),
    });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    return data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join('') ?? '';
  }

  response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': input.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 220, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!response.ok) throw new Error(`provider_http_${response.status}`);
  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
}

export async function runReasoningFeedback(input: ReasoningRequest): Promise<ReasoningFeedback> {
  const raw = await providerText(input);
  const parsed = parseJsonWithRepair(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('provider_invalid_response');
  const value = parsed as Record<string, unknown>;
  const assessment = value.assessment;
  const message = typeof value.message === 'string' ? value.message.trim().slice(0, 500) : '';
  if (!message || !['understands', 'partial', 'misconception'].includes(String(assessment))) {
    throw new Error('provider_invalid_response');
  }
  return { status: 'completed', assessment: assessment as ReasoningFeedback['assessment'], message };
}

export const DEFAULT_AI_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-5-mini',
  gemini: 'gemini-3.5-flash',
  anthropic: 'claude-sonnet-4-5',
  custom: 'gpt-4.1-mini',
};
