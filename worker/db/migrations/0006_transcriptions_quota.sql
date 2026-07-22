-- Add transcription quota tracking
ALTER TABLE users ADD COLUMN transcriptions_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN transcriptions_remaining INTEGER DEFAULT 50;

-- Upgrade existing paid users to unlimited dictations
UPDATE users SET transcriptions_remaining = NULL WHERE subscription_plan IS NOT NULL;
