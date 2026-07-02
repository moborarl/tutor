import type { ExtractedQuestion } from '@shared/types';

export interface ExtractionInput {
  imageBytes: ArrayBuffer;
  contentType: string;
  ageBand: 'young' | 'older';
}

export type ExtractionOutcome =
  | { ok: true; questions: ExtractedQuestion[]; title: string }
  // quotaExhausted: provider is out of credits/rate-limited -> try next provider
  | { ok: false; quotaExhausted: boolean; error: string };

export interface AiExtractionProvider {
  name: 'claude' | 'other_cloud';
  isConfigured(): boolean;
  extract(input: ExtractionInput): Promise<ExtractionOutcome>;
}
