/**
 * Simple API Key Encryption Service (Browser Compatible)
 * 
 * Provides basic encryption for API keys using Web Crypto API.
 * For demonstration purposes - in production, use proper key management.
 */

export interface EncryptedApiKey {
  data: string;
  iv: string;
}

class SimpleApiKeyEncryption {
  private readonly algorithm = 'AES-GCM';
  private readonly keyLength = 256;

  /**
   * Get or generate encryption key
   */
  private async getEncryptionKey(): Promise<CryptoKey> {
    // For demo purposes, derive from a static string
    // In production, use proper key management
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('demo-encryption-key-32chars-min'),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('static-salt-for-demo'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt an API key
   */
  async encryptApiKey(apiKey: string, userId?: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
      
      const encodedText = new TextEncoder().encode(apiKey);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedText
      );

      const result: EncryptedApiKey = {
        data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv))
      };

      console.log('🔐 API Key encrypted', { userId: userId || 'unknown' });
      return JSON.stringify(result);
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw new Error('Failed to encrypt API key');
    }
  }

  /**
   * Decrypt an API key
   */
  async decryptApiKey(encryptedData: string, userId?: string): Promise<string> {
    try {
      const parsed: EncryptedApiKey = JSON.parse(encryptedData);
      const key = await this.getEncryptionKey();
      
      // Convert base64 back to Uint8Array
      const data = new Uint8Array(
        atob(parsed.data).split('').map(char => char.charCodeAt(0))
      );
      const iv = new Uint8Array(
        atob(parsed.iv).split('').map(char => char.charCodeAt(0))
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      const result = new TextDecoder().decode(decrypted);
      console.log('🔓 API Key decrypted', { userId: userId || 'unknown' });
      return result;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Test encryption/decryption
   */
  async testEncryption(): Promise<boolean> {
    try {
      const testKey = 'test-api-key-123';
      const encrypted = await this.encryptApiKey(testKey);
      const decrypted = await this.decryptApiKey(encrypted);
      
      const success = decrypted === testKey;
      console.log(success ? '✅ Encryption test passed' : '❌ Encryption test failed');
      return success;
    } catch (error) {
      console.error('❌ Encryption test error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const apiKeyEncryptionService = new SimpleApiKeyEncryption();
export default apiKeyEncryptionService;