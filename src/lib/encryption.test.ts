import { describe, it, expect, vi } from 'vitest';

// Mock environment variables before importing the module
vi.stubEnv('ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

import { encrypt, decrypt } from './encryption';

describe('Encryption Utility', () => {

  it('should encrypt text', () => {
    const plaintext = 'test-access-token-12345';
    const encrypted = encrypt(plaintext);

    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':'); // IV separator
  });

  it('should produce different output each time due to IV', () => {
    const plaintext = 'test-access-token-12345';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should decrypt encrypted text correctly', () => {
    const plaintext = 'test-access-token-12345';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle empty strings', () => {
    const plaintext = '';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle special characters', () => {
    const plaintext = 'token!@#$%^&*()_+-={}[]|;:"<>?,./';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle long strings', () => {
    const plaintext = 'a'.repeat(1000);
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should complete round-trip encryption/decryption', () => {
    const plaintexts = [
      'short',
      'medium length access token',
      'EAABwzLixnjYBO1234567890abcdefg',
      'token with spaces and symbols !@#',
    ];

    plaintexts.forEach((plaintext) => {
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  it('should throw error for invalid encrypted format', () => {
    expect(() => decrypt('invalid-format')).toThrow();
  });

  it('should throw error for malformed encrypted text', () => {
    expect(() => decrypt('abc:def')).toThrow();
  });
});
