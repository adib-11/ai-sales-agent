import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageConnectionStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Query FacebookPageConnection by user_id
    const connection = await prisma.facebookPageConnection.findUnique({
      where: { user_id: session.user.id },
      select: {
        page_name: true,
      },
    });

    // 3. Return connection status
    const status: PageConnectionStatus = {
      isConnected: !!connection,
      pageName: connection?.page_name,
    };

    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'private, max-age=300', // 5-minute cache
      },
    });
  } catch (error) {
    console.error('Facebook status error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
