/**
 * 工作负载记录API
 *
 * GET /api/feishu/records - 查询记录
 * POST /api/feishu/records - 创建记录
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  queryRecordsByDateAndPerson,
  createRecords,
} from '@/lib/feishu/bitable';
import { isSessionValid, getCurrentUser } from '@/lib/session';
import { BitableRecord, WorkloadRecord } from '@/types/feishu';

/**
 * GET - 查询记录
 *
 * Query参数:
 * - date: 日期 (YYYY-MM-DD)
 * - person: 人员ID
 */
export async function GET(request: NextRequest) {
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
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const personId = searchParams.get('person');

    if (!date || !personId) {
      return NextResponse.json(
        { error: '缺少必要参数: date 和 person' },
        { status: 400 }
      );
    }

    // 查询记录
    const records = await queryRecordsByDateAndPerson(date, personId);

    console.log(`[Records API] Found ${records.length} records for date ${date}, person ${personId}`);
    if (records.length > 0) {
      console.log('[Records API] First record fields:', JSON.stringify(records[0].fields, null, 2));
    }

    // 计算总人力占用
    // 优先使用"人力占用计算"公式字段，如果为0则fallback到"人力占用"整数字段除以10
    const totalWorkload = records.reduce((sum, record) => {
      const workloadCalc = record.fields['人力占用计算'] as any;
      // 公式字段格式: { type: 2, value: [0.3] }
      let workload = (workloadCalc?.value?.[0] as number) || 0;

      // 如果公式字段为0，尝试使用"人力占用"整数字段（需要除以10）
      if (workload === 0) {
        const workloadInt = (record.fields['人力占用'] as number) || 0;
        workload = workloadInt / 10;
      }

      return sum + workload;
    }, 0);

    // 格式化记录数据
    const formattedRecords = records.map((record) => {
      const workloadCalc = record.fields['人力占用计算'] as any;
      let workload = (workloadCalc?.value?.[0] as number) || 0;

      // 如果公式字段为0，尝试使用"人力占用"整数字段（需要除以10）
      if (workload === 0) {
        const workloadInt = (record.fields['人力占用'] as number) || 0;
        workload = workloadInt / 10;
      }

      return {
        id: record.record_id,
        task: record.fields['事项'] as string || '未命名任务',
        workload: workload,
        status: record.fields['记录状态'] as string || '未发周报',
        createdTime: record.created_time,
      };
    });

    return NextResponse.json({
      records: formattedRecords,
      total: totalWorkload,
      count: formattedRecords.length,
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
 *
 * Body:
 * {
 *   date: "2026-01-08",
 *   personId: "user_id",
 *   records: [
 *     { task: "任务名称", workload: 0.3 },
 *     ...
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 检查用户是否已登录
    const valid = await isSessionValid();
    if (!valid) {
      return NextResponse.json(
        { error: '未登录或会话已过期' },
        { status: 401 }
      );
    }

    // 获取当前用户（作为创建人）
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: '无法获取当前用户信息' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { date, personId, records } = body;

    if (!date || !personId || !records || !Array.isArray(records)) {
      return NextResponse.json(
        { error: '请求参数不正确' },
        { status: 400 }
      );
    }

    // 验证记录数据
    if (records.length === 0) {
      return NextResponse.json(
        { error: '至少需要一条记录' },
        { status: 400 }
      );
    }

    // 查询该日期已有的记录，检查总人力是否会超限
    const existingRecords = await queryRecordsByDateAndPerson(date, personId);
    const existingTotal = existingRecords.reduce((sum, record) => {
      const workloadCalc = record.fields['人力占用计算'] as any;
      // 公式字段格式: { type: 2, value: [0.3] }
      let workload = (workloadCalc?.value?.[0] as number) || 0;

      // 如果公式字段为0，尝试使用"人力占用"整数字段（需要除以10）
      if (workload === 0) {
        const workloadInt = (record.fields['人力占用'] as number) || 0;
        workload = workloadInt / 10;
      }

      return sum + workload;
    }, 0);

    const newTotal = records.reduce((sum: number, r: { workload: number }) => {
      return sum + r.workload;
    }, 0);

    const finalTotal = existingTotal + newTotal;

    // 验证总人力不超过1.0
    if (finalTotal > 1.0) {
      return NextResponse.json(
        {
          error: '总人力占用超出限制',
          detail: `已有人力 ${existingTotal.toFixed(1)} + 新增人力 ${newTotal.toFixed(1)} = ${finalTotal.toFixed(1)} > 1.0`,
        },
        { status: 400 }
      );
    }

    // 转换为飞书Bitable记录格式
    const dateTimestamp = new Date(date).getTime();

    const bitableRecords: BitableRecord[] = records.map((record: { task: string; workload: number }) => ({
      fields: {
        记录日期: dateTimestamp,
        // 人员字段必须是对象数组格式 [{ id: "open_id" }]
        记录人员: [{ id: personId }],
        事项: record.task,
        // 人力占用字段存储整数（0.1存为1，0.3存为3）
        人力占用: Math.round(record.workload * 10),
        记录状态: '未发周报',
        // 创建人字段也是人员类型，需要对象数组格式，使用openId
        创建人: [{ id: currentUser.openId }],
      },
    }));

    console.log('[Records API] Creating records:', JSON.stringify(bitableRecords, null, 2));

    // 批量创建记录
    const result = await createRecords(bitableRecords);

    return NextResponse.json({
      success: true,
      count: result.records.length,
      recordIds: result.records.map((r) => r.record_id),
      message: `成功创建 ${result.records.length} 条记录`,
    });
  } catch (error) {
    console.error('[Records API POST] Error:', error);

    // 在development模式返回详细错误
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
      return NextResponse.json(
        {
          error: '创建记录失败',
          details: {
            message: error.message,
            // 如果是飞书API错误，包含更多信息
            ...(error as any).response?.data,
          }
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
