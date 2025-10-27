import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateStateToken, exchangeCodeForToken, getUserPages, verifyWebhookSignature, sendMessage } from './facebook';
import crypto from 'crypto';

describe('Facebook Helper Functions', () => {
  describe('generateStateToken', () => {
    it('should generate a random state token', () => {
      const token1 = generateStateToken();
      const token2 = generateStateToken();

      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(10);
    });
  });

  describe('exchangeCodeForToken', () => {
    beforeEach(() => {
      vi.stubEnv('FACEBOOK_APP_ID', 'test-app-id');
      vi.stubEnv('FACEBOOK_APP_SECRET', 'test-app-secret');
    });

    it('should exchange code for access token', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        token_type: 'bearer',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const token = await exchangeCodeForToken('test-code', 'http://localhost:3000/callback');

      expect(token).toBe('test-access-token');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/access_token')
      );
    });

    it('should throw error on failed exchange', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Invalid code',
      });

      await expect(
        exchangeCodeForToken('invalid-code', 'http://localhost:3000/callback')
      ).rejects.toThrow();
    });
  });

  describe('getUserPages', () => {
    it('should fetch user pages', async () => {
      const mockPages = [
        { id: '123', name: 'Test Page 1', access_token: 'token1' },
        { id: '456', name: 'Test Page 2', access_token: 'token2' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockPages }),
      });

      const pages = await getUserPages('test-user-token');

      expect(pages).toEqual(mockPages);
      expect(pages.length).toBe(2);
    });

    it('should throw error on failed fetch', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Invalid token',
      });

      await expect(getUserPages('invalid-token')).rejects.toThrow();
    });
  });
});

// Tests for webhook signature verification
describe('verifyWebhookSignature', () => {
  const testAppSecret = 'test_app_secret_12345';
  const testBody = '{"test":"payload"}';

  it('should return true for valid signature', () => {
    const expectedHash = crypto
      .createHmac('sha256', testAppSecret)
      .update(testBody)
      .digest('hex');
    const signature = `sha256=${expectedHash}`;

    const result = verifyWebhookSignature(signature, testBody, testAppSecret);
    expect(result).toBe(true);
  });

  it('should return false for invalid signature', () => {
    const signature = 'sha256=invalid_signature_hash';
    const result = verifyWebhookSignature(signature, testBody, testAppSecret);
    expect(result).toBe(false);
  });

  it('should return false for missing signature', () => {
    const result = verifyWebhookSignature(null, testBody, testAppSecret);
    expect(result).toBe(false);
  });

  it('should return false for undefined signature', () => {
    const result = verifyWebhookSignature(undefined, testBody, testAppSecret);
    expect(result).toBe(false);
  });

  it('should return false for signature without sha256= prefix', () => {
    const signature = 'invalid_format_signature';
    const result = verifyWebhookSignature(signature, testBody, testAppSecret);
    expect(result).toBe(false);
  });

  it('should return false for signature mismatch', () => {
    const wrongHash = crypto
      .createHmac('sha256', 'wrong_secret')
      .update(testBody)
      .digest('hex');
    const signature = `sha256=${wrongHash}`;

    const result = verifyWebhookSignature(signature, testBody, testAppSecret);
    expect(result).toBe(false);
  });

  it('should return false for different body content', () => {
    const expectedHash = crypto
      .createHmac('sha256', testAppSecret)
      .update(testBody)
      .digest('hex');
    const signature = `sha256=${expectedHash}`;
    const differentBody = '{"different":"payload"}';

    const result = verifyWebhookSignature(signature, differentBody, testAppSecret);
    expect(result).toBe(false);
  });
});

// Tests for sendMessage function
describe('sendMessage', () => {
  const testToken = 'test-page-access-token';
  const testRecipientId = '123456789';
  const testMessage = 'Hello, this is a test message';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send message successfully', async () => {
    const mockResponse = {
      recipient_id: testRecipientId,
      message_id: 'mid.1234567890',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    global.fetch = mockFetch;

    await sendMessage(testToken, testRecipientId, testMessage);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/me/messages'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        }),
        body: JSON.stringify({
          recipient: { id: testRecipientId },
          message: { text: testMessage },
        }),
      })
    );
  });

  it('should throw error on invalid access token (401)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid OAuth access token',
    });
    global.fetch = mockFetch;

    await expect(
      sendMessage(testToken, testRecipientId, testMessage)
    ).rejects.toThrow('Facebook Send API error (401)');
  });

  it('should throw error on permission denied (403)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Permission denied',
    });
    global.fetch = mockFetch;

    await expect(
      sendMessage(testToken, testRecipientId, testMessage)
    ).rejects.toThrow('Facebook Send API error (403)');
  });

  it('should not retry on 4xx client errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    });
    global.fetch = mockFetch;

    await expect(
      sendMessage(testToken, testRecipientId, testMessage)
    ).rejects.toThrow('Facebook Send API error (400)');

    // Should only be called once (no retry)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on 5xx server errors', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recipient_id: testRecipientId,
          message_id: 'mid.after-retry',
        }),
      });

    global.fetch = mockFetch;

    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation(((...args: Parameters<typeof setTimeout>) => {
        const [callback, _ms, ...callbackArgs] = args;
        (callback as (...innerArgs: unknown[]) => void)(...callbackArgs);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as unknown as typeof setTimeout);

    await sendMessage(testToken, testRecipientId, testMessage);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    setTimeoutSpy.mockRestore();
  });

  it('should throw error after retry fails', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Still failing',
      });

    global.fetch = mockFetch;

    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation(((...args: Parameters<typeof setTimeout>) => {
        const [callback, _ms, ...callbackArgs] = args;
        (callback as (...innerArgs: unknown[]) => void)(...callbackArgs);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as unknown as typeof setTimeout);

    await expect(sendMessage(testToken, testRecipientId, testMessage)).rejects.toThrow('Facebook Send API error');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    setTimeoutSpy.mockRestore();
  });

  it('should throw error after retry fails', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Still failing',
      });

    global.fetch = mockFetch;

    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation(((...args: Parameters<typeof setTimeout>) => {
        const [callback, _ms, ...callbackArgs] = args;
        (callback as (...innerArgs: unknown[]) => void)(...callbackArgs);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as unknown as typeof setTimeout);

    await expect(
      sendMessage(testToken, testRecipientId, testMessage)
    ).rejects.toThrow('Facebook Send API error');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    setTimeoutSpy.mockRestore();
  });

  it('should handle rate limit error (429)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });
    global.fetch = mockFetch;

    await expect(
      sendMessage(testToken, testRecipientId, testMessage)
    ).rejects.toThrow('Facebook Send API error (429)');
  });

  it('should properly format message request body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recipient_id: testRecipientId, message_id: 'mid.123' }),
    });
    global.fetch = mockFetch;

    await sendMessage(testToken, testRecipientId, 'Custom message text');

    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);

    expect(requestBody).toEqual({
      recipient: { id: testRecipientId },
      message: { text: 'Custom message text' },
    });
  });
});
