import type { ExtractedQuestion } from '@shared/types';

// Insert extracted/imported questions as draft rows for an exercise set.
// Shared by the parent upload flow (routes/exercises.ts) and the public AI
// ingest flow (routes/ingest.ts) so their insert logic can never drift.
export async function insertDraftQuestions(
  db: D1Database,
  exerciseSetId: number,
  questions: ExtractedQuestion[],
  // maps a 1-indexed "imagePage" (upload order) to the actual exercise_images.id
  pageToImageId: Map<number, number> = new Map(),
): Promise<void> {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const imageId = q.imagePage ? pageToImageId.get(q.imagePage) ?? null : null;
    const diagramJson = q.diagram ? JSON.stringify(q.diagram) : null;

    await db
      .prepare(
        `INSERT INTO questions
           (exercise_set_id, order_index, question_type, prompt, content_json, answer_json, explanation, image_id, diagram_json,
            difficulty, learning_objective, reasoning_prompt, reasoning_rubric_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        exerciseSetId,
        i,
        q.questionType,
        q.prompt,
        JSON.stringify(q.content ?? {}),
        JSON.stringify(q.answer ?? {}),
        q.explanation ?? null,
        imageId,
        diagramJson,
        q.difficulty ?? null,
        q.learningObjective ?? null,
        q.reasoningPrompt ?? null,
        q.reasoningRubric ? JSON.stringify(q.reasoningRubric) : null,
      )
      .run();
  }
}

// Reuse an existing subject of this parent by name, or create it. Returns null
// for a blank/absent name. Used when an ingest request tags a subject by name
// (the AI/agent has no subject ids).
export async function resolveSubjectId(
  db: D1Database,
  parentId: number,
  name: string | null | undefined,
): Promise<number | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = await db
    .prepare('SELECT id FROM subjects WHERE parent_id = ? AND name = ?')
    .bind(parentId, trimmed)
    .first<{ id: number }>();
  if (existing) return existing.id;

  const created = await db
    .prepare('INSERT INTO subjects (parent_id, name) VALUES (?, ?)')
    .bind(parentId, trimmed)
    .run();
  return created.meta.last_row_id as number;
}
