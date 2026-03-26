/**
 * 工作负载记录API
 *
 * GET /api/feishu/records - 查询记录
 * POST /api/feishu/records - 创建记录
 * PATCH /api/feishu/records - 更新记录
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createRecords,
  getRecord,
  queryRecordsByDateAndPerson,
  updateRecord,
} from '@/lib/feishu/bitable';
import {
  getFormattedWorkloadRecordsByDateAndPerson,
  parseWorkloadValue,
  resolveCategorySelection,
} from '@/lib/feishu/workload';
import { getCurrentUser, isSessionValid } from '@/lib/session';
import { BitableRecord, SubmitWorkloadData } from '@/types/feishu';

/**
 * 从飞书人员字段中提取 open_id
 */
function extractPersonId(value: unknown): string | null {
  if (Array.isArray(value)) {
    const firstPerson = value.find(
      (item) => item && typeof item === 'object' && 'id' in item
    ) as { id?: string } | undefined;

    return firstPerson?.id || null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
}

/**
 * 将飞书时间戳转换成 YYYY-MM-DD
 *
 * 飞书日期字段返回的是本地日期零点时间戳，需要减去时区偏移后再转为字符串。
 */
function formatRecordDate(recordDate: number): string {
  const dateObj = new Date(recordDate);
  const timezoneOffset = dateObj.getTimezoneOffset() * 60 * 1000;
  const localTimestamp = recordDate - timezoneOffset;
  return new Date(localTimestamp).toISOString().split('T')[0];
}

/**
 * GET - 查询记录
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
    const date = searchParams.get('date');
    const personId = searchParams.get('person');

    if (!date || !personId) {
      return NextResponse.json(
        { error: '缺少必要参数: date 和 person' },
        { status: 400 }
      );
    }

    const records = await getFormattedWorkloadRecordsByDateAndPerson(date, personId);
    const totalWorkload = records.reduce((sum, record) => sum + record.workload, 0);

    return NextResponse.json({
      records,
      total: totalWorkload,
      count: records.length,
    });
  } catch (error) {
    console.error('[Records API GET] Error:', error);
    return NextResponse.json(
      { error: '查询记录失败' },
      { status: 500 }
    );
  }
}

/**
 * POST - 创建记录
 */
export async function POST(request: NextRequest) {
  try {
    const valid = await isSessionValid();
    if (!valid) {
      return NextResponse.json(
        { error: '未登录或会话已过期' },
        { status: 401 }
      );
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: '无法获取当前用户信息' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as SubmitWorkloadData;
    const { date, personId, records } = body;

    if (!date || !personId || !records || !Array.isArray(records)) {
      return NextResponse.json(
        { error: '请求参数不正确' },
        { status: 400 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json(
        { error: '至少需要一条记录' },
        { status: 400 }
      );
    }

    const invalidWorkload = records.some(
      (record) => typeof record.workload !== 'number' || record.workload <= 0 || record.workload > 1
    );
    if (invalidWorkload) {
      return NextResponse.json(
        { error: '人力占用值必须在 0-1 之间，且不能为 0' },
        { status: 400 }
      );
    }

    const existingRecords = await queryRecordsByDateAndPerson(date, personId);
    const existingTotal = existingRecords.reduce(
      (sum, record) => sum + parseWorkloadValue(record),
      0
    );
    const newTotal = records.reduce((sum, record) => sum + record.workload, 0);
    const finalTotal = existingTotal + newTotal;

    if (finalTotal > 1.0) {
      return NextResponse.json(
        {
          error: '总人力占用超出限制',
          detail: `已有人力 ${existingTotal.toFixed(1)} + 新增人力 ${newTotal.toFixed(1)} = ${finalTotal.toFixed(1)} > 1.0`,
        },
        { status: 400 }
      );
    }

    const resolvedCategories = await Promise.all(
      records.map((record) =>
        resolveCategorySelection({
          typeRecordId: record.typeRecordId,
          contentRecordId: record.contentRecordId,
          detailRecordId: record.detailRecordId,
        })
      )
    );

    const dateTimestamp = new Date(date).getTime();
    const bitableRecords: BitableRecord[] = records.map((record, index) => {
      const resolvedCategory = resolvedCategories[index];
      const fields: Record<string, unknown> = {
        记录日期: dateTimestamp,
        记录人员: [{ id: personId }],
        类型: resolvedCategory.typeName,
        内容: resolvedCategory.contentName,
        人力占用: Math.round(record.workload * 10),
        记录状态: '未发周报',
        创建人: [{ id: currentUser.openId }],
      };

      if (resolvedCategory.detailName) {
        fields['细项'] = resolvedCategory.detailName;
      }

      return { fields };
    });

    const result = await createRecords(bitableRecords);

    return NextResponse.json({
      success: true,
      count: result.records.length,
      recordIds: result.records.map((record) => record.record_id),
      message: `成功创建 ${result.records.length} 条记录`,
    });
  } catch (error) {
    console.error('[Records API POST] Error:', error);

    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      const errorResponseData = (error as { response?: { data?: unknown } }).response?.data;
      return NextResponse.json(
        {
          error: '创建记录失败',
          details: {
            message: error.message,
            ...(errorResponseData &&
            typeof errorResponseData === 'object' &&
            !Array.isArray(errorResponseData)
              ? errorResponseData
              : {}),
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: '创建记录失败' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - 更新记录
 */
export async function PATCH(request: NextRequest) {
  try {
    const valid = await isSessionValid();
    if (!valid) {
      return NextResponse.json(
        { error: '未登录或会话已过期' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { recordId, workload } = body;

    if (!recordId) {
      return NextResponse.json(
        { error: '缺少记录ID' },
        { status: 400 }
      );
    }

    if (typeof workload !== 'number' || workload <= 0 || workload > 1) {
      return NextResponse.json(
        { error: '人力占用值必须在 0-1 之间，且不能为 0' },
        { status: 400 }
      );
    }

    const targetRecord = await getRecord(recordId);
    if (!targetRecord) {
      return NextResponse.json(
        { error: '记录不存在' },
        { status: 404 }
      );
    }

    const recordDate = targetRecord.fields['记录日期'] as number;
    const personId = extractPersonId(targetRecord.fields['记录人员']);

    if (!recordDate || !personId) {
      return NextResponse.json(
        { error: '无法获取记录日期或记录人员信息' },
        { status: 400 }
      );
    }

    const dateStr = formatRecordDate(recordDate);
    const personRecords = await queryRecordsByDateAndPerson(dateStr, personId);

    const existingTotal = personRecords
      .filter((record) => record.record_id !== recordId)
      .reduce((sum, record) => sum + parseWorkloadValue(record), 0);

    if (existingTotal + workload > 1.0) {
      return NextResponse.json(
        {
          error: '总人力占用超出限制',
          detail: `该日期其他记录占用 ${existingTotal.toFixed(1)}，更新后将达到 ${(existingTotal + workload).toFixed(1)} > 1.0`,
        },
        { status: 400 }
      );
    }

    const updated = await updateRecord(recordId, {
      人力占用: Math.round(workload * 10),
    });

    return NextResponse.json({
      success: true,
      record: updated,
      message: '记录更新成功',
    });
  } catch (error) {
    console.error('[Records API PATCH] Error:', error);

    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      const errorResponseData = (error as { response?: { data?: unknown } }).response?.data;
      return NextResponse.json(
        {
          error: '更新记录失败',
          details: {
            message: error.message,
            ...(errorResponseData &&
            typeof errorResponseData === 'object' &&
            !Array.isArray(errorResponseData)
              ? errorResponseData
              : {}),
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: '更新记录失败' },
      { status: 500 }
    );
  }
}
