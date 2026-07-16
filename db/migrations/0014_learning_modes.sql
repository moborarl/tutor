ALTER TABLE exercise_sets
ADD COLUMN learning_mode TEXT NOT NULL DEFAULT 'guided'
CHECK (learning_mode IN ('guided', 'exam'));

ALTER TABLE attempts
ADD COLUMN learning_mode TEXT NOT NULL DEFAULT 'guided'
CHECK (learning_mode IN ('guided', 'exam'));
