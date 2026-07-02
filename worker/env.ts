export interface Env {
  DB: D1Database;
  WORKSHEETS: R2Bucket;
  ASSETS: Fetcher;
  SESSION_SECRET: string;
  ANTHROPIC_API_KEY?: string;
  PI_WORKER_TOKEN?: string;
  OPENAI_API_KEY?: string;
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
