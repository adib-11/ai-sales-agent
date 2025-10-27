import type { ProductContext, ParsedResponse } from './types';

/**
 * Get predefined out-of-scope message
 * Used when customer asks about non-product topics (shipping, returns, hours, etc.)
 * @returns User-friendly message directing customer to contact shop owner
 */
export function getOutOfScopeMessage(): string {
  return "I can only answer questions about our products. For other inquiries, please contact the shop owner directly.";
}

/**
 * Get alternative suggestion message for near-miss product queries
 * Used when customer asks about product variant not in catalog
 * @param product - Closest matching product from catalog
 * @returns Friendly message suggesting the alternative product
 */
export function getAlternativeSuggestionMessage(product: ProductContext): string {
  return `I don't have that exact item, but we have ${product.name} for ${product.price}. Would that work for you?`;
}

/**
 * Parse Gemini API response for fallback signals
 * Detects OUT_OF_SCOPE and ALTERNATIVE: signals from AI response
 * @param aiResponse - Raw response text from Gemini API
 * @param products - Product catalog for matching alternative suggestions
 * @returns Parsed response with fallback type and appropriate message
 * @throws Error if aiResponse is empty or null
 */
export function parseGeminiResponse(
  aiResponse: string,
  products: ProductContext[]
): ParsedResponse {
  // Validate input
  if (!aiResponse || aiResponse.trim().length === 0) {
    throw new Error('AI response cannot be empty');
  }

  const trimmedResponse = aiResponse.trim();

  // Check for OUT_OF_SCOPE signal
  if (trimmedResponse.startsWith('OUT_OF_SCOPE')) {
    return {
      type: 'out-of-scope',
      text: getOutOfScopeMessage(),
    };
  }

  // Check for ALTERNATIVE signal
  if (trimmedResponse.startsWith('ALTERNATIVE:')) {
    // Extract product name after "ALTERNATIVE:"
    const productNameMatch = trimmedResponse.match(/^ALTERNATIVE:\s*(.+)/);
    
    if (productNameMatch && productNameMatch[1]) {
      const suggestedProductName = productNameMatch[1].trim();
      
      // Find product in catalog
      const product = products.find(p => p.name === suggestedProductName);
      
      if (product) {
        return {
          type: 'alternative',
          text: getAlternativeSuggestionMessage(product),
          suggestedProduct: suggestedProductName,
        };
      }
    }
    
    // If product not found or malformed, fallback to normal response
    console.warn('ALTERNATIVE signal detected but product not found or malformed, using normal response');
  }

  // Normal response (no signals detected)
  return {
    type: 'normal',
    text: trimmedResponse,
  };
}
