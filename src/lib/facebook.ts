import { FacebookPage } from './types';
import crypto from 'crypto';

const FACEBOOK_GRAPH_API_VERSION = 'v21.0';
const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}`;

export interface FacebookTokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface FacebookPagesResponse {
  data: FacebookPage[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
  };
}

/**
 * Exchange authorization code for user access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const url = new URL(`${FACEBOOK_GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set('client_id', process.env.FACEBOOK_APP_ID!);
  url.searchParams.set('client_secret', process.env.FACEBOOK_APP_SECRET!);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  const data: FacebookTokenExchangeResponse = await response.json();
  return data.access_token;
}

/**
 * Get user's Facebook Pages
 */
export async function getUserPages(
  userAccessToken: string
): Promise<FacebookPage[]> {
  const url = new URL(`${FACEBOOK_GRAPH_API_BASE}/me/accounts`);
  url.searchParams.set('access_token', userAccessToken);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch user pages: ${error}`);
  }

  const data: FacebookPagesResponse = await response.json();
  return data.data;
}

/**
 * Exchange short-lived token for long-lived token
 */
export async function getLongLivedToken(
  shortLivedToken: string
): Promise<string> {
  const url = new URL(`${FACEBOOK_GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', process.env.FACEBOOK_APP_ID!);
  url.searchParams.set('client_secret', process.env.FACEBOOK_APP_SECRET!);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get long-lived token: ${error}`);
  }

  const data: FacebookTokenExchangeResponse = await response.json();
  return data.access_token;
}

/**
 * Generate random state string for OAuth CSRF protection
 */
export function generateStateToken(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Verify Facebook webhook signature to prevent spoofed requests
 * @param signature - Value from x-hub-signature-256 header (format: sha256=hash)
 * @param body - Raw request body as string
 * @param appSecret - Facebook App Secret
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  signature: string | null | undefined,
  body: string,
  appSecret: string
): boolean {
  if (!signature) return false;

  // Extract hash from "sha256=<hash>" format
  const signatureHash = signature.split('sha256=')[1];
  if (!signatureHash) return false;

  // Compute expected signature
  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(body)
    .digest('hex');

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHash),
      Buffer.from(expectedHash)
    );
  } catch {
    // Buffers must be same length for timingSafeEqual
    return false;
  }
}

/**
 * Send a message to a Facebook Messenger user
 * @param pageAccessToken - Page access token (decrypted)
 * @param recipientId - Customer's PSID (Page-Scoped User ID)
 * @param messageText - Text message to send
 * @throws Error if send fails after retries
 */
export async function sendMessage(
  pageAccessToken: string,
  recipientId: string,
  messageText: string
): Promise<void> {
  const url = `${FACEBOOK_GRAPH_API_BASE}/me/messages`;

  const requestBody = {
    recipient: { id: recipientId },
    message: { text: messageText },
  };

  const maxRetries = 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pageAccessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Facebook Send API error (${response.status}): ${errorText}`);
        
        // Add status to error for later checking
        (error as any).status = response.status;
        
        console.error(`Facebook Send API error (${response.status}):`, errorText);
        throw error;
      }

      const responseData = await response.json();
      console.log('Message sent successfully:', {
        recipientId: responseData.recipient_id,
        messageId: responseData.message_id,
      });
      return;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on 4xx errors (permanent failures)
      if ((error as any).status >= 400 && (error as any).status < 500) {
        console.error(`Send attempt ${attempt + 1}/${maxRetries + 1} failed:`, lastError.message);
        throw lastError;
      }
      
      console.error(`Send attempt ${attempt + 1}/${maxRetries + 1} failed:`, lastError.message);

      // If this wasn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s...
        console.log(`Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  // All retries failed
  throw lastError || new Error('Failed to send message after all retries');
}
