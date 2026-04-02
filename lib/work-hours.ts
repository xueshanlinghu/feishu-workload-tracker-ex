/**
 * 工时相关常量与换算函数
 *
 * 统一维护前后端共用的小时制规则，避免出现界面、接口、飞书写入规则不一致的问题。
 */

export const STANDARD_WORKDAY_HOURS = 8;
export const MAX_DAILY_HOURS = 14;
export const MIN_RECORD_HOURS = 1;

/**
 * 将小时数折算为人天值，并保留 1 位小数。
 */
export function hoursToWorkloadRatio(hours: number): number {
  return Number((hours / STANDARD_WORKDAY_HOURS).toFixed(1));
}

/**
 * 格式化小时值，整数不带小数，小数保留 1 位。
 */
export function formatHoursValue(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/**
 * 统一的工时合法性校验。
 *
 * 录入规则要求最小单位为 1 小时，且每条记录必须是整数小时。
 */
export function isValidRecordHours(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_RECORD_HOURS && value <= MAX_DAILY_HOURS;
}
