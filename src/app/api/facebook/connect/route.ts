import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateStateToken } from '@/lib/facebook';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate environment variables
    if (!process.env.FACEBOOK_APP_ID) {
      console.error('FACEBOOK_APP_ID is not configured');
      return NextResponse.json(
        { message: 'Facebook integration not configured' },
        { status: 500 }
      );
    }

    // 3. Generate state token for CSRF protection
    const state = generateStateToken();
    
    // Store state in cookie for validation in callback
  const cookieStore = cookies();
    cookieStore.set('facebook_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // 4. Build Facebook OAuth URL
  const baseUrl = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/facebook/callback`;
    const facebookAuthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    facebookAuthUrl.searchParams.set('client_id', process.env.FACEBOOK_APP_ID);
    facebookAuthUrl.searchParams.set('redirect_uri', redirectUri);
    facebookAuthUrl.searchParams.set(
      'scope',
      'pages_messaging,pages_manage_metadata'
    );
    facebookAuthUrl.searchParams.set('state', state);

    // 5. Redirect to Facebook
    return NextResponse.redirect(facebookAuthUrl.toString());
  } catch (error) {
    console.error('Facebook OAuth initiation error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
