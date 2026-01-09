/**
 * 获取当前Session信息的API
 *
 * GET /api/auth/session
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isAuthenticated) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: session.user,
    });
  } catch (error) {
    console.error('[Session API] Error:', error);
    return NextResponse.json(
      { error: '获取会话信息失败' },
      { status: 500 }
    );
  }
}
