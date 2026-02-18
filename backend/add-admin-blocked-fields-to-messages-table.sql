-- Add admin blocking fields to messages table
ALTER TABLE messages
ADD COLUMN admin_blocked_at DATETIME(6) NULL,
ADD COLUMN admin_blocked_by_id VARCHAR(36) NULL;

-- Add foreign key constraint
ALTER TABLE messages
ADD CONSTRAINT fk_messages_admin_blocked_by
FOREIGN KEY (admin_blocked_by_id) REFERENCES users(id)
ON DELETE SET NULL;

