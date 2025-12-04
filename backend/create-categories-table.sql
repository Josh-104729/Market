-- Create categories table with UUID primary key
-- Run this script if the table doesn't exist or needs to be recreated

CREATE TABLE IF NOT EXISTS `categories` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `icon` VARCHAR(255) NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  INDEX `IDX_categories_title` (`title`),
  INDEX `IDX_categories_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

