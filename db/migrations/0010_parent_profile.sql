-- Migration number: 0010    parent family profile

ALTER TABLE parents ADD COLUMN family_name TEXT;
