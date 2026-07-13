export interface Env {
  DB: D1Database;
  WORKSHEETS: R2Bucket;
  ASSETS: Fetcher;
  SESSION_SECRET: string;
  GOOGLE_AI_API_KEY?: string; // Primary free provider (Gemini Vision)
  ANTHROPIC_API_KEY?: string; // Optional paid fallback (Claude)
  PI_WORKER_TOKEN?: string;
  OPENAI_API_KEY?: string; // Reserved for future use
  SUPER_ADMIN_TOKEN?: string;
  AI_CREDENTIAL_ENCRYPTION_KEY?: string;
}

export interface SessionInfo {
  sessionId: string;
  parentId: number;
  activeChildId: number | null;
  pinFailCount: number;
}

// Hono context variable typing
export type AppEnv = {
  Bindings: Env;
  Variables: {
    session: SessionInfo;
  };
};
