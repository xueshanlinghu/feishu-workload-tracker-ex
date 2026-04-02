/**
 * 环形进度图组件
 * 用于可视化展示当天工时占比。
 *
 * 以 8 小时为 100% 基准：
 * - 第一圈表示标准工时内的占用
 * - 超过 100% 后，在同一圆环上继续覆盖显示额外进度
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  formatHoursValue,
  getDailyHoursStatus,
  hoursToWorkloadRatio,
} from '@/lib/work-hours';

interface CircularProgressProps {
  /** 当前小时数 */
  current: number;
  /** 百分比基准小时数，当前页面使用 8 小时作为 100% */
  max: number;
  /** 每次刷新时递增，用于触发圆环重绘动画 */
  refreshToken?: number;
  /** 圆环大小 */
  size?: number;
  /** 圆环粗细 */
  strokeWidth?: number;
}

export default function CircularProgress({
  current,
  max,
  refreshToken = 0,
  size = 120,
  strokeWidth = 10,
}: CircularProgressProps) {
  const safeMax = max > 0 ? max : 1;
  const status = getDailyHoursStatus(current);
  const percentage = (current / safeMax) * 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetBaseProgress = Math.min(current / safeMax, 1);
  const targetOverflowProgress = Math.min(Math.max(current - safeMax, 0) / safeMax, 1);
  const targetTotalProgress = targetBaseProgress + targetOverflowProgress;
  const animationFrameRef = useRef<number | null>(null);
  const [displayedTotalProgress, setDisplayedTotalProgress] = useState(targetTotalProgress);
  const displayedBaseProgress = Math.min(displayedTotalProgress, 1);
  const displayedOverflowProgress = Math.max(displayedTotalProgress - 1, 0);
  const baseOffset = circumference - displayedBaseProgress * circumference;
  const overflowOffset = circumference - displayedOverflowProgress * circumference;
  const hasOverflow = targetOverflowProgress > 0 || displayedOverflowProgress > 0;
  const overflowGradientId = status === 'danger' ? 'rose-gradient' : 'orange-gradient';

  const centerColor =
    status === 'danger'
      ? 'text-rose-600'
      : status === 'warning'
        ? 'text-orange-600'
        : 'text-emerald-600';
  const detailColor =
    status === 'danger'
      ? 'text-rose-500'
      : status === 'warning'
        ? 'text-orange-500'
        : 'text-slate-500';

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (refreshToken <= 0) {
      setDisplayedTotalProgress(targetTotalProgress);
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayedTotalProgress(targetTotalProgress);
      return;
    }

    setDisplayedTotalProgress(0);
    const totalDuration = 3000;

    const easeOutQuart = (progress: number) => 1 - Math.pow(1 - progress, 4);

    const step = (startTime: number, now: number) => {
      const elapsed = now - startTime;
      const clampedProgress = Math.min(elapsed / totalDuration, 1);
      const easedProgress = easeOutQuart(clampedProgress);
      setDisplayedTotalProgress(targetTotalProgress * easedProgress);

      if (clampedProgress < 1) {
        animationFrameRef.current = window.requestAnimationFrame((nextNow) =>
          step(startTime, nextNow)
        );
        return;
      }

      setDisplayedTotalProgress(targetTotalProgress);
      animationFrameRef.current = null;
    };

    animationFrameRef.current = window.requestAnimationFrame((startTime) =>
      step(startTime, startTime)
    );

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [refreshToken, targetTotalProgress]);

  const baseStrokeLinecap =
    displayedOverflowProgress > 0.001 ? 'butt' : 'round';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id="emerald-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="orange-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="rose-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#emerald-gradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={baseOffset}
          strokeLinecap={baseStrokeLinecap}
        />

        {hasOverflow && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#${overflowGradientId})`}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={overflowOffset}
            strokeLinecap="round"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className={`text-2xl font-bold ${centerColor}`}>
          {percentage.toFixed(0)}%
        </div>
        <div className="mt-0.5 text-xs font-medium text-slate-600">
          {formatHoursValue(current)} 小时
        </div>
        <div className={`mt-0.5 text-[11px] ${detailColor}`}>
          约 {hoursToWorkloadRatio(current).toFixed(1)} 人天
        </div>
      </div>
    </div>
  );
}
