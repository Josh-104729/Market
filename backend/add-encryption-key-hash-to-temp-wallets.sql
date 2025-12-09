-- Migration: Add encryption_key_hash column to temp_wallets table
-- This column stores the hash of the encryption key used to encrypt each wallet's private key
-- This allows us to identify which encryption key was used when decrypting

ALTER TABLE temp_wallets 
ADD COLUMN encryption_key_hash VARCHAR(64) NULL 
COMMENT 'SHA256 hash of the encryption key used to encrypt this wallet''s private key';

-- Note: Existing wallets will have NULL for this column, which is fine
-- The decryption logic will try all available keys for wallets without a hash

