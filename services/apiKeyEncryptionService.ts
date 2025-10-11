/**
 * AES-256 Encryption Service for API Keys
 * 
 * This service provides secure encryption and decryption of sensitive API keys
 * using AES-256-CBC algorithm with proper key derivation and HMAC authentication.
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, createHmac } from 'crypto';

interface EncryptionResult {
  encryptedData: string; // Base64 encoded
  salt: string;          // Base64 encoded
  iv: string;            // Base64 encoded 
  hmac: string;          // Base64 encoded HMAC for authentication
}

interface DecryptionInput {
  encryptedData: string;
  salt: string;
  iv: string;
  hmac: string;
}

class ApiKeyEncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16;  // 128 bits for CBC
  private readonly saltLength = 32; // 256 bits
  private readonly iterations = 100000; // PBKDF2 iterations
  private readonly hmacLength = 32; // 256 bits for HMAC-SHA256

  /**
   * Get the master key from environment variables
   */
  private getMasterKey(): string {
    const masterKey = process.env.API_KEY_ENCRYPTION_SECRET;
    if (!masterKey) {
      throw new Error('API_KEY_ENCRYPTION_SECRET environment variable is required');
    }
    if (masterKey.length < 32) {
      throw new Error('API_KEY_ENCRYPTION_SECRET must be at least 32 characters long');
    }
    return masterKey;
  }

  /**
   * Derive encryption key from master key and salt using PBKDF2
   */
  private deriveKey(masterKey: string, salt: Buffer): Buffer {
    return pbkdf2Sync(masterKey, salt, this.iterations, this.keyLength, 'sha256');
  }

  /**
   * Generate HMAC for authentication
   */
  private generateHmac(data: string, key: Buffer): string {
    const hmac = createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('base64');
  }

  /**
   * Verify HMAC for authentication
   */
  private verifyHmac(data: string, key: Buffer, expectedHmac: string): boolean {
    const actualHmac = this.generateHmac(data, key);
    return actualHmac === expectedHmac;
  }

  /**
   * Encrypt an API key using AES-256-CBC with HMAC authentication
   */
  encryptApiKey(apiKey: string): EncryptionResult {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API key cannot be empty');
    }

    try {
      // Generate random salt and IV
      const salt = randomBytes(this.saltLength);
      const iv = randomBytes(this.ivLength);
      
      // Derive key from master key and salt
      const masterKey = this.getMasterKey();
      const derivedKey = this.deriveKey(masterKey, salt);
      
      // Create cipher
      const cipher = createCipheriv(this.algorithm, derivedKey, iv);
      
      // Encrypt the API key
      let encrypted = cipher.update(apiKey.trim(), 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Generate HMAC for authentication (salt + iv + encrypted data)
      const dataToAuth = salt.toString('base64') + iv.toString('base64') + encrypted;
      const hmac = this.generateHmac(dataToAuth, derivedKey);
      
      return {
        encryptedData: encrypted,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        hmac: hmac
      };
    } catch (error) {
      console.error('[ApiKeyEncryption] Encryption failed:', error);
      throw new Error('Failed to encrypt API key');
    }
  }

  /**
   * Decrypt an API key using AES-256-CBC with HMAC verification
   */
  decryptApiKey(encryptionData: DecryptionInput): string {
    if (!encryptionData.encryptedData || !encryptionData.salt || 
        !encryptionData.iv || !encryptionData.hmac) {
      throw new Error('Invalid encryption data: missing required fields');
    }

    try {
      // Convert base64 strings back to buffers
      const salt = Buffer.from(encryptionData.salt, 'base64');
      const iv = Buffer.from(encryptionData.iv, 'base64');
      
      // Derive key from master key and salt
      const masterKey = this.getMasterKey();
      const derivedKey = this.deriveKey(masterKey, salt);
      
      // Verify HMAC first (prevent timing attacks)
      const dataToAuth = encryptionData.salt + encryptionData.iv + encryptionData.encryptedData;
      if (!this.verifyHmac(dataToAuth, derivedKey, encryptionData.hmac)) {
        throw new Error('HMAC verification failed - data may be tampered');
      }
      
      // Create decipher
      const decipher = createDecipheriv(this.algorithm, derivedKey, iv);
      
      // Decrypt the data
      let decrypted = decipher.update(encryptionData.encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('[ApiKeyEncryption] Decryption failed:', error);
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Check if encryption data is valid (has all required fields)
   */
  isValidEncryptionData(data: any): data is DecryptionInput {
    return data && 
           typeof data.encryptedData === 'string' &&
           typeof data.salt === 'string' &&
           typeof data.iv === 'string' &&
           typeof data.hmac === 'string' &&
           data.encryptedData.length > 0 &&
           data.salt.length > 0 &&
           data.iv.length > 0 &&
           data.hmac.length > 0;
  }

  /**
   * Safely encrypt API key, returning null if input is null/empty
   */
  safeEncrypt(apiKey: string | null | undefined): EncryptionResult | null {
    if (!apiKey || apiKey.trim() === '') {
      return null;
    }
    return this.encryptApiKey(apiKey);
  }

  /**
   * Safely decrypt API key, returning null if input is invalid
   */
  safeDecrypt(encryptionData: any): string | null {
    if (!this.isValidEncryptionData(encryptionData)) {
      return null;
    }
    try {
      return this.decryptApiKey(encryptionData);
    } catch (error) {
      console.warn('[ApiKeyEncryption] Safe decrypt failed:', error);
      return null;
    }
  }

  /**
   * Generate a secure random master key (for setup purposes)
   */
  static generateMasterKey(): string {
    return randomBytes(32).toString('hex');
  }
}

// Singleton instance
export const apiKeyEncryption = new ApiKeyEncryptionService();

// Export types for use in other modules
export type { EncryptionResult, DecryptionInput };
export { ApiKeyEncryptionService };