-- Add payment_network column to transactions table
ALTER TABLE `transactions` 
ADD COLUMN `payment_network` ENUM('USDT_TRC20', 'USDC_POLYGON') DEFAULT 'USDT_TRC20' AFTER `expires_at`;

-- Update existing transactions to have USDT_TRC20 as default
UPDATE `transactions` SET `payment_network` = 'USDT_TRC20' WHERE `payment_network` IS NULL;

