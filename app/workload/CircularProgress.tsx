/**
 * 环形进度图组件
 * 用于可视化展示当天工时占比
 */

'use client';

import { formatHoursValue, hoursToWorkloadRatio } from '@/lib/work-hours';

interface CircularProgressProps {
  /** 当前小时数 */
  current: number;
  /** 最大小时数 */
  max: number;
  /** 圆环大小 */
  size?: number;
  /** 圆环粗细 */
  strokeWidth?: number;
}

export default function CircularProgress({
  current,
  max,
  size = 120,
  strokeWidth = 10,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeMax = max > 0 ? max : 1;
  const percentage = Math.min((current / safeMax) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 90) return '#e11d48'; // rose-600 - 超载
    if (percentage >= 70) return '#ea580c'; // orange-600 - 高负载
    if (percentage >= 40) return '#0284c7'; // sky-600 - 中等负载
    return '#059669'; // emerald-600 - 轻松
  };

  const getGradientId = () => {
    if (percentage >= 90) return 'rose-gradient';
    if (percentage >= 70) return 'orange-gradient';
    if (percentage >= 40) return 'sky-gradient';
    return 'emerald-gradient';
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id="emerald-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="sky-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
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
          stroke={`url(#${getGradientId()})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-2xl font-bold" style={{ color: getColor() }}>
          {percentage.toFixed(0)}%
        </div>
        <div className="mt-0.5 text-xs font-medium text-slate-600">
          {formatHoursValue(current)} / {formatHoursValue(max)} 小时
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          约 {hoursToWorkloadRatio(current).toFixed(1)} / {hoursToWorkloadRatio(max).toFixed(1)} 人天
        </div>
      </div>
    </div>
  );
}
