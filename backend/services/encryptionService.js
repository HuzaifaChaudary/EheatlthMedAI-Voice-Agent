const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
  }

  generateKey() {
    return crypto.randomBytes(this.keyLength);
  }

  encrypt(text, key) {
    try {
      if (!key || !Buffer.isBuffer(key)) {
        throw new Error('Valid encryption key is required');
      }

      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  decrypt(encryptedData, key) {
    try {
      if (!key || !Buffer.isBuffer(key)) {
        throw new Error('Valid decryption key is required');
      }

      const { encrypted, iv, tag } = encryptedData;

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        key,
        Buffer.from(iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  encryptWithPassword(text, password) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
    const encrypted = this.encrypt(text, key);

    return {
      ...encrypted,
      salt: salt.toString('hex')
    };
  }

  decryptWithPassword(encryptedData, password) {
    const { salt, ...rest } = encryptedData;
    const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, this.keyLength, 'sha256');
    return this.decrypt(rest, key);
  }

  hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  generateKeyFromEnv() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey) {
      return crypto.createHash('sha256').update(envKey).digest();
    }
    console.warn('ENCRYPTION_KEY not set in environment, using default (NOT SECURE FOR PRODUCTION)');
    return crypto.createHash('sha256').update('default-key-change-in-production').digest();
  }
}

module.exports = new EncryptionService();

