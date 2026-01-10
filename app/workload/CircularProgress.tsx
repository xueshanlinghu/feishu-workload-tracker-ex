/**
 * 环形进度图组件
 * 用于可视化展示人力占用比例
 */

'use client';

interface CircularProgressProps {
  /** 当前值 */
  current: number;
  /** 最大值 */
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
  const percentage = Math.min((current / max) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;

  // 根据占用程度决定颜色
  const getColor = () => {
    if (percentage >= 90) return '#ef4444'; // red-500 - 饱和
    if (percentage >= 70) return '#f97316'; // orange-500 - 接近饱和
    if (percentage >= 40) return '#3b82f6'; // blue-500 - 适中
    return '#22c55e'; // green-500 - 轻松
  };

  const getGradientId = () => {
    if (percentage >= 90) return 'red-gradient';
    if (percentage >= 70) return 'orange-gradient';
    if (percentage >= 40) return 'blue-gradient';
    return 'green-gradient';
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          {/* 绿色渐变 */}
          <linearGradient id="green-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          {/* 蓝色渐变 */}
          <linearGradient id="blue-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          {/* 橙色渐变 */}
          <linearGradient id="orange-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          {/* 红色渐变 */}
          <linearGradient id="red-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>

        {/* 背景圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* 进度圆环 */}
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

      {/* 中心文字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold" style={{ color: getColor() }}>
          {percentage.toFixed(0)}%
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {current.toFixed(1)} / {max.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
