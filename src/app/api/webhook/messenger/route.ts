import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, sendMessage } from '@/lib/facebook';
import { generateChatbotResponse } from '@/lib/gemini';
import { decrypt } from '@/lib/encryption';
import { prisma } from '@/lib/db';
import type {
  MessengerWebhookPayload,
  MessengerEvent,
  LoggedMessage,
  ProductContext,
} from '@/lib/types';

// In-memory message log for prototype (TODO: Replace with database or queue)
const messageLog: LoggedMessage[] = [];

/**
 * GET handler for Facebook webhook verification
 * Facebook sends this request when setting up the webhook
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Validate required parameters
  if (!mode || !token || !challenge) {
    console.error('Missing webhook verification parameters');
    return new NextResponse('Missing parameters', { status: 403 });
  }

  // Validate hub.mode
  if (mode !== 'subscribe') {
    console.error(`Invalid hub.mode: ${mode}`);
    return new NextResponse('Invalid mode', { status: 403 });
  }

  // Validate verify token
  const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN;
  if (!expectedToken) {
    console.error('WEBHOOK_VERIFY_TOKEN not configured');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  if (token !== expectedToken) {
    console.error('Invalid verify token');
    return new NextResponse('Invalid verify token', { status: 403 });
  }

  // Return challenge as plain text
  console.log('Webhook verified successfully');
  return new NextResponse(challenge, { status: 200 });
}

/**
 * POST handler for receiving messages from Facebook Messenger
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    // Verify signature
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      console.error('FACEBOOK_APP_SECRET not configured');
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    if (!verifyWebhookSignature(signature, body, appSecret)) {
      console.error('Invalid webhook signature');
      // Still return 200 to prevent Facebook from retrying
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    // Parse webhook payload
    const payload: MessengerWebhookPayload = JSON.parse(body);

    // Validate object type
    if (payload.object !== 'page') {
      console.warn(`Unexpected webhook object type: ${payload.object}`);
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    // Process each entry
    for (const entry of payload.entry) {
      const pageId = entry.id;

      // Process each messaging event
      for (const event of entry.messaging) {
        await processMessagingEvent(event, pageId);
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to Facebook to acknowledge receipt
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}

/**
 * Process a single messaging event
 */
async function processMessagingEvent(
  event: MessengerEvent,
  pageId: string
): Promise<void> {
  const startTime = Date.now();

  // Filter out non-message events (read receipts, delivery confirmations, etc.)
  if (!event.message || !event.message.text) {
    console.log('Skipping non-text message event');
    return;
  }

  const senderId = event.sender.id;
  const messageText = event.message.text;

  // Look up user account associated with this Page ID
  const pageConnection = await prisma.facebookPageConnection.findUnique({
    where: { facebook_page_id: pageId },
    select: { user_id: true, page_access_token: true },
  });

  if (!pageConnection) {
    console.warn(`Received message for unknown Page ID: ${pageId}`);
    return;
  }

  const userId = pageConnection.user_id;

  // Log the message (TODO: Replace with database table or queue in production)
  const loggedMessage: LoggedMessage = {
    timestamp: new Date(),
    userId,
    pageId,
    senderId,
    messageText,
  };

  messageLog.push(loggedMessage);

  console.log('Message logged:', {
    userId,
    pageId,
    senderId,
    messageText: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
  });

  // Chatbot processing (Story 1.6)
  try {
    const dbFetchStart = Date.now();
    
    // Fetch products from database
    const products = await prisma.product.findMany({
      where: { user_id: userId },
      select: { name: true, price: true },
    });

    const dbFetchDuration = Date.now() - dbFetchStart;
    console.log(`DB fetch completed in ${dbFetchDuration}ms - ${products.length} products found`);

    // Convert to ProductContext format
    const productContext: ProductContext[] = products.map(p => ({
      name: p.name,
      price: p.price,
    }));

    // Call Gemini API
    const geminiStart = Date.now();
    const aiResponse = await generateChatbotResponse(productContext, messageText);
    const geminiDuration = Date.now() - geminiStart;
    console.log(`Gemini API completed in ${geminiDuration}ms`);

    // Decrypt Page access token
    const decryptedToken = decrypt(pageConnection.page_access_token);

    // Send reply via Messenger
    const sendStart = Date.now();
    await sendMessage(decryptedToken, senderId, aiResponse);
    const sendDuration = Date.now() - sendStart;
    console.log(`Facebook Send API completed in ${sendDuration}ms`);

    // Log total processing time
    const totalDuration = Date.now() - startTime;
    console.log(`Total chatbot processing time: ${totalDuration}ms`);

    if (totalDuration > 5000) {
      console.warn(`WARNING: Processing exceeded 5 second target (${totalDuration}ms)`);
    }

  } catch (chatbotError) {
    console.error('Chatbot processing error:', chatbotError);
    // Don't throw - we still want to return 200 to Facebook
  }
}
