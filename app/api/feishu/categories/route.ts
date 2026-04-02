/**
 * 三级分类字典API
 *
 * GET /api/feishu/categories?level=types
 * GET /api/feishu/categories?level=contents&typeRecordId=recxxx
 * GET /api/feishu/categories?level=details&contentRecordId=recxxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { isSessionValid } from '@/lib/session';
import {
  getContentCategoryOptions,
  getDetailCategoryOptions,
  getTypeCategoryOptions,
} from '@/lib/feishu/workload';

export const dynamic = 'force-dynamic';

/**
 * 获取三级分类选项
 */
export async function GET(request: NextRequest) {
  try {
    const valid = await isSessionValid();
    if (!valid) {
      return NextResponse.json(
        { error: '未登录或会话已过期' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const level = searchParams.get('level');

    if (level === 'types') {
      const items = await getTypeCategoryOptions();
      return NextResponse.json({
        items,
        total: items.length,
      });
    }

    if (level === 'contents') {
      const typeRecordId = searchParams.get('typeRecordId');
      if (!typeRecordId) {
        return NextResponse.json(
          { error: '缺少必要参数: typeRecordId' },
          { status: 400 }
        );
      }

      const contentResponse = await getContentCategoryOptions(typeRecordId);
      return NextResponse.json({
        items: contentResponse.items,
        total: contentResponse.items.length,
        requiresContent: contentResponse.requiresContent,
      });
    }

    if (level === 'details') {
      const contentRecordId = searchParams.get('contentRecordId');
      if (!contentRecordId) {
        return NextResponse.json(
          { error: '缺少必要参数: contentRecordId' },
          { status: 400 }
        );
      }

      const detailResponse = await getDetailCategoryOptions(contentRecordId);
      return NextResponse.json({
        items: detailResponse.items,
        total: detailResponse.items.length,
        requiresDetail: detailResponse.requiresDetail,
      });
    }

    return NextResponse.json(
      { error: '不支持的 level 参数' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Categories API] Error:', error);
    return NextResponse.json(
      { error: '获取分类选项失败' },
      { status: 500 }
    );
  }
}
