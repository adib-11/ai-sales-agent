import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  exchangeCodeForToken,
  getUserPages,
} from '@/lib/facebook';
import { encrypt } from '@/lib/encryption';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/chatbot?error=unauthorized`
      );
    }

    // 2. Verify state parameter (CSRF protection)
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle user denial
    if (error === 'access_denied') {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/chatbot?error=user_denied`
      );
    }

    const cookieStore = await cookies();
    const savedState = cookieStore.get('facebook_oauth_state')?.value;

    if (!state || !savedState || state !== savedState) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/chatbot?error=invalid_state`
      );
    }

    // Clear state cookie
    cookieStore.delete('facebook_oauth_state');

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/chatbot?error=no_code`
      );
    }

    // 3. Exchange code for user access token
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/facebook/callback`;
    const userAccessToken = await exchangeCodeForToken(code, redirectUri);

    // 4. Fetch user's Pages
    const pages = await getUserPages(userAccessToken);

    if (pages.length === 0) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/chatbot?error=no_pages`
      );
    }

    // 5. For simplicity, use the first page (or could prompt user to select)
    // In production, you might want to show a page selector if multiple pages exist
    const selectedPage = pages[0];

    // 6. Get long-lived Page access token
    // Note: Page tokens from /me/accounts are already long-lived
    const pageAccessToken = selectedPage.access_token;

    // 7. Encrypt the page access token
    const encryptedToken = encrypt(pageAccessToken);

    // 8. Create/update FacebookPageConnection record
    await prisma.facebookPageConnection.upsert({
      where: { user_id: session.user.id },
      update: {
        facebook_page_id: selectedPage.id,
        page_access_token: encryptedToken,
        page_name: selectedPage.name,
        connected_at: new Date(),
      },
      create: {
        user_id: session.user.id,
        facebook_page_id: selectedPage.id,
        page_access_token: encryptedToken,
        page_name: selectedPage.name,
      },
    });

    // 9. Redirect to dashboard with success message
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/chatbot?success=true`
    );
  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/chatbot?error=oauth_failed`
    );
  }
}
