// User type (frontend-safe, no password_hash)
export interface User {
  id: string;
  email: string;
  subdomain: string;
  createdAt: Date;
}

// Product type
export interface Product {
  id: string;
  userId: string;
  name: string;
  price: string;
  imageUrl: string;
  createdAt: Date;
}

// Facebook Page Connection type
export interface FacebookPageConnection {
  id: string;
  userId: string;
  facebookPageId: string;
  pageAccessToken: string; // Encrypted
  pageName: string;
  connectedAt: Date;
}

// Facebook Page from Graph API
export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

// Frontend status type
export interface PageConnectionStatus {
  isConnected: boolean;
  pageName?: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Facebook Webhook Verification Request (GET)
export interface WebhookVerification {
  'hub.mode': string;
  'hub.verify_token': string;
  'hub.challenge': string;
}

// Facebook Messenger Webhook Event (POST)
export interface MessengerWebhookPayload {
  object: 'page';
  entry: MessengerWebhookEntry[];
}

export interface MessengerWebhookEntry {
  id: string; // Page ID
  time: number; // Timestamp
  messaging: MessengerEvent[];
}

export interface MessengerEvent {
  sender: { id: string }; // PSID (Page-Scoped User ID)
  recipient: { id: string }; // Page ID
  timestamp: number;
  message?: {
    mid: string; // Message ID
    text?: string; // Message text (may be undefined for attachments)
  };
  // Other event types (postback, read, delivery) not used in this story
}

// Internal message log structure
export interface LoggedMessage {
  timestamp: Date;
  userId: string; // Internal user account ID
  pageId: string; // Facebook Page ID
  senderId: string; // Customer PSID
  messageText: string;
}

// Gemini API types
export interface GeminiRequest {
  contents: Array<{
    parts: Array<{ text: string }>;
  }>;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
    finishReason?: string;
  }>;
}

// Product context for AI (lightweight)
export interface ProductContext {
  name: string;
  price: string;
}
