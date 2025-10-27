import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, clearMessageLog, getMessageLog } from './route';
import crypto from 'crypto';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    WEBHOOK_VERIFY_TOKEN: 'test_verify_token_12345',
    FACEBOOK_APP_SECRET: 'test_app_secret_12345',
  };
  clearMessageLog();
});

afterEach(() => {
  process.env = originalEnv;
  vi.clearAllMocks();
});

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    facebookPageConnection: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';

describe('GET /api/webhook/messenger (Webhook Verification)', () => {
  it('should return challenge for valid verification request', async () => {
    const url = new URL('http://localhost:3000/api/webhook/messenger');
    url.searchParams.set('hub.mode', 'subscribe');
    url.searchParams.set('hub.verify_token', 'test_verify_token_12345');
    url.searchParams.set('hub.challenge', 'test_challenge_value');

    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe('test_challenge_value');
  });

  it('should return 403 for invalid verify token', async () => {
    const url = new URL('http://localhost:3000/api/webhook/messenger');
    url.searchParams.set('hub.mode', 'subscribe');
    url.searchParams.set('hub.verify_token', 'wrong_token');
    url.searchParams.set('hub.challenge', 'test_challenge_value');

    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it('should return 403 for missing parameters', async () => {
    const url = new URL('http://localhost:3000/api/webhook/messenger');
    url.searchParams.set('hub.mode', 'subscribe');
    // Missing verify_token and challenge

    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it('should return 403 for wrong hub.mode', async () => {
    const url = new URL('http://localhost:3000/api/webhook/messenger');
    url.searchParams.set('hub.mode', 'unsubscribe');
    url.searchParams.set('hub.verify_token', 'test_verify_token_12345');
    url.searchParams.set('hub.challenge', 'test_challenge_value');

    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it('should return 500 if WEBHOOK_VERIFY_TOKEN not configured', async () => {
    delete process.env.WEBHOOK_VERIFY_TOKEN;

    const url = new URL('http://localhost:3000/api/webhook/messenger');
    url.searchParams.set('hub.mode', 'subscribe');
    url.searchParams.set('hub.verify_token', 'test_verify_token_12345');
    url.searchParams.set('hub.challenge', 'test_challenge_value');

    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(500);
  });
});

describe('POST /api/webhook/messenger (Message Receipt)', () => {
  function createSignedRequest(body: string): NextRequest {
    const signature = crypto
      .createHmac('sha256', 'test_app_secret_12345')
      .update(body)
      .digest('hex');

    const url = new URL('http://localhost:3000/api/webhook/messenger');
    const request = new NextRequest(url, {
      method: 'POST',
      headers: {
        'x-hub-signature-256': `sha256=${signature}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    return request;
  }

  it('should process valid webhook payload and log message', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'test_page_id_123',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'test_sender_psid' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567890,
              message: {
                mid: 'm_test_message_id',
                text: 'Hello, do you have red mugs?',
              },
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    // Mock database response
    vi.mocked(prisma.facebookPageConnection.findUnique).mockResolvedValue({
      id: 'conn_123',
      user_id: 'user_123',
      facebook_page_id: 'test_page_id_123',
      page_access_token: 'encrypted_token',
      page_name: 'Test Page',
      connected_at: new Date(),
    });

    // Mock product query for chatbot (Story 1.6)
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);

    const response = await POST(request);

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ status: 'ok' });

    // Verify message was logged
    const logs = getMessageLog();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      userId: 'user_123',
      pageId: 'test_page_id_123',
      senderId: 'test_sender_psid',
      messageText: 'Hello, do you have red mugs?',
    });
  });

  it('should handle multiple messages in single payload', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'test_page_id_123',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'sender_1' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567890,
              message: { mid: 'm_1', text: 'Message 1' },
            },
            {
              sender: { id: 'sender_2' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567891,
              message: { mid: 'm_2', text: 'Message 2' },
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    vi.mocked(prisma.facebookPageConnection.findUnique).mockResolvedValue({
      id: 'conn_123',
      user_id: 'user_123',
      facebook_page_id: 'test_page_id_123',
      page_access_token: 'encrypted_token',
      page_name: 'Test Page',
      connected_at: new Date(),
    });

    // Mock product query for chatbot (Story 1.6)
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);

    const response = await POST(request);

    expect(response.status).toBe(200);
    const logs = getMessageLog();
    expect(logs).toHaveLength(2);
  });

  it('should skip non-text messages gracefully', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'test_page_id_123',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'sender_1' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567890,
              message: { mid: 'm_1' }, // No text field
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    const response = await POST(request);

    expect(response.status).toBe(200);
    const logs = getMessageLog();
    expect(logs).toHaveLength(0); // Message not logged
  });

  it('should filter out non-message events', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'test_page_id_123',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'sender_1' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567890,
              // No message field (e.g., read receipt)
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    const response = await POST(request);

    expect(response.status).toBe(200);
    const logs = getMessageLog();
    expect(logs).toHaveLength(0);
  });

  it('should return 200 for unknown Page ID and log warning', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'unknown_page_id',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'sender_1' },
              recipient: { id: 'unknown_page_id' },
              timestamp: 1234567890,
              message: { mid: 'm_1', text: 'Test message' },
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    // Mock no page connection found
    vi.mocked(prisma.facebookPageConnection.findUnique).mockResolvedValue(null);

    const response = await POST(request);

    expect(response.status).toBe(200);
    const logs = getMessageLog();
    expect(logs).toHaveLength(0); // Message not logged
  });

  it('should return 200 for invalid signature', async () => {
    const payload = {
      object: 'page',
      entry: [],
    };

    const bodyString = JSON.stringify(payload);
    const url = new URL('http://localhost:3000/api/webhook/messenger');
    const request = new NextRequest(url, {
      method: 'POST',
      headers: {
        'x-hub-signature-256': 'sha256=invalid_signature',
        'Content-Type': 'application/json',
      },
      body: bodyString,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const logs = getMessageLog();
    expect(logs).toHaveLength(0);
  });

  it('should return 200 for malformed JSON', async () => {
    const bodyString = 'invalid json{';
    const request = createSignedRequest(bodyString);

    const response = await POST(request);

    expect(response.status).toBe(200); // Graceful error handling
  });

  it('should return 200 for wrong object type', async () => {
    const payload = {
      object: 'user', // Wrong type
      entry: [],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    const response = await POST(request);

    expect(response.status).toBe(200);
    const logs = getMessageLog();
    expect(logs).toHaveLength(0);
  });

  it('should return 200 if FACEBOOK_APP_SECRET not configured', async () => {
    delete process.env.FACEBOOK_APP_SECRET;

    const payload = { object: 'page', entry: [] };
    const bodyString = JSON.stringify(payload);
    const url = new URL('http://localhost:3000/api/webhook/messenger');
    const request = new NextRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: bodyString,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });
});

// Mock Gemini API and Facebook Send API
vi.mock('@/lib/gemini', () => ({
  generateChatbotResponse: vi.fn(),
}));

vi.mock('@/lib/facebook', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    sendMessage: vi.fn(),
  };
});

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((token: string) => `decrypted_${token}`),
  encrypt: vi.fn((token: string) => `encrypted_${token}`),
}));

import { generateChatbotResponse } from '@/lib/gemini';
import { sendMessage } from '@/lib/facebook';

describe('POST /api/webhook/messenger (Chatbot Integration)', () => {
  function createSignedRequest(body: string): NextRequest {
    const signature = crypto
      .createHmac('sha256', 'test_app_secret_12345')
      .update(body)
      .digest('hex');

    const url = new URL('http://localhost:3000/api/webhook/messenger');
    const request = new NextRequest(url, {
      method: 'POST',
      headers: {
        'x-hub-signature-256': `sha256=${signature}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    return request;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process end-to-end chatbot flow', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'test_page_id_123',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'test_sender_psid' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567890,
              message: {
                mid: 'm_test_message_id',
                text: 'Do you have red mugs?',
              },
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    // Mock database responses
    vi.mocked(prisma.facebookPageConnection.findUnique).mockResolvedValue({
      id: 'conn_123',
      user_id: 'user_123',
      facebook_page_id: 'test_page_id_123',
      page_access_token: 'encrypted_token_abc',
      page_name: 'Test Page',
      connected_at: new Date(),
    });

    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 'prod_1',
        user_id: 'user_123',
        name: 'Red Mug',
        price: '$15.00',
        image_url: 'https://example.com/red-mug.jpg',
        created_at: new Date(),
      },
      {
        id: 'prod_2',
        user_id: 'user_123',
        name: 'Blue Mug',
        price: '$12.50',
        image_url: 'https://example.com/blue-mug.jpg',
        created_at: new Date(),
      },
    ]);

    // Mock Gemini API
    vi.mocked(generateChatbotResponse).mockResolvedValue(
      'Yes! We have a Red Mug available for $15.00'
    );

    // Mock Facebook Send API
    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify products were fetched
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user_123' },
      select: { name: true, price: true },
    });

    // Verify Gemini was called with correct products and message
    expect(generateChatbotResponse).toHaveBeenCalledWith(
      [
        { name: 'Red Mug', price: '$15.00' },
        { name: 'Blue Mug', price: '$12.50' },
      ],
      'Do you have red mugs?'
    );

    // Verify message was sent
    expect(sendMessage).toHaveBeenCalledWith(
      'decrypted_encrypted_token_abc',
      'test_sender_psid',
      'Yes! We have a Red Mug available for $15.00'
    );
  });

  it('should handle Gemini API errors gracefully and return 200', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'test_page_id_123',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'test_sender_psid' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567890,
              message: { mid: 'm_test', text: 'Hello' },
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    vi.mocked(prisma.facebookPageConnection.findUnique).mockResolvedValue({
      id: 'conn_123',
      user_id: 'user_123',
      facebook_page_id: 'test_page_id_123',
      page_access_token: 'encrypted_token',
      page_name: 'Test Page',
      connected_at: new Date(),
    });

    vi.mocked(prisma.product.findMany).mockResolvedValue([]);

    // Mock Gemini API error
    vi.mocked(generateChatbotResponse).mockRejectedValue(
      new Error('Gemini API timeout')
    );

    const response = await POST(request);

    // Should still return 200 to Facebook
    expect(response.status).toBe(200);
    
    // Verify sendMessage was NOT called
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should handle Facebook Send API errors gracefully and return 200', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'test_page_id_123',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'test_sender_psid' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567890,
              message: { mid: 'm_test', text: 'Hello' },
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    vi.mocked(prisma.facebookPageConnection.findUnique).mockResolvedValue({
      id: 'conn_123',
      user_id: 'user_123',
      facebook_page_id: 'test_page_id_123',
      page_access_token: 'encrypted_token',
      page_name: 'Test Page',
      connected_at: new Date(),
    });

    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 'p1', user_id: 'user_123', name: 'Mug', price: '$10', image_url: 'url', created_at: new Date() },
    ]);

    vi.mocked(generateChatbotResponse).mockResolvedValue('AI response');

    // Mock Facebook Send API error
    vi.mocked(sendMessage).mockRejectedValue(
      new Error('Invalid access token')
    );

    const response = await POST(request);

    // Should still return 200 to Facebook
    expect(response.status).toBe(200);
  });

  it('should handle empty product list', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'test_page_id_123',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'test_sender_psid' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567890,
              message: { mid: 'm_test', text: 'What products do you have?' },
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    vi.mocked(prisma.facebookPageConnection.findUnique).mockResolvedValue({
      id: 'conn_123',
      user_id: 'user_123',
      facebook_page_id: 'test_page_id_123',
      page_access_token: 'encrypted_token',
      page_name: 'Test Page',
      connected_at: new Date(),
    });

    // No products found
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);

    vi.mocked(generateChatbotResponse).mockResolvedValue(
      'We currently have no products available'
    );

    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify Gemini was called with empty product list
    expect(generateChatbotResponse).toHaveBeenCalledWith(
      [],
      'What products do you have?'
    );

    expect(sendMessage).toHaveBeenCalled();
  });

  it('should send AI response to correct recipient', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'test_page_id_123',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'customer_psid_999' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567890,
              message: { mid: 'm_test', text: 'Question' },
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    vi.mocked(prisma.facebookPageConnection.findUnique).mockResolvedValue({
      id: 'conn_123',
      user_id: 'user_123',
      facebook_page_id: 'test_page_id_123',
      page_access_token: 'encrypted_token',
      page_name: 'Test Page',
      connected_at: new Date(),
    });

    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(generateChatbotResponse).mockResolvedValue('Answer from AI');
    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify message sent to correct customer PSID
    expect(sendMessage).toHaveBeenCalledWith(
      expect.any(String),
      'customer_psid_999', // Correct sender ID
      'Answer from AI'
    );
  });

  it('should decrypt page access token before sending', async () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'test_page_id_123',
          time: 1234567890,
          messaging: [
            {
              sender: { id: 'test_sender_psid' },
              recipient: { id: 'test_page_id_123' },
              timestamp: 1234567890,
              message: { mid: 'm_test', text: 'Hello' },
            },
          ],
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const request = createSignedRequest(bodyString);

    vi.mocked(prisma.facebookPageConnection.findUnique).mockResolvedValue({
      id: 'conn_123',
      user_id: 'user_123',
      facebook_page_id: 'test_page_id_123',
      page_access_token: 'ENCRYPTED_TOKEN_XYZ',
      page_name: 'Test Page',
      connected_at: new Date(),
    });

    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(generateChatbotResponse).mockResolvedValue('AI response');
    vi.mocked(sendMessage).mockResolvedValue(undefined);

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify decrypted token was used
    expect(sendMessage).toHaveBeenCalledWith(
      'decrypted_ENCRYPTED_TOKEN_XYZ',
      expect.any(String),
      expect.any(String)
    );
  });
});
