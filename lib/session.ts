/**
 * Session管理
 *
 * 使用iron-session实现安全的服务端Session管理
 * Session数据存储在加密的Cookie中
 */

import { SessionOptions, getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { config } from './config';
import { refreshUserToken } from './feishu/auth';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000;
const DEFAULT_REFRESH_TOKEN_TTL_MS = THIRTY_DAYS_SECONDS * 1000;

interface RefreshAttemptResult {
  ok: boolean;
  refreshed: boolean;
  reason?: string;
}

const userRefreshInFlight = new Map<string, Promise<RefreshAttemptResult>>();

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
   * Access Token过期时间（Unix时间戳，毫秒）
   */
  accessTokenExpiresAt?: number;
  /**
   * Refresh Token过期时间（Unix时间戳，毫秒）
   */
  refreshTokenExpiresAt?: number;
  /**
   * 最近一次成功刷新Token的时间（Unix时间戳，毫秒）
   */
  lastTokenRefreshAt?: number;
  /**
   * 旧字段兼容：等价于accessTokenExpiresAt
   */
  expiresAt?: number;
}

export interface SessionValidationResult {
  ok: boolean;
  refreshed: boolean;
  reason?: string;
  user?: SessionData['user'];
  accessTokenExpiresAt?: number;
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
    maxAge: THIRTY_DAYS_SECONDS, // 30天
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
  refreshExpiresIn?: number; // 秒
  refreshTokenExpiresIn?: number; // 秒
}): Promise<void> {
  const session = await getSession();
  const now = Date.now();
  const accessTokenExpiresAt = now + userData.expiresIn * 1000;
  const refreshTokenExpiresAt = resolveRefreshTokenExpiresAt(
    now,
    userData.refreshExpiresIn,
    userData.refreshTokenExpiresIn
  );

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
  session.accessTokenExpiresAt = accessTokenExpiresAt;
  session.refreshTokenExpiresAt = refreshTokenExpiresAt;
  session.lastTokenRefreshAt = now;
  session.expiresAt = accessTokenExpiresAt; // 兼容旧逻辑

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

function getAccessTokenExpiresAt(session: IronSession<SessionData>): number | undefined {
  return session.accessTokenExpiresAt ?? session.expiresAt;
}

function resolveRefreshTokenExpiresAt(
  now: number,
  refreshExpiresIn?: number,
  refreshTokenExpiresIn?: number,
  currentRefreshTokenExpiresAt?: number
): number {
  const ttlSeconds = refreshExpiresIn ?? refreshTokenExpiresIn;

  if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
    return now + ttlSeconds * 1000;
  }

  if (
    typeof currentRefreshTokenExpiresAt === 'number' &&
    currentRefreshTokenExpiresAt > now
  ) {
    return currentRefreshTokenExpiresAt;
  }

  return now + DEFAULT_REFRESH_TOKEN_TTL_MS;
}

async function refreshSessionTokenWithLock(
  session: IronSession<SessionData>
): Promise<RefreshAttemptResult> {
  const userKey = session.user?.userId || session.user?.openId || session.refreshToken;

  if (!userKey) {
    return { ok: false, refreshed: false, reason: 'missing_user_key' };
  }

  const pending = userRefreshInFlight.get(userKey);
  if (pending) {
    return pending;
  }

  const refreshPromise = tryRefreshSessionToken(session).finally(() => {
    userRefreshInFlight.delete(userKey);
  });

  userRefreshInFlight.set(userKey, refreshPromise);
  return refreshPromise;
}

/**
 * 尝试刷新当前Session里的用户令牌
 */
export async function tryRefreshSessionToken(
  session: IronSession<SessionData>
): Promise<RefreshAttemptResult> {
  const now = Date.now();
  const currentAccessTokenExpiresAt = getAccessTokenExpiresAt(session);

  if (!session.refreshToken) {
    return { ok: false, refreshed: false, reason: 'missing_refresh_token' };
  }

  if (
    typeof session.refreshTokenExpiresAt === 'number' &&
    now >= session.refreshTokenExpiresAt
  ) {
    return { ok: false, refreshed: false, reason: 'refresh_token_expired' };
  }

  try {
    const tokenResponse = await refreshUserToken(session.refreshToken);

    if (!tokenResponse.access_token || !tokenResponse.expires_in) {
      return { ok: false, refreshed: false, reason: 'invalid_refresh_response' };
    }

    const refreshedAt = Date.now();
    const nextAccessTokenExpiresAt = refreshedAt + tokenResponse.expires_in * 1000;

    session.userAccessToken = tokenResponse.access_token;
    if (tokenResponse.refresh_token) {
      session.refreshToken = tokenResponse.refresh_token;
    }
    session.accessTokenExpiresAt = nextAccessTokenExpiresAt;
    session.refreshTokenExpiresAt = resolveRefreshTokenExpiresAt(
      refreshedAt,
      tokenResponse.refresh_expires_in,
      tokenResponse.refresh_token_expires_in,
      session.refreshTokenExpiresAt
    );
    session.lastTokenRefreshAt = refreshedAt;
    session.expiresAt = nextAccessTokenExpiresAt; // 兼容旧逻辑

    await session.save();

    console.log(
      `[AuthRefresh] Refreshed access token for user ${session.user?.name || 'unknown'}`
    );

    return { ok: true, refreshed: true };
  } catch (error) {
    if (currentAccessTokenExpiresAt && currentAccessTokenExpiresAt > now) {
      console.warn(
        `[AuthRefresh] Refresh failed but current token is still valid for user ${session.user?.name || 'unknown'}`
      );
      return {
        ok: true,
        refreshed: false,
        reason: 'refresh_failed_but_access_token_still_valid',
      };
    }

    console.error('[AuthRefresh] Refresh failed and access token already expired:', error);
    return { ok: false, refreshed: false, reason: 'refresh_failed' };
  }
}

/**
 * 校验Session并在需要时自动刷新用户令牌
 */
export async function ensureValidSessionWithAutoRefresh(): Promise<SessionValidationResult> {
  const session = await getSession();

  if (!session.isAuthenticated || !session.user || !session.userAccessToken) {
    return { ok: false, refreshed: false, reason: 'unauthenticated' };
  }

  const accessTokenExpiresAt = getAccessTokenExpiresAt(session);
  if (!accessTokenExpiresAt) {
    return { ok: false, refreshed: false, reason: 'missing_access_token_expiry' };
  }

  const now = Date.now();

  if (
    typeof session.refreshTokenExpiresAt === 'number' &&
    now >= session.refreshTokenExpiresAt
  ) {
    return { ok: false, refreshed: false, reason: 'refresh_token_expired' };
  }

  // Access Token足够新鲜，直接放行
  if (accessTokenExpiresAt > now + ACCESS_TOKEN_REFRESH_BUFFER_MS) {
    return {
      ok: true,
      refreshed: false,
      user: session.user,
      accessTokenExpiresAt,
    };
  }

  const refreshResult = await refreshSessionTokenWithLock(session);

  if (!refreshResult.ok) {
    return {
      ok: false,
      refreshed: false,
      reason: refreshResult.reason,
    };
  }

  return {
    ok: true,
    refreshed: refreshResult.refreshed,
    reason: refreshResult.reason,
    user: session.user,
    accessTokenExpiresAt: getAccessTokenExpiresAt(session),
  };
}

/**
 * 检查Session是否有效
 *
 * @returns 是否有效
 */
export async function isSessionValid(): Promise<boolean> {
  const validation = await ensureValidSessionWithAutoRefresh();

  if (!validation.ok) {
    console.log('[Session] Session invalid:', validation.reason || 'unknown');
  }

  return validation.ok;
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
