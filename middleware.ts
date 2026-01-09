/**
 * Next.js中间件
 *
 * 保护需要认证的路由
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 需要认证的路由前缀
const protectedPaths = ['/workload', '/api/feishu'];

// 公开路由
const publicPaths = ['/login', '/auth/callback', '/api/auth/feishu/authorize'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查是否是需要保护的路由
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  // 如果是公开路由，直接放行
  const isPublicPath = publicPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 如果是受保护的路由，检查Session
  if (isProtectedPath) {
    // 获取Session Cookie
    const sessionCookie = request.cookies.get('feishu_workload_session');

    if (!sessionCookie) {
      // 未登录，重定向到登录页
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // 有Session Cookie，继续（详细验证在API路由中进行）
    return NextResponse.next();
  }

  return NextResponse.next();
}

// 配置matcher，指定中间件应用的路由
export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (网站图标)
     * - public文件夹中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
