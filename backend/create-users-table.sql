-- Create users table with UUID primary key
-- Run this script if the table doesn't exist or needs to be recreated
-- Note: Some fields are nullable because they're set in later signup steps

CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `user_name` VARCHAR(255) NULL,
  `first_name` VARCHAR(255) NULL,
  `last_name` VARCHAR(255) NULL,
  `middle_name` VARCHAR(255) NULL,
  `bio` TEXT NULL,
  `avatar` VARCHAR(255) NULL,
  `address` VARCHAR(255) NULL,
  `phone_number` VARCHAR(255) NULL,
  `role` VARCHAR(255) NOT NULL DEFAULT 'user',
  `google_id` VARCHAR(255) NULL,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `phone_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(255) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY `IDX_users_email` (`email`),
  UNIQUE KEY `IDX_users_user_name` (`user_name`),
  INDEX `IDX_users_email_index` (`email`),
  INDEX `IDX_users_user_name_index` (`user_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

