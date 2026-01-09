/**
 * 飞书OAuth认证和Token管理
 *
 * 这个文件处理：
 * 1. OAuth 2.0授权流程
 * 2. 用户访问令牌(user_access_token)管理
 * 3. 租户访问令牌(tenant_access_token)管理和缓存
 * 4. Token刷新机制
 */

import { feishuClient } from './client';
import { config } from '../config';
import {
  TenantAccessTokenResponse,
  UserAccessTokenResponse,
  FeishuUser,
} from '@/types/feishu';

/**
 * Token缓存
 * 在生产环境中，建议使用Redis等持久化缓存
 */
interface TokenCache {
  token: string;
  expiresAt: number; // Unix时间戳（毫秒）
}

let tenantTokenCache: TokenCache | null = null;

/**
 * 生成飞书OAuth授权URL
 *
 * @param state - 随机字符串，用于防止CSRF攻击
 * @returns OAuth授权URL
 */
export function generateOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    app_id: config.feishu.appId,
    redirect_uri: config.feishu.redirectUri,
    state,
  });

  // 飞书OAuth授权URL
  return `${config.feishu.apiBaseUrl}/open-apis/authen/v1/authorize?${params.toString()}`;
}

/**
 * 用授权码换取用户访问令牌
 *
 * OAuth回调后调用此方法获取用户token
 *
 * @param code - 授权码（从回调URL获取）
 * @returns 用户访问令牌信息
 */
export async function exchangeCodeForToken(
  code: string
): Promise<UserAccessTokenResponse> {
  try {
    // 先获取tenant_access_token（企业自建应用需要用tenant token来交换user token）
    const tenantToken = await getTenantAccessToken();

    console.log('[OAuth] Using tenant token to exchange user token');
    console.log('[OAuth] Request params:', {
      grant_type: 'authorization_code',
      code: code.substring(0, 10) + '...',
    });

    // 使用标准的access_token端点（不是OIDC）
    const response = await feishuClient.post<UserAccessTokenResponse>(
      '/open-apis/authen/v1/access_token',
      {
        grant_type: 'authorization_code',
        code,
      },
      {
        headers: {
          Authorization: `Bearer ${tenantToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[OAuth] Successfully exchanged code for user token');
    return response;
  } catch (error) {
    console.error('Failed to exchange code for token:', error);
    throw new Error('OAuth令牌交换失败');
  }
}

/**
 * 获取租户访问令牌（Tenant Access Token）
 *
 * 租户访问令牌用于调用企业级API（如获取通讯录、操作Bitable等）
 * 有效期2小时，这里实现了缓存机制
 *
 * @returns 租户访问令牌
 */
export async function getTenantAccessToken(): Promise<string> {
  const now = Date.now();

  // 检查缓存是否有效（提前5分钟刷新）
  if (tenantTokenCache && tenantTokenCache.expiresAt > now + 5 * 60 * 1000) {
    return tenantTokenCache.token;
  }

  try {
    // 调用飞书API获取新token
    const response = await feishuClient.post<TenantAccessTokenResponse>(
      '/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: config.feishu.appId,
        app_secret: config.feishu.appSecret,
      }
    );

    const { tenant_access_token, expire } = response;

    // 缓存token（expire是秒数）
    tenantTokenCache = {
      token: tenant_access_token,
      expiresAt: now + expire * 1000,
    };

    console.log('[Token] Tenant access token refreshed, expires in', expire, 'seconds');

    return tenant_access_token;
  } catch (error) {
    console.error('Failed to get tenant access token:', error);
    throw new Error('获取租户访问令牌失败');
  }
}

/**
 * 刷新用户访问令牌
 *
 * 当用户访问令牌过期时，使用refresh_token获取新的访问令牌
 *
 * @param refreshToken - 刷新令牌
 * @returns 新的用户访问令牌信息
 */
export async function refreshUserToken(
  refreshToken: string
): Promise<UserAccessTokenResponse> {
  try {
    const response = await feishuClient.post<UserAccessTokenResponse>(
      '/open-apis/authen/v1/oidc/refresh_access_token',
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${config.feishu.appId}:${config.feishu.appSecret}`
          ).toString('base64')}`,
        },
      }
    );

    return response;
  } catch (error) {
    console.error('Failed to refresh user token:', error);
    throw new Error('刷新用户令牌失败');
  }
}

/**
 * 获取当前登录用户信息
 *
 * @param userAccessToken - 用户访问令牌
 * @returns 用户信息
 */
export async function getCurrentUserInfo(
  userAccessToken: string
): Promise<FeishuUser> {
  try {
    const client = feishuClient.withAuth(userAccessToken);
    const response = await client.get<any>(
      '/open-apis/authen/v1/user_info'
    );

    console.log('[User Info] Raw response:', JSON.stringify(response, null, 2));

    // 飞书用户信息API的响应格式可能是 { user: {...} } 或直接是用户对象
    const userInfo = response.user || response;

    if (!userInfo || !userInfo.user_id) {
      throw new Error('无效的用户信息响应: ' + JSON.stringify(response));
    }

    return userInfo;
  } catch (error) {
    console.error('Failed to get user info:', error);
    throw new Error('获取用户信息失败');
  }
}

/**
 * 验证Token是否有效
 *
 * @param token - 访问令牌
 * @returns 是否有效
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    await feishuClient.withAuth(token).get('/open-apis/authen/v1/user_info');
    return true;
  } catch (error) {
    return false;
  }
}
