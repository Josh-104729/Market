-- Create help_requests table (user support submissions)
-- Run this script if DB_SYNCHRONIZE is disabled and you want to create the table manually.

CREATE TABLE IF NOT EXISTS `help_requests` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  `image_url` VARCHAR(512) NULL,
  `status` ENUM('pending','approved') NOT NULL DEFAULT 'pending',
  `approved_at` TIMESTAMP NULL DEFAULT NULL,
  `approved_by` CHAR(36) NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX `IDX_help_requests_user_id` (`user_id`),
  INDEX `IDX_help_requests_status` (`status`),
  INDEX `IDX_help_requests_createdAt` (`createdAt`),
  INDEX `IDX_help_requests_approved_by` (`approved_by`),
  CONSTRAINT `FK_help_requests_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_help_requests_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


