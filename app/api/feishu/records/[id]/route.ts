/**
 * 单个记录操作API
 *
 * DELETE /api/feishu/records/[id] - 删除记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteRecord } from '@/lib/feishu/bitable';
import { isSessionValid } from '@/lib/session';

/**
 * DELETE - 删除记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 检查用户是否已登录
    const valid = await isSessionValid();
    if (!valid) {
      return NextResponse.json(
        { error: '未登录或会话已过期' },
        { status: 401 }
      );
    }

    const recordId = params.id;

    if (!recordId) {
      return NextResponse.json(
        { error: '缺少记录ID' },
        { status: 400 }
      );
    }

    console.log('[Records API DELETE] Deleting record:', recordId);

    // 删除记录
    await deleteRecord(recordId);

    console.log('[Records API DELETE] Record deleted successfully:', recordId);

    return NextResponse.json({
      success: true,
      message: '记录删除成功',
    });
  } catch (error) {
    console.error('[Records API DELETE] Error:', error);

    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      return NextResponse.json(
        {
          error: '删除记录失败',
          details: {
            message: error.message,
            ...(error as any).response?.data,
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: '删除记录失败' },
      { status: 500 }
    );
  }
}
