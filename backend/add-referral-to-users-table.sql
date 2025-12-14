-- Add referral fields to users table
ALTER TABLE `users` 
ADD COLUMN `referral_code` VARCHAR(12) NULL AFTER `status`,
ADD COLUMN `referred_by` CHAR(36) NULL AFTER `referral_code`,
ADD COLUMN `referral_code_created_at` DATETIME(6) NULL AFTER `referred_by`,
ADD COLUMN `total_referrals` INT NOT NULL DEFAULT 0 AFTER `referral_code_created_at`,
ADD COLUMN `total_referral_earnings` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `total_referrals`;

-- Create unique index on referral_code
CREATE UNIQUE INDEX `IDX_users_referral_code` ON `users` (`referral_code`);

-- Create index on referred_by for faster lookups
CREATE INDEX `IDX_users_referred_by` ON `users` (`referred_by`);

-- Add foreign key constraint for referred_by
ALTER TABLE `users`
ADD CONSTRAINT `FK_users_referred_by` 
FOREIGN KEY (`referred_by`) REFERENCES `users`(`id`) ON DELETE SET NULL;

