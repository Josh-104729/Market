-- Migration: Add title column to posts table
-- Description: Adds a title column to the posts table to store post titles separately from content
-- Date: 2024

ALTER TABLE `posts` 
ADD COLUMN `title` VARCHAR(500) NULL AFTER `user_id`;

-- Update existing posts that might have title embedded in content (optional, for backward compatibility)
-- This would require parsing the content, which is better done at application level if needed

