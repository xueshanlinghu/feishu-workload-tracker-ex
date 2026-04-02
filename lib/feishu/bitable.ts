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

type UserIdType = 'open_id' | 'union_id' | 'user_id';
type FilterOperator =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'doesNotContain'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isGreater'
  | 'isGreaterEqual'
  | 'isLess'
  | 'isLessEqual';

interface RecordFilterCondition {
  field_name: string;
  operator: FilterOperator;
  value?: string[];
}

interface RecordFilterGroup {
  conjunction: 'and' | 'or';
  conditions?: RecordFilterCondition[];
  children?: RecordFilterGroup[];
}

/**
 * 查询记录筛选条件
 */
export interface RecordFilter {
  /**
   * 视图 ID
   */
  view_id?: string;
  /**
   * 需要返回的字段名列表
   *
   * 在记录表数据量变大后，只拉取页面真正要用到的字段，可以显著减少传输和解析压力。
   */
  field_names?: string[];
  /**
   * 排序规则
   */
  sort?: Array<{
    field_name: string;
    desc?: boolean;
  }>;
  /**
   * 飞书服务端筛选条件
   *
   * 这里直接映射飞书 records/search 的 filter 结构，避免把整张表拉回本地再过滤。
   */
  filter?: RecordFilterGroup;
  /**
   * 是否自动返回系统字段
   */
  automatic_fields?: boolean;
  /**
   * 分页大小（最大500）
   */
  page_size?: number;
  /**
   * 分页标记
   */
  page_token?: string;
  /**
   * 人员字段 ID 类型
   *
   * 当前项目记录人员保存的是 open_id，因此查询时需要显式指定。
   */
  user_id_type?: UserIdType;
}

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

/**
 * 组装 records/search 请求地址
 *
 * 飞书要求 page_size、page_token、user_id_type 通过 query string 传递，
 * 其余筛选条件放在 POST body 中。
 */
function buildSearchUrl(
  appToken: string,
  tableId: string,
  pageSize: number,
  userIdType: UserIdType,
  pageToken?: string
): string {
  const params = new URLSearchParams({
    page_size: String(pageSize),
    user_id_type: userIdType,
  });

  if (pageToken) {
    params.set('page_token', pageToken);
  }

  return `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search?${params.toString()}`;
}

/**
 * 将 YYYY-MM-DD 或飞书日期时间戳转换成 ExactDate 筛选值
 *
 * 飞书日期字段的服务端精确筛选需要使用 ["ExactDate", "<timestamp>"] 格式。
 */
function toExactDateValue(dateOrTimestamp: string | number): string[] {
  const timestamp =
    typeof dateOrTimestamp === 'number'
      ? dateOrTimestamp
      : new Date(dateOrTimestamp).getTime();

  if (!Number.isFinite(timestamp)) {
    throw new Error(`无效的日期参数: ${dateOrTimestamp}`);
  }

  return ['ExactDate', String(timestamp)];
}

/**
 * 查询多维表格记录
 *
 * 使用POST /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/search
 *
 * @param appToken - 多维表格app_token
 * @param tableId - 表格table_id
 * @param options - 筛选和分页条件
 * @returns 查询结果
 */
export async function queryRecords(
  appToken: string = config.feishu.appToken,
  tableId: string = config.feishu.recordTableId,
  options: RecordFilter = {}
): Promise<QueryRecordsResponse> {
  try {
    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);
    const {
      page_size = DEFAULT_PAGE_SIZE,
      page_token,
      user_id_type = 'open_id',
      ...body
    } = options;
    const safePageSize = Math.min(Math.max(page_size, 1), MAX_PAGE_SIZE);
    const url = buildSearchUrl(
      appToken,
      tableId,
      safePageSize,
      user_id_type,
      page_token
    );

    const response = await client.post<QueryRecordsResponse>(url, body);

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
      page_size: filter?.page_size || MAX_PAGE_SIZE,
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
 * @param date - 日期字符串 (YYYY-MM-DD) 或飞书日期时间戳
 * @param personId - 用户 open_id
 * @returns 查询结果
 */
export async function queryRecordsByDateAndPerson(
  date: string | number,
  personId: string
): Promise<BitableRecord[]> {
  try {
    console.log('[Bitable Query] Querying records for date:', date, 'person:', personId);
    const records: BitableRecord[] = [];
    let pageToken: string | undefined;

    do {
      const response = await queryRecords(config.feishu.appToken, config.feishu.recordTableId, {
        page_size: MAX_PAGE_SIZE,
        page_token: pageToken,
        user_id_type: 'open_id',
        automatic_fields: true,
        field_names: [
          '记录日期',
          '记录人员',
          '类型',
          '内容',
          '细项',
          '人力占用小时数',
          '人力占用计算',
          '记录状态',
        ],
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: '记录日期',
              operator: 'is',
              value: toExactDateValue(date),
            },
            {
              field_name: '记录人员',
              operator: 'is',
              value: [personId],
            },
          ],
        },
      });

      records.push(...(response.items || []));
      pageToken = response.has_more ? response.page_token : undefined;
    } while (pageToken);

    console.log('[Bitable Query] Found', records.length, 'records from server-side filter');

    return records;
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
  tableId: string = config.feishu.recordTableId,
  userIdType: UserIdType = 'open_id'
): Promise<BitableRecord> {
  try {
    const token = await getTenantAccessToken();
    const client = feishuClient.withAuth(token);

    const params = new URLSearchParams({
      user_id_type: userIdType,
    });
    const url = `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}?${params.toString()}`;
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
