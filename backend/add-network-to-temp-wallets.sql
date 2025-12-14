-- Add network column to temp_wallets table
ALTER TABLE `temp_wallets` 
ADD COLUMN `network` ENUM('TRON', 'POLYGON') DEFAULT 'TRON' AFTER `address`;

-- Update existing temp wallets to have TRON as default
UPDATE `temp_wallets` SET `network` = 'TRON' WHERE `network` IS NULL;

