/**
 * 飞书多维表格(Bitable) API操作
 *
 * 这个文件实现了对飞书多维表格的CRUD操作：
 * 1. 查询记录（支持筛选和分页）
 * 2. 批量创建记录
 * 3. 更新记录
 * 4. 删除记录
 * 5. 获取字段配置
 */

import { feishuClient } from './client';
import { getTenantAccessToken } from './auth';
import { config } from '../config';
import {
  BitableRecord,
  QueryRecordsResponse,
  CreateRecordsResponse,
  BitableField,
} from '@/types/feishu';

/**
 * 查询记录筛选条件
 */
export interface RecordFilter {
  /**
   * 筛选条件
   * 例如：{ "记录日期": "2026-01-08", "记录人员": "user_id" }
   */
  filter?: {
    conjunction?: 'and' | 'or';
    conditions?: Array<{
      field_name: string;
      operator: 'is' | 'isNot' | 'contains' | 'doesNotContain' | 'isEmpty' | 'isNotEmpty';
      value?: unknown[];
    }>;
  };
  /**
   * 排序规则
   */
  sort?: Array<{
    field_name: string;
    desc?: boolean;
  }>;
  /**
   * 分页大小（最大500）
   */
  page_size?: number;
  /**
   * 分页标记
   */
  page_token?: string;
}

/**
 * 查询多维表格记录
 *
 * 使用POST /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/search
 *
 * @param appToken - 多维表格app_token
 * @param tableId - 表格table_id
 * @param filter - 筛选和分页条件
 * @returns 查询结果
 */
export async function queryRecords(
  appToken: string = config.feishu.appToken,
  tableId: string = config.feishu.recordTableId,
  filter?: RecordFilter
): Promise<QueryRecordsResponse> {
  try {
    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);

    const url = `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`;

    const response = await client.post<QueryRecordsResponse>(url, {
      ...filter,
      page_size: filter?.page_size || 100,
    });

    return response;
  } catch (error) {
    console.error('Failed to query records:', error);
    throw new Error('查询记录失败');
  }
}

/**
 * 查询指定表中的全部记录
 *
 * 多维表格分页单次最多返回500条，这里会自动翻页拉取完整结果。
 *
 * @param appToken - 多维表格app_token
 * @param tableId - 表格table_id
 * @param filter - 基础筛选条件
 * @returns 所有记录
 */
export async function queryAllRecords(
  appToken: string = config.feishu.appToken,
  tableId: string = config.feishu.recordTableId,
  filter?: Omit<RecordFilter, 'page_token'>
): Promise<BitableRecord[]> {
  const items: BitableRecord[] = [];
  let pageToken: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await queryRecords(appToken, tableId, {
      ...filter,
      page_size: filter?.page_size || 500,
      page_token: pageToken,
    });

    items.push(...(response.items || []));
    hasMore = response.has_more;
    pageToken = response.page_token;
  }

  return items;
}

/**
 * 根据日期和人员查询记录
 *
 * 这是一个便捷方法，用于查询特定日期和人员的记录
 *
 * @param date - 日期字符串 (YYYY-MM-DD)
 * @param personId - 用户ID
 * @returns 查询结果
 */
export async function queryRecordsByDateAndPerson(
  date: string,
  personId: string
): Promise<BitableRecord[]> {
  try {
    console.log('[Bitable Query] Querying records for date:', date, 'person:', personId);

    // 暂时不使用筛选，获取所有记录
    // 在客户端进行筛选，避免字段格式问题
    const filter: RecordFilter = {
      page_size: 500,
    };

    const records = await queryAllRecords(
      config.feishu.appToken,
      config.feishu.recordTableId,
      filter
    );

    console.log('[Bitable Query] Got', records.length, 'total records');

    // 打印第一条记录看看字段的格式
    if (records.length > 0) {
      console.log('[Bitable Query] Sample record fields:', JSON.stringify(records[0].fields, null, 2));
    }

    // 在客户端进行日期和人员过滤
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0); // 重置为当天0点
    const targetTimestamp = targetDate.getTime();

    const filteredRecords = records.filter((record: BitableRecord) => {
      // 检查日期
      const recordDate = record.fields['记录日期'] as number;
      if (!recordDate) return false;

      const recordDateObj = new Date(recordDate);
      recordDateObj.setHours(0, 0, 0, 0);
      const recordTimestamp = recordDateObj.getTime();

      if (recordTimestamp !== targetTimestamp) return false;

      // 检查人员（支持user_id和open_id两种格式）
      const recordPerson = record.fields['记录人员'];

      // 人员字段可能是数组格式 [{"id": "ou_xxx"}] 或字符串
      let personMatches = false;

      if (Array.isArray(recordPerson)) {
        // 数组格式：检查id或text字段
        personMatches = recordPerson.some((p: any) => {
          return p.id === personId || p.text === personId || p.en_name === personId || p.name === personId;
        });
      } else if (typeof recordPerson === 'string') {
        // 字符串格式：直接比较
        personMatches = recordPerson === personId;
      }

      return personMatches;
    });

    console.log('[Bitable Query] After filtering (date + person):', filteredRecords.length, 'records match');

    return filteredRecords;
  } catch (error) {
    console.error('Failed to query records by date and person:', error);
    throw new Error('查询指定日期和人员的记录失败');
  }
}

/**
 * 批量创建记录
 *
 * 使用POST /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/batch_create
 * 一次最多创建500条记录
 *
 * @param records - 记录数组
 * @param appToken - 多维表格app_token
 * @param tableId - 表格table_id
 * @returns 创建结果
 */
export async function createRecords(
  records: BitableRecord[],
  appToken: string = config.feishu.appToken,
  tableId: string = config.feishu.recordTableId
): Promise<CreateRecordsResponse> {
  try {
    if (records.length === 0) {
      throw new Error('记录列表不能为空');
    }

    if (records.length > 500) {
      throw new Error('一次最多创建500条记录');
    }

    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);

    const url = `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`;

    const response = await client.post<CreateRecordsResponse>(url, {
      records,
    });

    console.log(`[Bitable] Created ${records.length} records`);

    return response;
  } catch (error) {
    console.error('Failed to create records:', error);
    throw new Error('创建记录失败');
  }
}

/**
 * 更新单条记录
 *
 * @param recordId - 记录ID
 * @param fields - 要更新的字段
 * @param appToken - 多维表格app_token
 * @param tableId - 表格table_id
 * @returns 更新后的记录
 */
export async function updateRecord(
  recordId: string,
  fields: Record<string, unknown>,
  appToken: string = config.feishu.appToken,
  tableId: string = config.feishu.recordTableId
): Promise<BitableRecord> {
  try {
    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);

    const url = `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`;

    const response = await client.put<{ record: BitableRecord }>(url, {
      fields,
    });

    return response.record;
  } catch (error) {
    console.error('Failed to update record:', error);
    throw new Error('更新记录失败');
  }
}

/**
 * 获取单条记录
 *
 * @param recordId - 记录ID
 * @param appToken - 多维表格app_token
 * @param tableId - 表格table_id
 * @returns 记录详情
 */
export async function getRecord(
  recordId: string,
  appToken: string = config.feishu.appToken,
  tableId: string = config.feishu.recordTableId
): Promise<BitableRecord> {
  try {
    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);

    const url = `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`;
    const response = await client.get<{ record: BitableRecord }>(url);

    return response.record;
  } catch (error) {
    console.error('Failed to get record:', error);
    throw new Error('获取记录失败');
  }
}

/**
 * 删除记录
 *
 * @param recordId - 记录ID
 * @param appToken - 多维表格app_token
 * @param tableId - 表格table_id
 */
export async function deleteRecord(
  recordId: string,
  appToken: string = config.feishu.appToken,
  tableId: string = config.feishu.recordTableId
): Promise<void> {
  try {
    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);

    const url = `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`;

    await client.delete(url);

    console.log(`[Bitable] Deleted record ${recordId}`);
  } catch (error) {
    console.error('Failed to delete record:', error);
    throw new Error('删除记录失败');
  }
}

/**
 * 获取表格所有字段配置
 *
 * 用于获取字段类型、选项等元数据信息
 *
 * @param appToken - 多维表格app_token
 * @param tableId - 表格table_id
 * @returns 字段列表
 */
export async function getTableFields(
  appToken: string = config.feishu.appToken,
  tableId: string = config.feishu.recordTableId
): Promise<BitableField[]> {
  try {
    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);

    const url = `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`;

    const response = await client.get<{ items: BitableField[] }>(url);

    return response.items;
  } catch (error) {
    console.error('Failed to get table fields:', error);
    throw new Error('获取字段配置失败');
  }
}
