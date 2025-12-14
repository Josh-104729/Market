-- Create referral_rewards table
CREATE TABLE IF NOT EXISTS `referral_rewards` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `referral_id` CHAR(36) NOT NULL,
  `referrer_id` CHAR(36) NOT NULL,
  `referred_user_id` CHAR(36) NOT NULL,
  `reward_type` ENUM('signup_bonus', 'first_purchase', 'milestone', 'custom') NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USDT',
  `status` ENUM('pending', 'processed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  `processed_at` DATETIME(6) NULL,
  `transaction_id` CHAR(36) NULL,
  `description` TEXT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX `IDX_referral_rewards_referrer_id` (`referrer_id`),
  INDEX `IDX_referral_rewards_referral_id` (`referral_id`),
  INDEX `IDX_referral_rewards_status` (`status`),
  INDEX `IDX_referral_rewards_processed_at` (`processed_at`),
  FOREIGN KEY (`referral_id`) REFERENCES `referrals`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`referrer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

