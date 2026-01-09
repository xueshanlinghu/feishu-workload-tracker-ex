/**
 * 登出API
 *
 * POST /api/auth/logout
 */

import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';

export async function POST() {
  try {
    await destroySession();

    return NextResponse.json({
      success: true,
      message: '已成功登出',
    });
  } catch (error) {
    console.error('[Logout API] Error:', error);
    return NextResponse.json(
      { error: '登出失败' },
      { status: 500 }
    );
  }
}
