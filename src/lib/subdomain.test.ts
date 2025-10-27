import { describe, it, expect } from 'vitest';
import { generateSubdomain, isValidSubdomain } from './subdomain';

describe('subdomain utilities', () => {
  describe('generateSubdomain', () => {
    it('should generate a subdomain from an email', () => {
      const subdomain = generateSubdomain('test@example.com');

      expect(subdomain).toBeDefined();
      expect(typeof subdomain).toBe('string');
      expect(subdomain.length).toBeGreaterThan(0);
      expect(subdomain.startsWith('test-')).toBe(true);
    });

    it('should create URL-safe subdomains', () => {
      const emails = [
        'user@example.com',
        'Test.User@example.com',
        'user_name@example.com',
        'user+tag@example.com',
      ];

      emails.forEach((email) => {
        const subdomain = generateSubdomain(email);
        expect(isValidSubdomain(subdomain)).toBe(true);
      });
    });

    it('should convert uppercase to lowercase', () => {
      const subdomain = generateSubdomain('TestUser@example.com');
      expect(subdomain).toMatch(/^testuser-/);
    });

    it('should replace special characters with hyphens', () => {
      const subdomain = generateSubdomain('test.user_name@example.com');
      expect(subdomain).toMatch(/^test-user-name-/);
    });

    it('should collapse multiple hyphens into one', () => {
      const subdomain = generateSubdomain('test...user@example.com');
      // Should not have --- in the result
      expect(subdomain).not.toMatch(/---/);
    });

    it('should remove leading and trailing hyphens', () => {
      const subdomain = generateSubdomain('.test.user.@example.com');
      expect(subdomain.startsWith('-')).toBe(false);
      // The random suffix prevents ending with hyphen, but check base doesn't end with hyphen before suffix
      const basePart = subdomain.substring(0, subdomain.lastIndexOf('-'));
      expect(basePart.endsWith('-')).toBe(false);
    });

    it('should truncate long usernames to 63 characters', () => {
      const longEmail = 'a'.repeat(100) + '@example.com';
      const subdomain = generateSubdomain(longEmail);
      
      expect(subdomain.length).toBeLessThanOrEqual(63);
    });

    it('should add a random suffix for uniqueness', () => {
      const email = 'test@example.com';
      const subdomain1 = generateSubdomain(email);
      const subdomain2 = generateSubdomain(email);

      // Both should start with 'test-' but be different overall
      expect(subdomain1.startsWith('test-')).toBe(true);
      expect(subdomain2.startsWith('test-')).toBe(true);
      expect(subdomain1).not.toBe(subdomain2);
    });

    it('should generate different subdomains on multiple calls', () => {
      const email = 'user@example.com';
      const subdomains = new Set();

      for (let i = 0; i < 100; i++) {
        subdomains.add(generateSubdomain(email));
      }

      // Should have 100 unique subdomains
      expect(subdomains.size).toBe(100);
    });

    it('should handle edge case emails', () => {
      const edgeCases = [
        '@example.com', // Empty username
        '123@example.com', // Numeric username
        '-@example.com', // Single hyphen
        '...@example.com', // Only dots
      ];

      edgeCases.forEach((email) => {
        const subdomain = generateSubdomain(email);
        expect(subdomain).toBeDefined();
        expect(subdomain.length).toBeGreaterThan(0);
      });
    });
  });

  describe('isValidSubdomain', () => {
    it('should validate correct subdomains', () => {
      const validSubdomains = [
        'test',
        'test-user',
        'test123',
        'my-shop-abc12',
        'a',
        'test-user-shop-xyz99',
      ];

      validSubdomains.forEach((subdomain) => {
        expect(isValidSubdomain(subdomain)).toBe(true);
      });
    });

    it('should reject empty subdomains', () => {
      expect(isValidSubdomain('')).toBe(false);
    });

    it('should reject subdomains longer than 63 characters', () => {
      const longSubdomain = 'a'.repeat(64);
      expect(isValidSubdomain(longSubdomain)).toBe(false);
    });

    it('should accept subdomains exactly 63 characters', () => {
      const exactSubdomain = 'a'.repeat(63);
      expect(isValidSubdomain(exactSubdomain)).toBe(true);
    });

    it('should reject subdomains with uppercase letters', () => {
      expect(isValidSubdomain('TestUser')).toBe(false);
      expect(isValidSubdomain('test-User')).toBe(false);
    });

    it('should reject subdomains with special characters', () => {
      const invalidSubdomains = [
        'test_user',
        'test.user',
        'test@user',
        'test user',
        'test!user',
        'test$user',
      ];

      invalidSubdomains.forEach((subdomain) => {
        expect(isValidSubdomain(subdomain)).toBe(false);
      });
    });

    it('should reject subdomains starting with hyphen', () => {
      expect(isValidSubdomain('-test')).toBe(false);
      expect(isValidSubdomain('-test-user')).toBe(false);
    });

    it('should reject subdomains ending with hyphen', () => {
      expect(isValidSubdomain('test-')).toBe(false);
      expect(isValidSubdomain('test-user-')).toBe(false);
    });

    it('should accept subdomains with hyphens in the middle', () => {
      expect(isValidSubdomain('test-user')).toBe(true);
      expect(isValidSubdomain('my-shop-123')).toBe(true);
    });

    it('should accept numeric-only subdomains', () => {
      expect(isValidSubdomain('123')).toBe(true);
      expect(isValidSubdomain('123-456')).toBe(true);
    });
  });
});
