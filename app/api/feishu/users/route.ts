/**
 * 获取企业成员列表API
 *
 * GET /api/feishu/users
 */

import { NextResponse } from 'next/server';
import { getAllCompanyMembers, searchUsers } from '@/lib/feishu/users';
import { isSessionValid } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 检查用户是否已登录
    const valid = await isSessionValid();
    if (!valid) {
      return NextResponse.json(
        { error: '未登录或会话已过期' },
        { status: 401 }
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('search');

    let users;

    if (query) {
      // 如果有搜索关键词，执行搜索
      users = await searchUsers(query);
    } else {
      // 否则返回所有成员
      users = await getAllCompanyMembers();
    }

    // 简化用户数据，只返回必要字段
    // 使用 open_id 作为主ID，因为 Bitable 人员字段使用 open_id
    const simplifiedUsers = users.map((user) => ({
      userId: user.user_id,       // user_id (短格式)
      openId: user.open_id,       // open_id (长格式，用于Bitable查询)
      name: user.name,
      email: user.email,
      avatar: user.avatar?.avatar_240 || user.avatar?.avatar_72,
      employeeId: user.employee_id,
    }));

    return NextResponse.json({
      users: simplifiedUsers,
      total: simplifiedUsers.length,
    });
  } catch (error) {
    console.error('[Users API] Error:', error);
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    );
  }
}
