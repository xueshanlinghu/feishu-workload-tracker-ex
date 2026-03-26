/**
 * 飞书用户和通讯录 API操作
 *
 * 这个文件实现了获取企业成员信息的功能：
 * 1. 获取部门用户列表
 * 2. 获取单个用户信息
 * 3. 搜索用户
 * 4. 获取所有企业成员
 */

import { feishuClient } from './client';
import { getTenantAccessToken } from './auth';
import { FeishuUser } from '@/types/feishu';
import { config } from '@/lib/config';

interface DepartmentUserSummary {
  user_id: string;
  open_id: string;
  union_id?: string;
  name?: string;
  en_name?: string;
  email?: string;
  avatar?: FeishuUser['avatar'];
  employee_id?: string;
}

interface BasicUserProfile {
  user_id: string;
  name: string;
  i18n_name?: {
    zh_cn?: string;
    ja_jp?: string;
    en_us?: string;
  };
}

const BASIC_USER_BATCH_SIZE = 10;

/**
 * 将数组按固定大小分块
 *
 * 飞书 basic_batch 接口单次最多支持 10 个 user_ids，
 * 这里统一做分块，避免调用方重复处理。
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

/**
 * 批量获取用户姓名
 *
 * 先通过部门接口拿到 open_id，再通过 basic_batch 批量补齐真实姓名。
 * 这个接口单次最多支持 10 个 user_ids，因此内部会自动分批请求。
 *
 * @param userIds - 用户ID列表
 * @param userIdType - 用户ID类型
 * @returns 以 user_id 为键的基础用户信息映射
 */
async function getUsersBasicProfiles(
  userIds: string[],
  userIdType: 'open_id' | 'union_id' | 'user_id' = 'open_id'
): Promise<Map<string, BasicUserProfile>> {
  const profileMap = new Map<string, BasicUserProfile>();

  if (userIds.length === 0) {
    return profileMap;
  }

  try {
    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);
    const batches = chunkArray(userIds, BASIC_USER_BATCH_SIZE);

    for (const batch of batches) {
      const url = `/open-apis/contact/v3/users/basic_batch?user_id_type=${userIdType}`;
      const response = await client.post<{ users?: BasicUserProfile[] }>(url, {
        user_ids: batch,
      });

      const users = response.users || [];

      users.forEach((user) => {
        if (user.user_id && user.name) {
          profileMap.set(user.user_id, user);
        }
      });
    }

    console.log(
      `[Contact API] basic_batch resolved ${profileMap.size} names for ${userIds.length} users`
    );

    return profileMap;
  } catch (error) {
    console.error('Failed to get user basic profiles:', error);
    throw new Error('批量获取用户姓名失败');
  }
}

/**
 * 获取部门用户列表
 *
 * 使用 find_by_department 端点，这个端点专门用于获取指定部门的成员
 * 需要配置 FEISHU_DEPARTMENT_ID 环境变量（open_department_id格式）
 *
 * @param departmentId - 部门ID（open_department_id格式，如 od-xxx）
 * @param pageSize - 分页大小
 * @param pageToken - 分页标记
 * @returns 用户列表
 */
export async function getDepartmentUsers(
  departmentId: string,
  pageSize: number = 50,
  pageToken?: string
): Promise<{
  has_more: boolean;
  page_token?: string;
  items: DepartmentUserSummary[];
}> {
  try {
    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);

    // 构建查询参数
    // 使用 open_id 作为用户ID类型，因为 Bitable 人员字段使用 open_id
    const params: Record<string, string> = {
      department_id: departmentId,
      department_id_type: 'open_department_id',
      user_id_type: 'open_id',
      page_size: pageSize.toString(),
    };

    if (pageToken) {
      params.page_token = pageToken;
    }

    const queryString = new URLSearchParams(params).toString();
    // 使用 find_by_department 端点
    const url = `/open-apis/contact/v3/users/find_by_department?${queryString}`;

    console.log('[Contact API] Fetching users with URL:', url);
    console.log('[Contact API] Params:', params);

    const response = await client.get<{
      has_more: boolean;
      page_token?: string;
      items: DepartmentUserSummary[];
    }>(url);

    console.log('[Contact API] Full response:', JSON.stringify(response, null, 2));
    console.log('[Contact API] Got', response.items?.length || 0, 'users');

    // 如果items不存在，返回空数组
    if (!response.items) {
      console.warn('[Contact API] Response has no items field, returning empty array');
      return {
        has_more: response.has_more || false,
        page_token: response.page_token,
        items: [],
      };
    }

    return response;
  } catch (error) {
    console.error('Failed to get department users:', error);
    throw new Error('获取部门用户列表失败');
  }
}

/**
 * 获取单个用户信息
 *
 * @param userId - 用户ID
 * @returns 用户信息
 */
export async function getUserInfo(userId: string): Promise<FeishuUser> {
  try {
    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);

    const url = `/open-apis/contact/v3/users/${userId}`;

    const response = await client.get<{ user: FeishuUser }>(url);

    return response.user;
  } catch (error) {
    console.error('Failed to get user info:', error);
    throw new Error('获取用户信息失败');
  }
}

/**
 * 获取所有企业成员
 *
 * 从配置的部门中获取成员列表
 * 需要在 .env 中配置 FEISHU_DEPARTMENT_ID（open_department_id格式）
 *
 * @returns 所有用户列表
 */
export async function getAllCompanyMembers(): Promise<FeishuUser[]> {
  try {
    const allUsers: DepartmentUserSummary[] = [];
    const departmentId = config.feishu.departmentId;

    if (!departmentId) {
      console.error('[Users] FEISHU_DEPARTMENT_ID not configured');
      throw new Error('未配置部门ID，请在.env中设置 FEISHU_DEPARTMENT_ID');
    }

    console.log('[Users] Fetching users from department:', departmentId);

    let hasMore = true;
    let pageToken: string | undefined;
    let pageCount = 0;

    while (hasMore && pageCount < 10) {
      // 最多10页，防止无限循环
      // find_by_department API 的 page_size 最大支持 50
      const response = await getDepartmentUsers(departmentId, 50, pageToken);

      // 防御性检查：确保 response.items 存在且是数组
      if (!response || !response.items || !Array.isArray(response.items)) {
        console.warn('[Users] Invalid response, stopping pagination');
        break;
      }

      if (response.items.length > 0) {
        allUsers.push(...response.items);
        console.log(`[Users] Page ${pageCount + 1}: fetched ${response.items.length} users`);
      }

      hasMore = response.has_more;
      pageToken = response.page_token;
      pageCount++;

      // 避免请求过快，稍微延迟
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // 去重（以open_id为key，因为我们使用open_id）
    const uniqueUsers = Array.from(
      new Map(allUsers.map((user) => [user.open_id, user])).values()
    );

    const basicProfiles = await getUsersBasicProfiles(
      uniqueUsers.map((user) => user.open_id),
      'open_id'
    );

    const usersWithNames = uniqueUsers.map((user) => {
      const basicProfile = basicProfiles.get(user.open_id);

      return {
        ...user,
        name: basicProfile?.name || user.name || '',
      };
    });

    const missingNames = usersWithNames.filter((user) => !user.name).map((user) => user.open_id);

    if (missingNames.length > 0) {
      console.error('[Users] Missing names for open_ids:', missingNames);
      throw new Error('存在未能获取姓名的成员，请检查通讯录基础信息权限');
    }

    console.log(`[Users] Successfully fetched ${usersWithNames.length} unique company members`);

    return usersWithNames;
  } catch (error) {
    console.error('Failed to get all company members:', error);
    throw new Error('获取企业成员列表失败');
  }
}

/**
 * 搜索用户（简单实现）
 *
 * 先获取所有用户，然后在客户端进行搜索
 * 在生产环境中，如果用户量很大，建议使用飞书的搜索API
 *
 * @param query - 搜索关键词（姓名或邮箱）
 * @returns 匹配的用户列表
 */
export async function searchUsers(query: string): Promise<FeishuUser[]> {
  try {
    const allUsers = await getAllCompanyMembers();

    // 简单的模糊匹配
    const queryLower = query.toLowerCase();

    const filteredUsers = allUsers.filter((user) => {
      const nameLower = user.name?.toLowerCase() || '';
      const emailLower = user.email?.toLowerCase() || '';
      const enNameLower = user.en_name?.toLowerCase() || '';

      return (
        nameLower.includes(queryLower) ||
        emailLower.includes(queryLower) ||
        enNameLower.includes(queryLower)
      );
    });

    return filteredUsers;
  } catch (error) {
    console.error('Failed to search users:', error);
    throw new Error('搜索用户失败');
  }
}
