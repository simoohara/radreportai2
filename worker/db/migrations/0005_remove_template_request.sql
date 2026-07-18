-- Migration to remove template_request from feedback types

-- 1. Create a new table with the updated CHECK constraint
CREATE TABLE feedback_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('suggestion', 'bug', 'question', 'billing', 'other')),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'resolved')),
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Update existing data if any (fallback to suggestion)
UPDATE feedback SET type = 'suggestion' WHERE type = 'template_request';

-- 3. Copy the data
INSERT INTO feedback_new SELECT * FROM feedback;

-- 4. Drop the old table
DROP TABLE feedback;

-- 5. Rename the new table
ALTER TABLE feedback_new RENAME TO feedback;
