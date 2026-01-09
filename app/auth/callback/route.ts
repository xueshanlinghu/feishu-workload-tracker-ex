/**
 * OAuth回调处理路由
 *
 * 当用户在飞书授权页面同意授权后，飞书会重定向到这个路由
 * URL格式: /auth/callback?code=xxx&state=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, getCurrentUserInfo } from '@/lib/feishu/auth';
import { createUserSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    // 1. 从URL获取授权码和state
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.json(
        { error: '缺少授权码' },
        { status: 400 }
      );
    }

    // TODO: 验证state参数，防止CSRF攻击
    // 在实际应用中，应该在登录时生成state并存储，这里验证是否匹配

    // 2. 用授权码换取用户访问令牌
    console.log('[OAuth] Exchanging code for token...');
    const tokenResponse = await exchangeCodeForToken(code);

    const {
      access_token,
      refresh_token,
      expires_in,
    } = tokenResponse;

    // 3. 获取用户信息
    console.log('[OAuth] Fetching user info...');
    const userInfo = await getCurrentUserInfo(access_token);

    // 4. 创建Session
    console.log('[OAuth] Creating session for user:', userInfo.name);
    await createUserSession({
      userId: userInfo.user_id,
      openId: userInfo.open_id,
      name: userInfo.name,
      email: userInfo.email,
      avatar: userInfo.avatar_url || userInfo.avatar?.avatar_240 || userInfo.avatar?.avatar_origin,
      userAccessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    });

    // 5. 重定向到工作负载记录页面
    return NextResponse.redirect(new URL('/workload', request.url));
  } catch (error) {
    console.error('[OAuth] Callback error:', error);

    // 登录失败，重定向到登录页面并显示错误
    const loginUrl = new URL('/login', request.url);

    // 开发环境显示详细错误，生产环境显示简短提示
    const isDev = process.env.NODE_ENV === 'development';
    const errorMessage = isDev
      ? `登录失败: ${error instanceof Error ? error.message : String(error)}`
      : '登录失败，请重试';

    loginUrl.searchParams.set('error', errorMessage);

    return NextResponse.redirect(loginUrl);
  }
}
