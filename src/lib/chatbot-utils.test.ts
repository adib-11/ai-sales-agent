import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseGeminiResponse,
  getOutOfScopeMessage,
  getAlternativeSuggestionMessage,
} from './chatbot-utils';
import type { ProductContext } from './types';

describe('chatbot-utils', () => {
  // Mock product catalog for testing
  const mockProducts: ProductContext[] = [
    { name: 'Red Mug', price: '$15.00' },
    { name: 'Blue Mug', price: '$12.00' },
    { name: 'Green Plate', price: '$20.00' },
  ];

  describe('parseGeminiResponse', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should detect OUT_OF_SCOPE signal', () => {
      const result = parseGeminiResponse('OUT_OF_SCOPE', mockProducts);

      expect(result.type).toBe('out-of-scope');
      expect(result.text).toContain('contact the shop owner');
      expect(result.suggestedProduct).toBeUndefined();
    });

    it('should detect OUT_OF_SCOPE signal with whitespace', () => {
      const result = parseGeminiResponse('  OUT_OF_SCOPE  ', mockProducts);

      expect(result.type).toBe('out-of-scope');
      expect(result.text).toBe(getOutOfScopeMessage());
    });

    it('should detect ALTERNATIVE signal and extract product name', () => {
      const result = parseGeminiResponse('ALTERNATIVE: Red Mug', mockProducts);

      expect(result.type).toBe('alternative');
      expect(result.suggestedProduct).toBe('Red Mug');
      expect(result.text).toContain('Red Mug');
      expect(result.text).toContain('$15.00');
    });

    it('should detect ALTERNATIVE signal with extra whitespace', () => {
      const result = parseGeminiResponse('ALTERNATIVE:   Blue Mug  ', mockProducts);

      expect(result.type).toBe('alternative');
      expect(result.suggestedProduct).toBe('Blue Mug');
      expect(result.text).toContain('Blue Mug');
      expect(result.text).toContain('$12.00');
    });

    it('should handle normal response without signals', () => {
      const normalResponse = 'The red mug costs $15 and is great for coffee!';
      const result = parseGeminiResponse(normalResponse, mockProducts);

      expect(result.type).toBe('normal');
      expect(result.text).toBe(normalResponse);
      expect(result.suggestedProduct).toBeUndefined();
    });

    it('should handle malformed ALTERNATIVE (no product name)', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parseGeminiResponse('ALTERNATIVE:', mockProducts);

      expect(result.type).toBe('normal');
      expect(result.text).toBe('ALTERNATIVE:');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ALTERNATIVE signal detected but product not found')
      );
    });

    it('should handle ALTERNATIVE with product not in catalog', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = parseGeminiResponse('ALTERNATIVE: Purple Mug', mockProducts);

      expect(result.type).toBe('normal');
      expect(result.text).toBe('ALTERNATIVE: Purple Mug');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ALTERNATIVE signal detected but product not found')
      );
    });

    it('should throw error for empty response', () => {
      expect(() => parseGeminiResponse('', mockProducts)).toThrow('AI response cannot be empty');
    });

    it('should throw error for whitespace-only response', () => {
      expect(() => parseGeminiResponse('   ', mockProducts)).toThrow('AI response cannot be empty');
    });

    it('should throw error for null response', () => {
      expect(() => parseGeminiResponse(null as any, mockProducts)).toThrow('AI response cannot be empty');
    });

    it('should handle response with OUT_OF_SCOPE not at start', () => {
      const result = parseGeminiResponse('Sorry, OUT_OF_SCOPE is mentioned here', mockProducts);

      expect(result.type).toBe('normal');
      expect(result.text).toContain('Sorry, OUT_OF_SCOPE');
    });

    it('should handle response with ALTERNATIVE not at start', () => {
      const result = parseGeminiResponse('Maybe try ALTERNATIVE: Red Mug', mockProducts);

      expect(result.type).toBe('normal');
      expect(result.text).toContain('Maybe try ALTERNATIVE');
    });
  });

  describe('getOutOfScopeMessage', () => {
    it('should return correct message format', () => {
      const message = getOutOfScopeMessage();

      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('should include "contact the shop owner" text', () => {
      const message = getOutOfScopeMessage();

      expect(message).toContain('contact the shop owner');
    });

    it('should be user-friendly (no technical jargon)', () => {
      const message = getOutOfScopeMessage();

      expect(message.toLowerCase()).not.toContain('error');
      expect(message.toLowerCase()).not.toContain('api');
      expect(message.toLowerCase()).not.toContain('system');
    });

    it('should mention product limitation', () => {
      const message = getOutOfScopeMessage();

      expect(message.toLowerCase()).toContain('product');
    });
  });

  describe('getAlternativeSuggestionMessage', () => {
    it('should include product name and price', () => {
      const product = mockProducts[0]; // Red Mug, $15.00
      const message = getAlternativeSuggestionMessage(product);

      expect(message).toContain('Red Mug');
      expect(message).toContain('$15.00');
    });

    it('should suggest alternative clearly', () => {
      const product = mockProducts[1]; // Blue Mug, $12.00
      const message = getAlternativeSuggestionMessage(product);

      expect(message.toLowerCase()).toContain('have');
      expect(message).toContain('Blue Mug');
    });

    it('should use friendly tone', () => {
      const product = mockProducts[2]; // Green Plate, $20.00
      const message = getAlternativeSuggestionMessage(product);

      expect(message).toContain('?'); // Question mark indicates friendly tone
      expect(message.toLowerCase()).not.toContain('error');
      expect(message.toLowerCase()).not.toContain('unavailable');
    });

    it('should handle different price formats', () => {
      const product = { name: 'Test Item', price: '€25.99' };
      const message = getAlternativeSuggestionMessage(product);

      expect(message).toContain('Test Item');
      expect(message).toContain('€25.99');
    });
  });
});
