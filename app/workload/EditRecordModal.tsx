/**
 * 编辑记录弹窗组件
 *
 * 功能：
 * - 弹窗显示，支持编辑已有记录的人力占用
 * - 使用大笑脸选择器快速选择人力值
 * - 实时显示预览和验证
 * - 提交更新到飞书多维表格
 */

'use client';

import { useState, useEffect } from 'react';
import WorkloadSelector from './WorkloadSelector';

interface EditRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: {
    id: string;
    task: string;
    workload: number;
  } | null;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function EditRecordModal({
  isOpen,
  onClose,
  record,
  onSuccess,
  onError,
}: EditRecordModalProps) {
  const [workload, setWorkload] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 当弹窗打开或记录变化时，重置workload为记录的原始值
  useEffect(() => {
    if (isOpen && record) {
      setWorkload(record.workload);
    }
  }, [isOpen, record]);

  // 提交更新
  const handleSubmit = async () => {
    if (!record) return;

    try {
      setIsSubmitting(true);

      const res = await fetch('/api/feishu/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: record.id,
          workload: workload,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新失败');
      }

      // 等待 onSuccess 完成（它会刷新数据）
      await onSuccess();
      // 数据刷新完成后再关闭弹窗
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 生成Emoji表情
  const getWorkloadEmojis = (workloadValue: number): string => {
    if (workloadValue === 0) return '';
    const clampedWorkload = Math.max(0, Math.min(1, workloadValue));
    const filled = Math.round(clampedWorkload * 10);
    return '😄'.repeat(filled);
  };

  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        {/* 标题 */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">编辑记录</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="关闭"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 事项名称 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            事项
          </label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
            {record.task}
          </div>
        </div>

        {/* 人力选择器 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            人力占用
          </label>
          <div className="flex justify-center">
            <WorkloadSelector
              value={workload}
              onChange={setWorkload}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* 预览 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">新的人力占用值：</span>
            <span className="flex items-center gap-2">
              <span className="text-lg">{getWorkloadEmojis(workload)}</span>
              <span className="font-semibold text-blue-600 text-lg">
                {workload.toFixed(1)}
              </span>
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            点击确认后，系统会验证该日期的总人力是否超过1.0
          </p>
        </div>

        {/* 按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || workload === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isSubmitting ? '更新中...' : '确认更新'}
          </button>
        </div>
      </div>
    </div>
  );
}
