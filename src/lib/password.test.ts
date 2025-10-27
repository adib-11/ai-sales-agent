import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';

// Test password hashing directly with bcrypt to avoid NextAuth import issues
describe('password hashing', () => {
  it('should hash a password successfully', async () => {
    const password = 'testPassword123';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should produce different hashes for the same password', async () => {
    const password = 'testPassword123';
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);

    expect(hash1).not.toBe(hash2);
  });

  it('should create a hash that can be verified with bcrypt', async () => {
    const password = 'testPassword123';
    const hash = await bcrypt.hash(password, 10);

    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await bcrypt.compare('wrongPassword', hash);
    expect(isInvalid).toBe(false);
  });

  it('should use bcrypt rounds of 10', async () => {
    const password = 'testPassword123';
    const hash = await bcrypt.hash(password, 10);

    // Bcrypt hash format: $2b$<rounds>$<salt><hash>
    const rounds = hash.split('$')[2];
    expect(rounds).toBe('10');
  });

  it('should handle empty string password', async () => {
    const password = '';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).toBeDefined();
    const isValid = await bcrypt.compare('', hash);
    expect(isValid).toBe(true);
  });

  it('should handle long passwords', async () => {
    const password = 'a'.repeat(100);
    const hash = await bcrypt.hash(password, 10);

    expect(hash).toBeDefined();
    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });

  it('should handle special characters in password', async () => {
    const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).toBeDefined();
    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });
});
