/**
 * 生成飞书OAuth授权URL的API
 *
 * GET /api/auth/feishu/authorize
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateOAuthUrl } from '@/lib/feishu/auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get('state') || '';

    const oauthUrl = generateOAuthUrl(state);

    // 重定向到飞书OAuth页面
    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    console.error('[Authorize API] Error:', error);
    return NextResponse.json(
      { error: '生成授权URL失败' },
      { status: 500 }
    );
  }
}
