/**
 * 获取事项选项API
 *
 * GET /api/feishu/tasks
 */

import { NextResponse } from 'next/server';
import { getTaskOptions } from '@/lib/feishu/bitable';
import { isSessionValid } from '@/lib/session';

export async function GET() {
  try {
    // 检查用户是否已登录
    const valid = await isSessionValid();
    if (!valid) {
      return NextResponse.json(
        { error: '未登录或会话已过期' },
        { status: 401 }
      );
    }

    // 从飞书表格字段配置中获取事项选项
    const tasks = await getTaskOptions();

    return NextResponse.json({
      tasks,
      total: tasks.length,
    });
  } catch (error) {
    console.error('[Tasks API] Error:', error);
    return NextResponse.json(
      { error: '获取事项选项失败' },
      { status: 500 }
    );
  }
}

// 设置缓存：10分钟
export const revalidate = 600;
