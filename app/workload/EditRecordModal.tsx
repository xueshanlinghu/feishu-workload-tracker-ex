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
  hoursToWorkloadRatio,
  MAX_DAILY_HOURS,
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

  useEffect(() => {
    if (isOpen && record) {
      setHours(record.hours);
    }
  }, [isOpen, record]);

  const newTotalHours = record
    ? currentTotalHours - record.hours + hours
    : currentTotalHours;
  const isOverLimit = newTotalHours > MAX_DAILY_HOURS;
  const hoursChange = record ? hours - record.hours : 0;
  const moodTone = hours > 0 ? getHoursMoodTone(hours) : null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">编辑记录</h2>
            <p className="mt-1 text-sm text-gray-500">调整该事项的工时并实时校验当天上限</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
            aria-label="关闭"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">分类路径</label>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900">
            {record.task}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-3 block text-sm font-medium text-gray-700">工时</label>
          <WorkloadSelector
            value={hours}
            onChange={setHours}
            disabled={isSubmitting}
          />
        </div>

        <div className="mb-6 space-y-3 rounded-2xl bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">新的工时值：</span>
            <span className="flex items-center gap-3">
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
            <div className="flex items-center justify-between">
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

          <div className="flex items-center justify-between border-t border-gray-200 pt-3">
            <span className="text-sm font-medium text-gray-700">修改后总工时：</span>
            <span className={`text-right text-lg font-bold ${isOverLimit ? 'text-red-600' : 'text-emerald-600'}`}>
              <span className="block">
                {formatHoursValue(newTotalHours)} / {MAX_DAILY_HOURS} 小时
              </span>
              <span className="block text-xs font-medium text-gray-500">
                约 {hoursToWorkloadRatio(newTotalHours).toFixed(1)} / {hoursToWorkloadRatio(MAX_DAILY_HOURS).toFixed(1)} 人天
              </span>
            </span>
          </div>

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

        <div className="flex gap-3">
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
