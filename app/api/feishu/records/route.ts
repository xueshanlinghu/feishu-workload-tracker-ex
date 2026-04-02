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
  parseRecordHours,
  resolveCategorySelection,
} from '@/lib/feishu/workload';
import { getCurrentUser, isSessionValid } from '@/lib/session';
import { isValidRecordHours, MAX_DAILY_HOURS } from '@/lib/work-hours';
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
    const totalHours = records.reduce((sum, record) => sum + record.hours, 0);

    return NextResponse.json({
      records,
      totalHours,
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

    const invalidHours = records.some(
      (record) => typeof record.hours !== 'number' || !isValidRecordHours(record.hours)
    );
    if (invalidHours) {
      return NextResponse.json(
        { error: `单条记录工时必须是 ${MAX_DAILY_HOURS} 小时以内的整数，且不能小于 1 小时` },
        { status: 400 }
      );
    }

    const existingRecords = await queryRecordsByDateAndPerson(date, personId);
    const existingTotalHours = existingRecords.reduce(
      (sum, record) => sum + parseRecordHours(record),
      0
    );
    const newTotalHours = records.reduce((sum, record) => sum + record.hours, 0);
    const finalTotalHours = existingTotalHours + newTotalHours;

    if (finalTotalHours > MAX_DAILY_HOURS) {
      return NextResponse.json(
        {
          error: '总工时超出限制',
          detail: `已录入 ${existingTotalHours} 小时 + 新增 ${newTotalHours} 小时 = ${finalTotalHours} 小时，超过 ${MAX_DAILY_HOURS} 小时上限`,
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
        人力占用小时数: record.hours,
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
    const { recordId, hours } = body;

    if (!recordId) {
      return NextResponse.json(
        { error: '缺少记录ID' },
        { status: 400 }
      );
    }

    if (typeof hours !== 'number' || !isValidRecordHours(hours)) {
      return NextResponse.json(
        { error: `工时必须是 ${MAX_DAILY_HOURS} 小时以内的整数，且不能小于 1 小时` },
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

    const personRecords = await queryRecordsByDateAndPerson(recordDate, personId);

    const existingTotalHours = personRecords
      .filter((record) => record.record_id !== recordId)
      .reduce((sum, record) => sum + parseRecordHours(record), 0);

    if (existingTotalHours + hours > MAX_DAILY_HOURS) {
      return NextResponse.json(
        {
          error: '总工时超出限制',
          detail: `该日期其他记录已占用 ${existingTotalHours} 小时，更新后将达到 ${existingTotalHours + hours} 小时，超过 ${MAX_DAILY_HOURS} 小时上限`,
        },
        { status: 400 }
      );
    }

    const updated = await updateRecord(recordId, {
      人力占用小时数: hours,
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
