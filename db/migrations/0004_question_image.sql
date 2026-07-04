-- Migration number: 0004    optional reference image per question (diagrams/figures)

ALTER TABLE questions ADD COLUMN image_id INTEGER REFERENCES exercise_images(id) ON DELETE SET NULL;
