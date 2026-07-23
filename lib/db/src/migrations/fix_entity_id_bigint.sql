-- Fix entity_id column to use bigint instead of integer to handle timestamps from Date.now()
ALTER TABLE activity_logs ALTER COLUMN entity_id TYPE bigint;
