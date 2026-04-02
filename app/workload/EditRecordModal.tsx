/**
 * 编辑记录弹窗组件
 *
 * 功能：
 * - 弹窗显示，支持编辑已有记录的工时
 * - 使用 14 格彩色情绪选择器快速调整小时数
 * - 实时显示工时变化、折算人天和总量校验
 * - 提交更新到飞书多维表格
 */

'use client';

import { useEffect, useState } from 'react';
import HoursMoodIcon, { getHoursMoodTone } from './HoursMoodIcon';
import WorkloadSelector from './WorkloadSelector';
import {
  formatHoursValue,
  getDailyHoursStatus,
  hoursToWorkloadRatio,
  MAX_DAILY_HOURS,
  STANDARD_WORKDAY_HOURS,
} from '@/lib/work-hours';

interface EditRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: {
    id: string;
    task: string;
    hours: number;
  } | null;
  onSuccess: () => void;
  onError: (error: string) => void;
  currentTotalHours: number; // 当前日期的总工时
}

export default function EditRecordModal({
  isOpen,
  onClose,
  record,
  onSuccess,
  onError,
  currentTotalHours,
}: EditRecordModalProps) {
  const [hours, setHours] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useCompactLayout, setUseCompactLayout] = useState(false);

  useEffect(() => {
    if (isOpen && record) {
      setHours(record.hours);
    }
  }, [isOpen, record]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 1280px), (max-height: 900px)');
    const updateLayoutMode = () => {
      setUseCompactLayout(mediaQuery.matches);
    };

    updateLayoutMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateLayoutMode);
      return () => {
        mediaQuery.removeEventListener('change', updateLayoutMode);
      };
    }

    mediaQuery.addListener(updateLayoutMode);
    return () => {
      mediaQuery.removeListener(updateLayoutMode);
    };
  }, []);

  const newTotalHours = record
    ? currentTotalHours - record.hours + hours
    : currentTotalHours;
  const totalHoursStatus = getDailyHoursStatus(newTotalHours);
  const isOverLimit = newTotalHours > MAX_DAILY_HOURS;
  const isOverStandardHours = newTotalHours > STANDARD_WORKDAY_HOURS;
  const hoursChange = record ? hours - record.hours : 0;
  const moodTone = hours > 0 ? getHoursMoodTone(hours) : null;
  const totalHoursValueColor =
    totalHoursStatus === 'danger'
      ? 'text-red-600'
      : totalHoursStatus === 'warning'
        ? 'text-orange-500'
        : 'text-emerald-600';
  const totalHoursRatioColor =
    totalHoursStatus === 'danger'
      ? 'text-red-500'
      : totalHoursStatus === 'warning'
        ? 'text-orange-500'
        : 'text-gray-500';
  const totalHoursLimitColor =
    totalHoursStatus === 'danger'
      ? 'text-red-600'
      : totalHoursStatus === 'warning'
        ? 'text-orange-500'
        : 'text-emerald-600';
  const summaryCardClass =
    totalHoursStatus === 'danger'
      ? 'border-red-200 bg-red-50'
      : totalHoursStatus === 'warning'
        ? 'border-orange-200 bg-orange-50'
        : 'border-emerald-200 bg-emerald-50';

  const handleSubmit = async () => {
    if (!record) return;

    try {
      setIsSubmitting(true);

      const res = await fetch('/api/feishu/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: record.id,
          hours,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新失败');
      }

      await onSuccess();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="w-full max-w-[min(96vw,44rem)] max-h-[calc(100vh-1rem)] overflow-y-auto overscroll-contain rounded-[28px] bg-white p-4 shadow-xl sm:max-h-[calc(100vh-2rem)] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4 sm:mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">编辑记录</h2>
            <p className="mt-1 text-sm text-gray-500">调整该事项的工时并实时校验当天上限</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 transition-colors hover:text-gray-600"
            aria-label="关闭"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">分类路径</label>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 break-words">
            {record.task}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-3 block text-sm font-medium text-gray-700">工时</label>
          <WorkloadSelector
            value={hours}
            onChange={setHours}
            disabled={isSubmitting}
            mode={useCompactLayout ? 'dropdown' : 'inline'}
          />
        </div>

        <div className={`mb-6 space-y-3 rounded-2xl border p-5 ${summaryCardClass}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-gray-600">新的工时值：</span>
            <span className="flex items-center gap-3 sm:justify-end">
              {moodTone && (
                <HoursMoodIcon hours={hours} active={true} size={18} className="h-10 w-10" />
              )}
              <span className="text-right">
                <span className={`block text-lg font-semibold ${moodTone?.iconClassName || 'text-blue-600'}`}>
                  {formatHoursValue(hours)} 小时
                </span>
                <span className="block text-xs text-gray-500">
                  约 {hoursToWorkloadRatio(hours).toFixed(1)} 人天
                </span>
              </span>
            </span>
          </div>

          {hoursChange !== 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-gray-600">工时变动：</span>
              <span
                className={`text-sm font-semibold ${
                  hoursChange > 0 ? 'text-orange-600' : 'text-emerald-600'
                }`}
              >
                {hoursChange > 0 ? '+' : ''}
                {formatHoursValue(hoursChange)} 小时
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-gray-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-700">修改后总工时：</span>
            <span className="text-right text-lg font-bold">
              <span className="block">
                <span className={totalHoursValueColor}>{formatHoursValue(newTotalHours)}</span>
                <span className={totalHoursLimitColor}> / {STANDARD_WORKDAY_HOURS} 小时</span>
              </span>
              <span className={`block text-xs font-medium ${totalHoursRatioColor}`}>
                约 {hoursToWorkloadRatio(newTotalHours).toFixed(1)} 人天
              </span>
            </span>
          </div>

          {!isOverLimit && isOverStandardHours && (
            <div className="flex items-start gap-2 rounded-2xl border border-orange-200 bg-white/70 p-3">
              <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-orange-800">已超过 8 小时标准工时</p>
                <p className="mt-1 text-xs text-orange-700">
                  修改后总工时为 {formatHoursValue(newTotalHours)} 小时，仍可保存，但请留意当天安排。
                </p>
              </div>
            </div>
          )}

          {isOverLimit && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
              <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800">总工时超过限制</p>
                <p className="mt-1 text-xs text-red-600">
                  该日期总工时将达到 {formatHoursValue(newTotalHours)} 小时，超过 {MAX_DAILY_HOURS} 小时上限，无法保存。
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || hours === 0 || isOverLimit}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? '更新中...' : '确认更新'}
          </button>
        </div>
      </div>
    </div>
  );
}
