-- Add notification tracking fields to users table
-- This tracks when users last checked notifications and when we last sent them email reminders

ALTER TABLE users
ADD COLUMN last_notification_check_at TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN last_notification_email_sent_at TIMESTAMP NULL DEFAULT NULL;

-- Add indexes for better query performance
CREATE INDEX idx_users_last_notification_check_at ON users(last_notification_check_at);
CREATE INDEX idx_users_last_notification_email_sent_at ON users(last_notification_email_sent_at);

