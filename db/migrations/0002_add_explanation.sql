-- Migration number: 0002    add explanation field for answer reasoning

ALTER TABLE questions ADD COLUMN explanation TEXT;
