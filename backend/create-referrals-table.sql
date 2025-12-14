-- Create referrals table
CREATE TABLE IF NOT EXISTS `referrals` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `referrer_id` CHAR(36) NOT NULL,
  `referred_user_id` CHAR(36) NOT NULL,
  `referral_code_used` VARCHAR(12) NOT NULL,
  `status` ENUM('pending', 'active', 'completed', 'expired') NOT NULL DEFAULT 'pending',
  `referred_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `activated_at` DATETIME(6) NULL,
  `completed_at` DATETIME(6) NULL,
  `expires_at` DATETIME(6) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX `IDX_referrals_referrer_id` (`referrer_id`),
  INDEX `IDX_referrals_referred_user_id` (`referred_user_id`),
  INDEX `IDX_referrals_status` (`status`),
  INDEX `IDX_referrals_referrer_status` (`referrer_id`, `status`),
  UNIQUE KEY `IDX_referrals_referred_user_unique` (`referred_user_id`),
  FOREIGN KEY (`referrer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

