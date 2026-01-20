-- Migration: Fix reset_password_expires timezone issue
-- Changes column type from TIMESTAMP to DATETIME to avoid automatic timezone conversion
-- This fixes the issue where tokens appear expired due to timezone mismatches

-- Change column type from TIMESTAMP to DATETIME
ALTER TABLE `users` 
MODIFY COLUMN `reset_password_expires` DATETIME NULL;

-- Note: DATETIME stores values without timezone conversion, making comparisons more reliable
-- The application now uses Unix timestamp comparison for additional reliability

