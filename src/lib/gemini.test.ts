import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateChatbotResponse } from './gemini';
import type { ProductContext, GeminiResponse } from './types';

describe('generateChatbotResponse', () => {
  const originalAbortController = global.AbortController;

  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-api-key-12345');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    global.AbortController = originalAbortController;
  });

  it('should generate response from Gemini API', async () => {
    const mockResponse: GeminiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'The Red Mug costs $15.00' }],
          },
          finishReason: 'STOP',
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    global.fetch = mockFetch;

    const products: ProductContext[] = [{ name: 'Red Mug', price: '$15.00' }];
    const response = await generateChatbotResponse(products, 'How much is the red mug?');

    expect(response).toBe('The Red Mug costs $15.00');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-2.0-flash-exp'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-goog-api-key': 'test-api-key-12345',
        }),
      })
    );
  });

  it('should throw error if API key is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');

    const products: ProductContext[] = [{ name: 'Red Mug', price: '$15.00' }];

    await expect(
      generateChatbotResponse(products, 'How much?')
    ).rejects.toThrow('GEMINI_API_KEY environment variable is required');
  });

  it('should throw error if customer message is empty', async () => {
    const products: ProductContext[] = [{ name: 'Red Mug', price: '$15.00' }];

    await expect(
      generateChatbotResponse(products, '')
    ).rejects.toThrow('Customer message cannot be empty');

    await expect(
      generateChatbotResponse(products, '   ')
    ).rejects.toThrow('Customer message cannot be empty');
  });

  it('should handle API error response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid API key',
    });
    global.fetch = mockFetch;

    const products: ProductContext[] = [{ name: 'Red Mug', price: '$15.00' }];

    await expect(
      generateChatbotResponse(products, 'How much?')
    ).rejects.toThrow('Gemini API error (401): Invalid API key');
  });

  it('should handle rate limit error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });
    global.fetch = mockFetch;

    const products: ProductContext[] = [{ name: 'Red Mug', price: '$15.00' }];

    await expect(
      generateChatbotResponse(products, 'How much?')
    ).rejects.toThrow('Gemini API error (429): Rate limit exceeded');
  });

  it('should handle server error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    });
    global.fetch = mockFetch;

    const products: ProductContext[] = [{ name: 'Red Mug', price: '$15.00' }];

    await expect(
      generateChatbotResponse(products, 'How much?')
    ).rejects.toThrow('Gemini API error (500): Internal server error');
  });

  it('should handle timeout', async () => {
    // Mock AbortController to simulate immediate abort
    const mockAbort = vi.fn();
    global.AbortController = function() {
      return {
        abort: mockAbort,
        signal: { aborted: false },
      };
    } as any;

    const mockFetch = vi.fn().mockImplementation(() => {
      // Simulate aborted request
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });
    global.fetch = mockFetch;

    const products: ProductContext[] = [{ name: 'Red Mug', price: '$15.00' }];

    await expect(
      generateChatbotResponse(products, 'How much?')
    ).rejects.toThrow('timed out after 5000ms');
  });

  it('should include all products in prompt', async () => {
    const mockResponse: GeminiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'We have 3 products available' }],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    global.fetch = mockFetch;

    const products: ProductContext[] = [
      { name: 'Red Mug', price: '$15.00' },
      { name: 'Blue Mug', price: '$12.50' },
      { name: 'Green Mug', price: '$14.00' },
    ];

    await generateChatbotResponse(products, 'What products do you have?');

    expect(mockFetch).toHaveBeenCalledOnce();
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);
    const prompt = requestBody.contents[0].parts[0].text;

    // Verify all products are in the prompt
    expect(prompt).toContain('Red Mug');
    expect(prompt).toContain('$15.00');
    expect(prompt).toContain('Blue Mug');
    expect(prompt).toContain('$12.50');
    expect(prompt).toContain('Green Mug');
    expect(prompt).toContain('$14.00');
  });

  it('should handle empty product list', async () => {
    const mockResponse: GeminiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'No products available at this time' }],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    global.fetch = mockFetch;

    const products: ProductContext[] = [];
    const response = await generateChatbotResponse(products, 'What do you have?');

    expect(response).toBe('No products available at this time');

    // Verify prompt indicates no products
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);
    const prompt = requestBody.contents[0].parts[0].text;
    expect(prompt).toContain('No products available');
  });

  it('should handle malformed API response (no candidates)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });
    global.fetch = mockFetch;

    const products: ProductContext[] = [{ name: 'Red Mug', price: '$15.00' }];

    await expect(
      generateChatbotResponse(products, 'How much?')
    ).rejects.toThrow('No candidates returned from Gemini API');
  });

  it('should handle malformed API response (no text)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [],
            },
          },
        ],
      }),
    });
    global.fetch = mockFetch;

    const products: ProductContext[] = [{ name: 'Red Mug', price: '$15.00' }];

    await expect(
      generateChatbotResponse(products, 'How much?')
    ).rejects.toThrow('No text content in Gemini API response');
  });

  it('should properly construct prompt with system role and instructions', async () => {
    const mockResponse: GeminiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'AI response' }],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    global.fetch = mockFetch;

    const products: ProductContext[] = [{ name: 'Red Mug', price: '$15.00' }];
    await generateChatbotResponse(products, 'What colors do you have?');

    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);
    const prompt = requestBody.contents[0].parts[0].text;

    // Verify prompt structure
    expect(prompt).toContain('helpful sales assistant');
    expect(prompt).toContain('Product Catalog:');
    expect(prompt).toContain('Customer Question:');
    expect(prompt).toContain('What colors do you have?');
    expect(prompt).toContain('Instructions:');
  });
});
