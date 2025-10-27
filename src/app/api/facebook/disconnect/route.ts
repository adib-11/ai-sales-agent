import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE() {
  try {
    // 1. Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check if connection exists
    const connection = await prisma.facebookPageConnection.findUnique({
      where: { user_id: session.user.id },
    });

    if (!connection) {
      return NextResponse.json(
        { message: 'No connection found' },
        { status: 404 }
      );
    }

    // 3. Delete the connection
    await prisma.facebookPageConnection.delete({
      where: { user_id: session.user.id },
    });

    // 4. Return success (204 No Content)
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Facebook disconnect error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
