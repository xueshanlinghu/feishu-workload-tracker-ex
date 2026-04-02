/**
 * 人力占用业务数据服务
 *
 * 这个文件负责处理人力占用场景下的业务数据：
 * 1. 读取类型/内容/细项三级字典
 * 2. 校验三级字典之间的关联关系
 * 3. 格式化人力记录的展示文案和人力值
 */

import { config } from '@/lib/config';
import { STANDARD_WORKDAY_HOURS } from '@/lib/work-hours';
import { queryAllRecords, queryRecordsByDateAndPerson } from './bitable';
import { BitableRecord, CategoryOption } from '@/types/feishu';

interface TypeDictionaryRecord {
  recordId: string;
  name: string;
  contentRecordIds: string[];
  sequence: number;
}

interface ContentDictionaryRecord {
  recordId: string;
  name: string;
  detailRecordIds: string[];
  sequence: number;
}

interface DetailDictionaryRecord {
  recordId: string;
  name: string;
  sequence: number;
}

interface DictionarySnapshot {
  types: Map<string, TypeDictionaryRecord>;
  contents: Map<string, ContentDictionaryRecord>;
  details: Map<string, DetailDictionaryRecord>;
}

interface DictionarySnapshotCache {
  expiresAt: number;
  snapshot: DictionarySnapshot;
}

const DICTIONARY_CACHE_TTL_MS = 60 * 1000;
let dictionarySnapshotCache: DictionarySnapshotCache | null = null;
let dictionarySnapshotInFlight: Promise<DictionarySnapshot> | null = null;

export interface FormattedWorkloadRecord {
  id?: string;
  type: string;
  content: string;
  detail?: string;
  task: string;
  hours: number;
  status: string;
  createdTime?: number;
}

export interface DetailCategoryResponse {
  items: CategoryOption[];
  requiresDetail: boolean;
}

export interface ResolvedCategorySelection {
  typeName: string;
  contentName: string;
  detailName?: string;
  requiresDetail: boolean;
}

/**
 * 从飞书字段值中提取单个文本/单选值
 */
function extractSingleValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];

    if (typeof first === 'string') {
      return first.trim();
    }

    if (first && typeof first === 'object' && 'text' in first) {
      const text = (first as { text?: string }).text;
      return text?.trim() || '';
    }
  }

  return '';
}

/**
 * 从关联字段中提取关联记录ID列表
 */
function extractLinkedRecordIds(value: unknown): string[] {
  if (!value || typeof value !== 'object' || !('link_record_ids' in value)) {
    return [];
  }

  const linkRecordIds = (value as { link_record_ids?: unknown }).link_record_ids;
  if (!Array.isArray(linkRecordIds)) {
    return [];
  }

  return linkRecordIds.filter((item): item is string => typeof item === 'string');
}

/**
 * 提取序号字段，用于按业务顺序排序
 */
function extractSequence(record: BitableRecord): number {
  const rawSequence = extractSingleValue(record.fields['序號'] ?? record.fields['序号']);
  const parsed = Number(rawSequence);

  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/**
 * 对分类选项进行稳定排序
 */
function sortBySequence<T extends { sequence: number; name: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

/**
 * 构建分类展示文案
 */
export function buildTaskLabel(type: string, content: string, detail?: string): string {
  const parts = [type, content, detail].filter(Boolean);
  return parts.join(' / ');
}

/**
 * 从飞书记录中解析工时
 *
 * 优先读取 `人力占用小时数` 整数字段；若该字段缺失，再使用公式字段折算小时数作为兜底。
 */
export function parseRecordHours(record: BitableRecord): number {
  const rawHours = record.fields['人力占用小时数'];

  if (typeof rawHours === 'number' && Number.isFinite(rawHours)) {
    return rawHours;
  }

  if (typeof rawHours === 'string') {
    const parsedHours = Number(rawHours);
    if (Number.isFinite(parsedHours)) {
      return parsedHours;
    }
  }

  const workloadCalc = record.fields['人力占用计算'] as
    | { value?: number[] }
    | undefined;
  const workloadRatio = (workloadCalc?.value?.[0] as number) || 0;

  if (workloadRatio > 0) {
    return Math.round(workloadRatio * STANDARD_WORKDAY_HOURS);
  }

  return 0;
}

/**
 * 将飞书原始记录格式化为前端展示数据
 */
export function formatWorkloadRecord(record: BitableRecord): FormattedWorkloadRecord {
  const type = extractSingleValue(record.fields['类型']);
  const content = extractSingleValue(record.fields['内容']);
  const detail = extractSingleValue(record.fields['细项']);

  return {
    id: record.record_id,
    type,
    content,
    detail: detail || undefined,
    task: buildTaskLabel(type, content, detail || undefined),
    hours: parseRecordHours(record),
    status: (record.fields['记录状态'] as string) || '未发周报',
    createdTime: record.created_time,
  };
}

/**
 * 读取三级字典的完整快照
 */
async function getDictionarySnapshot(): Promise<DictionarySnapshot> {
  const now = Date.now();
  if (dictionarySnapshotCache && dictionarySnapshotCache.expiresAt > now) {
    return dictionarySnapshotCache.snapshot;
  }

  if (dictionarySnapshotInFlight) {
    return dictionarySnapshotInFlight;
  }

  dictionarySnapshotInFlight = (async () => {
    const [typeRecords, contentRecords, detailRecords] = await Promise.all([
      queryAllRecords(config.feishu.appToken, config.feishu.typeTableId),
      queryAllRecords(config.feishu.appToken, config.feishu.contentTableId),
      queryAllRecords(config.feishu.appToken, config.feishu.detailTableId),
    ]);

    const types = new Map<string, TypeDictionaryRecord>();
    const contents = new Map<string, ContentDictionaryRecord>();
    const details = new Map<string, DetailDictionaryRecord>();

    typeRecords.forEach((record) => {
      const recordId = record.record_id;
      const name = extractSingleValue(record.fields['类型']);

      if (!recordId || !name) {
        return;
      }

      types.set(recordId, {
        recordId,
        name,
        contentRecordIds: extractLinkedRecordIds(record.fields['关联内容']),
        sequence: extractSequence(record),
      });
    });

    contentRecords.forEach((record) => {
      const recordId = record.record_id;
      const name = extractSingleValue(record.fields['内容']);

      if (!recordId || !name) {
        return;
      }

      contents.set(recordId, {
        recordId,
        name,
        detailRecordIds: extractLinkedRecordIds(record.fields['关联细项']),
        sequence: extractSequence(record),
      });
    });

    detailRecords.forEach((record) => {
      const recordId = record.record_id;
      const name = extractSingleValue(record.fields['细项']);

      if (!recordId || !name) {
        return;
      }

      details.set(recordId, {
        recordId,
        name,
        sequence: extractSequence(record),
      });
    });

    const snapshot = {
      types,
      contents,
      details,
    };

    dictionarySnapshotCache = {
      expiresAt: Date.now() + DICTIONARY_CACHE_TTL_MS,
      snapshot,
    };

    return snapshot;
  })();

  try {
    return await dictionarySnapshotInFlight;
  } finally {
    dictionarySnapshotInFlight = null;
  }
}

/**
 * 获取类型下拉选项
 */
export async function getTypeCategoryOptions(): Promise<CategoryOption[]> {
  const snapshot = await getDictionarySnapshot();
  const sortedTypes = sortBySequence(Array.from(snapshot.types.values()));

  return sortedTypes.map((item) => ({
    recordId: item.recordId,
    label: item.name,
  }));
}

/**
 * 获取指定类型下的内容下拉选项
 */
export async function getContentCategoryOptions(
  typeRecordId: string
): Promise<CategoryOption[]> {
  const snapshot = await getDictionarySnapshot();
  const typeRecord = snapshot.types.get(typeRecordId);

  if (!typeRecord) {
    throw new Error('所选类型不存在');
  }

  const contentOptions = typeRecord.contentRecordIds
    .map((recordId) => snapshot.contents.get(recordId))
    .filter((item): item is ContentDictionaryRecord => Boolean(item));

  return sortBySequence(contentOptions).map((item) => ({
    recordId: item.recordId,
    label: item.name,
  }));
}

/**
 * 获取指定内容下的细项下拉选项
 */
export async function getDetailCategoryOptions(
  contentRecordId: string
): Promise<DetailCategoryResponse> {
  const snapshot = await getDictionarySnapshot();
  const contentRecord = snapshot.contents.get(contentRecordId);

  if (!contentRecord) {
    throw new Error('所选内容不存在');
  }

  const detailOptions = contentRecord.detailRecordIds
    .map((recordId) => snapshot.details.get(recordId))
    .filter((item): item is DetailDictionaryRecord => Boolean(item));

  return {
    items: sortBySequence(detailOptions).map((item) => ({
      recordId: item.recordId,
      label: item.name,
    })),
    requiresDetail: detailOptions.length > 0,
  };
}

/**
 * 校验并解析前端提交的三级分类选择
 */
export async function resolveCategorySelection(input: {
  typeRecordId: string;
  contentRecordId: string;
  detailRecordId?: string;
}): Promise<ResolvedCategorySelection> {
  const snapshot = await getDictionarySnapshot();
  const typeRecord = snapshot.types.get(input.typeRecordId);
  const contentRecord = snapshot.contents.get(input.contentRecordId);

  if (!typeRecord) {
    throw new Error('所选类型不存在');
  }

  if (!contentRecord) {
    throw new Error('所选内容不存在');
  }

  if (!typeRecord.contentRecordIds.includes(input.contentRecordId)) {
    throw new Error('所选内容不属于当前类型');
  }

  const requiresDetail = contentRecord.detailRecordIds.length > 0;

  if (!requiresDetail) {
    if (input.detailRecordId) {
      throw new Error('当前内容没有细项，请不要提交细项');
    }

    return {
      typeName: typeRecord.name,
      contentName: contentRecord.name,
      requiresDetail: false,
    };
  }

  if (!input.detailRecordId) {
    throw new Error('当前内容必须选择细项');
  }

  const detailRecord = snapshot.details.get(input.detailRecordId);
  if (!detailRecord) {
    throw new Error('所选细项不存在');
  }

  if (!contentRecord.detailRecordIds.includes(input.detailRecordId)) {
    throw new Error('所选细项不属于当前内容');
  }

  return {
    typeName: typeRecord.name,
    contentName: contentRecord.name,
    detailName: detailRecord.name,
    requiresDetail: true,
  };
}

/**
 * 查询并格式化某日期某人员的人力记录
 */
export async function getFormattedWorkloadRecordsByDateAndPerson(
  date: string,
  personId: string
): Promise<FormattedWorkloadRecord[]> {
  const records = await queryRecordsByDateAndPerson(date, personId);
  return records.map(formatWorkloadRecord);
}
