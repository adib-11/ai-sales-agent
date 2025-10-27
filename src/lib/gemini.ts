import type { GeminiRequest, GeminiResponse, ProductContext } from './types';

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
const GEMINI_TIMEOUT_MS = 5000; // 5 seconds max per NFR5

/**
 * Generate chatbot response using Gemini API
 * @param products - User's product catalog
 * @param customerMessage - Customer's question
 * @returns AI-generated response text
 * @throws Error if API call fails or times out
 */
export async function generateChatbotResponse(
  products: ProductContext[],
  customerMessage: string
): Promise<string> {
  // Validate API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  // Validate inputs
  if (!customerMessage || customerMessage.trim().length === 0) {
    throw new Error('Customer message cannot be empty');
  }

  // Construct prompt
  const prompt = constructPrompt(products, customerMessage);

  // Build request payload
  const requestBody: GeminiRequest = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  // Make API call with timeout
  try {
    console.log('Calling Gemini API...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    const response = await fetch(GEMINI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data: GeminiResponse = await response.json();
    
    // Extract response text
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No candidates returned from Gemini API');
    }

    const responseText = data.candidates[0]?.content?.parts[0]?.text;
    if (!responseText) {
      throw new Error('No text content in Gemini API response');
    }

    console.log('Gemini API response received:', responseText.substring(0, 100) + '...');
    return responseText;

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Gemini API timeout after', GEMINI_TIMEOUT_MS, 'ms');
        throw new Error(`Gemini API request timed out after ${GEMINI_TIMEOUT_MS}ms`);
      }
      console.error('Gemini API call failed:', error.message);
      throw error;
    }
    throw new Error('Unknown error calling Gemini API');
  }
}

/**
 * Construct prompt with system role, product catalog, and customer message
 */
function constructPrompt(products: ProductContext[], customerMessage: string): string {
  // System role
  let prompt = `You are a helpful sales assistant for a small business. Answer customer questions based ONLY on the following product catalog. If asked about products not in the catalog, politely state they are not available.

Product Catalog:
`;

  // Add products
  if (products.length === 0) {
    prompt += '(No products available at this time)\n\n';
  } else {
    products.forEach(product => {
      prompt += `- Product Name: ${product.name}, Price: ${product.price}\n`;
    });
    prompt += '\n';
  }

  // Add customer question
  prompt += `Customer Question:
${customerMessage}

Instructions:
- Answer concisely and helpfully
- Only reference products from the catalog above
- **FALLBACK RULE 1**: If the question is completely unrelated to products (e.g., business hours, shipping, returns, location), respond EXACTLY with the word: OUT_OF_SCOPE
- **FALLBACK RULE 2**: If the customer asks about a product variant not in the catalog (e.g., different color/size), start your response with: ALTERNATIVE: [Product Name] (where [Product Name] is the closest match from the catalog)
- For normal product questions, answer naturally without special signals
`;

  return prompt;
}
