/**
 * 刷新当前会话Token
 *
 * POST /api/auth/refresh
 */

import { NextResponse } from 'next/server';
import { ensureValidSessionWithAutoRefresh } from '@/lib/session';

export async function POST() {
  try {
    const validation = await ensureValidSessionWithAutoRefresh();

    if (!validation.ok) {
      return NextResponse.json(
        {
          authenticated: false,
          error: '会话已失效，请重新登录',
          reason: validation.reason,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      refreshed: validation.refreshed,
      accessTokenExpiresAt: validation.accessTokenExpiresAt,
    });
  } catch (error) {
    console.error('[Auth Refresh API] Error:', error);
    return NextResponse.json(
      { error: '刷新会话失败' },
      { status: 500 }
    );
  }
}
