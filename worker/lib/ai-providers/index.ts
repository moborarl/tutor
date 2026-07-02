import type { Env } from '../../env';
import type { ExtractedQuestion, ExtractionProvider } from '@shared/types';
import type { AiExtractionProvider, ExtractionInput } from './types';
import { createClaudeProvider } from './claude';

// Placeholder for a secondary cloud provider (OpenAI/Gemini) — add here later.
function cloudProviders(env: Env): AiExtractionProvider[] {
  return [createClaudeProvider(env.ANTHROPIC_API_KEY)];
}

export type OrchestratorResult =
  | { status: 'done'; provider: ExtractionProvider; questions: ExtractedQuestion[]; title: string }
  // All cloud providers exhausted their quota -> queue for the Pi to pick up.
  | { status: 'queue_for_pi'; lastError: string }
  // A provider failed for a non-quota reason (bad image, parse failure, ...).
  | { status: 'failed'; error: string };

export async function runCloudExtraction(
  env: Env,
  input: ExtractionInput,
): Promise<OrchestratorResult> {
  let lastError = 'no cloud provider configured';
  let sawQuotaExhaustion = false;

  for (const provider of cloudProviders(env)) {
    if (!provider.isConfigured()) continue;
    const outcome = await provider.extract(input);
    if (outcome.ok) {
      return {
        status: 'done',
        provider: provider.name,
        questions: outcome.questions,
        title: outcome.title,
      };
    }
    lastError = outcome.error;
    if (outcome.quotaExhausted) {
      sawQuotaExhaustion = true;
      continue; // try next provider in the chain
    }
    // Non-quota failure: retrying another provider won't fix a bad image,
    // but a different provider may still parse it — keep going.
  }

  // If any provider signaled quota exhaustion (or nothing is configured),
  // fall back to the Pi queue; otherwise report a hard failure.
  if (sawQuotaExhaustion || lastError === 'no cloud provider configured') {
    return { status: 'queue_for_pi', lastError };
  }
  return { status: 'failed', error: lastError };
}
