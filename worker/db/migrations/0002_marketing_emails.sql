-- Migration: Marketing Emails Tracker
CREATE TABLE IF NOT EXISTS user_email_logs (
  user_id INTEGER NOT NULL,
  email_type TEXT NOT NULL,
  sent_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, email_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
