/**
 * Session管理
 *
 * 使用iron-session实现安全的服务端Session管理
 * Session数据存储在加密的Cookie中
 */

import { SessionOptions, getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { config } from './config';

/**
 * Session数据结构
 */
export interface SessionData {
  /**
   * 是否已认证
   */
  isAuthenticated: boolean;
  /**
   * 用户信息
   */
  user?: {
    userId: string;      // user_id
    openId: string;      // open_id (用于飞书表格人员字段)
    name: string;
    email?: string;
    avatar?: string;
  };
  /**
   * 用户访问令牌
   */
  userAccessToken?: string;
  /**
   * 刷新令牌
   */
  refreshToken?: string;
  /**
   * Token过期时间（Unix时间戳，毫秒）
   */
  expiresAt?: number;
}

/**
 * Session配置
 */
const sessionOptions: SessionOptions = {
  password: config.app.sessionSecret,
  cookieName: 'feishu_workload_session',
  cookieOptions: {
    secure: config.app.nodeEnv === 'production', // 生产环境使用HTTPS
    httpOnly: true, // 防止XSS攻击
    sameSite: 'lax', // CSRF保护
    maxAge: 60 * 60 * 24 * 30, // 30天
    path: '/',
  },
};

/**
 * 获取当前Session
 *
 * 在Next.js App Router中使用
 *
 * @returns Session对象
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * 创建用户Session
 *
 * @param userData - 用户数据
 */
export async function createUserSession(userData: {
  userId: string;
  openId: string;
  name: string;
  email?: string;
  avatar?: string;
  userAccessToken: string;
  refreshToken: string;
  expiresIn: number; // 秒
}): Promise<void> {
  const session = await getSession();

  session.isAuthenticated = true;
  session.user = {
    userId: userData.userId,
    openId: userData.openId,
    name: userData.name,
    email: userData.email,
    avatar: userData.avatar,
  };
  session.userAccessToken = userData.userAccessToken;
  session.refreshToken = userData.refreshToken;
  session.expiresAt = Date.now() + userData.expiresIn * 1000;

  await session.save();

  console.log(`[Session] Created session for user ${userData.name} (user_id: ${userData.userId}, open_id: ${userData.openId})`);
}

/**
 * 销毁Session（登出）
 */
export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
  console.log('[Session] Session destroyed');
}

/**
 * 检查Session是否有效
 *
 * @returns 是否有效
 */
export async function isSessionValid(): Promise<boolean> {
  const session = await getSession();

  if (!session.isAuthenticated || !session.expiresAt) {
    return false;
  }

  // 检查Token是否过期
  if (Date.now() > session.expiresAt) {
    console.log('[Session] Session expired');
    return false;
  }

  return true;
}

/**
 * 获取当前登录用户信息
 *
 * @returns 用户信息或null
 */
export async function getCurrentUser(): Promise<SessionData['user'] | null> {
  const session = await getSession();

  if (!session.isAuthenticated) {
    return null;
  }

  return session.user || null;
}
