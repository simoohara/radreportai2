-- Migration to allow new feedback types

-- 1. Create a new table with the updated CHECK constraint
CREATE TABLE feedback_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('suggestion', 'bug', 'question', 'template_request', 'billing', 'other')),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'resolved')),
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Copy the data
INSERT INTO feedback_new SELECT * FROM feedback;

-- 3. Drop the old table
DROP TABLE feedback;

-- 4. Rename the new table
ALTER TABLE feedback_new RENAME TO feedback;
