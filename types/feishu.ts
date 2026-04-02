// 飞书API相关的TypeScript类型定义

/**
 * 飞书API通用响应格式
 */
export interface FeishuResponse<T = unknown> {
  code: number;
  msg?: string;
  message?: string;
  data?: T;
}

/**
 * 租户访问令牌响应
 */
export interface TenantAccessTokenResponse {
  tenant_access_token: string;
  expire: number; // 过期时间（秒）
}

/**
 * 用户访问令牌响应
 */
export interface UserAccessTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  refresh_expires_in?: number;
  refresh_token_expires_in?: number;
}

/**
 * 飞书用户信息
 */
export interface FeishuUser {
  user_id: string;
  open_id: string;
  union_id?: string;
  name: string;
  en_name?: string;
  email?: string;
  mobile?: string;
  avatar?: {
    avatar_72?: string;
    avatar_240?: string;
    avatar_640?: string;
    avatar_origin?: string;
  };
  department_ids?: string[];
  employee_id?: string;
}

/**
 * 多维表格记录
 */
export interface BitableRecord {
  record_id?: string;
  fields: Record<string, unknown>;
  created_time?: number;
  last_modified_time?: number;
}

/**
 * 查询记录响应
 */
export interface QueryRecordsResponse {
  has_more: boolean;
  page_token?: string;
  total: number;
  items: BitableRecord[];
}

/**
 * 创建记录响应
 */
export interface CreateRecordsResponse {
  records: BitableRecord[];
}

/**
 * 表格字段定义
 */
export interface BitableField {
  field_id: string;
  field_name: string;
  type: number; // 字段类型编码
  property?: Record<string, unknown>;
  ui_type?: string;
}

/**
 * 工作负载记录数据结构
 */
export interface WorkloadRecord {
  记录ID?: string;
  记录日期: number; // Unix时间戳（毫秒）
  记录人员: string; // 用户ID
  类型: string;
  内容: string;
  细项?: string;
  人力占用小时数: number; // 1 - 14 小时
  记录状态?: string;
  创建人?: string;
}

/**
 * 分类选项数据结构
 */
export interface CategoryOption {
  recordId: string;
  label: string;
}

/**
 * 分类接口响应数据结构
 */
export interface CategoryResponse {
  items: CategoryOption[];
  total: number;
  requiresContent?: boolean;
  requiresDetail?: boolean;
}

/**
 * 提交工作负载数据
 */
export interface SubmitWorkloadData {
  date: string; // YYYY-MM-DD
  personId: string;
  records: Array<{
    typeRecordId: string;
    contentRecordId?: string;
    detailRecordId?: string;
    hours: number;
  }>;
}
