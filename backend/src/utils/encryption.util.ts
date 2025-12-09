import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

// Get encryption key from environment or use default
const getEncryptionKey = (): string => {
  if (process.env.WALLET_ENCRYPTION_KEY) {
    return process.env.WALLET_ENCRYPTION_KEY;
  }
  
  // Default key (fallback)
  const defaultKey = '095e14fc42d1b082cc56b54cbe99c8d0bf6ba0625a036312320429fa87f67a55';
  
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      'WARNING: WALLET_ENCRYPTION_KEY environment variable is not set. ' +
      'Using default key. For production, please set WALLET_ENCRYPTION_KEY in your .env file.'
    );
  }
  
  return defaultKey;
};

const ENCRYPTION_KEY = getEncryptionKey();

// Get fallback keys from environment (comma-separated list)
// This allows trying old encryption keys for wallets encrypted with previous keys
const getFallbackKeys = (): string[] => {
  if (process.env.WALLET_ENCRYPTION_KEY_FALLBACKS) {
    return process.env.WALLET_ENCRYPTION_KEY_FALLBACKS.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }
  return [];
};

const FALLBACK_KEYS = getFallbackKeys();

const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Get a hash identifier for the current encryption key
 * This helps identify which key was used to encrypt a wallet
 */
export function getEncryptionKeyHash(): string {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('hex');
}

/**
 * Get a hash identifier for a given encryption key
 */
export function getKeyHash(encryptionKey: string): string {
  return crypto.createHash('sha256').update(encryptionKey).digest('hex');
}

export function encrypt(text: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Try to decrypt with a specific key
 */
function tryDecryptWithKey(encryptedText: string, encryptionKey: string): string {
  if (!encryptedText || !encryptedText.includes(':')) {
    throw new Error('Invalid encrypted text format');
  }

  const key = Buffer.from(encryptionKey.slice(0, 32), 'utf8');
  const parts = encryptedText.split(':');
  
  if (parts.length < 2) {
    throw new Error('Invalid encrypted text format: missing IV or encrypted data');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts.slice(1).join(':');
  
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Decrypt with a specific encryption key
 */
export function decryptWithKey(encryptedText: string, encryptionKey: string): string {
  return tryDecryptWithKey(encryptedText, encryptionKey);
}

export function decrypt(encryptedText: string, encryptionKeyHash?: string): string {
  // If we have a key hash, try to find the matching key first
  if (encryptionKeyHash) {
    const currentKeyHash = getEncryptionKeyHash();
    
    // If the hash matches the current key, use it
    if (encryptionKeyHash === currentKeyHash) {
      try {
        return tryDecryptWithKey(encryptedText, ENCRYPTION_KEY);
      } catch (error) {
        // Continue to fallback logic below
      }
    }
    
    // Try to find matching key in fallback keys
    for (const fallbackKey of FALLBACK_KEYS) {
      const fallbackKeyHash = getKeyHash(fallbackKey);
      if (encryptionKeyHash === fallbackKeyHash) {
        try {
          return tryDecryptWithKey(encryptedText, fallbackKey);
        } catch (error) {
          // Continue to next fallback key
          continue;
        }
      }
    }
  }
  
  // Try with the primary encryption key first (if no hash provided or hash didn't match)
  try {
    return tryDecryptWithKey(encryptedText, ENCRYPTION_KEY);
  } catch (error) {
    // Check if it's a decryption error (bad decrypt or ERR_OSSL_BAD_DECRYPT)
    const isDecryptError = error instanceof Error && (
      error.message.includes('bad decrypt') || 
      error.message.includes('ERR_OSSL_BAD_DECRYPT') ||
      (error as any).code === 'ERR_OSSL_BAD_DECRYPT'
    );
    
    if (isDecryptError) {
      // Try fallback keys
      for (const fallbackKey of FALLBACK_KEYS) {
        try {
          return tryDecryptWithKey(encryptedText, fallbackKey);
        } catch (fallbackError) {
          // Continue to next fallback key
          continue;
        }
      }
      
      // If all keys failed, throw a helpful error
      throw new Error(
        'Decryption failed with all available keys. ' +
        'The wallet was encrypted with a different key. ' +
        'You can set WALLET_ENCRYPTION_KEY_FALLBACKS environment variable with comma-separated old keys to try. ' +
        `Tried ${1 + FALLBACK_KEYS.length} key(s).`
      );
    }
    throw error;
  }
}

