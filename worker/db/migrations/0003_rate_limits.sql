-- Create rate_limits table for request throttling
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  hits INTEGER DEFAULT 1,
  expires_at DATETIME NOT NULL
);

-- Index for quick cleanup of expired limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
