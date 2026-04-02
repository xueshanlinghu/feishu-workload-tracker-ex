import type { LucideIcon } from 'lucide-react';
import { Angry, Frown, Meh, Smile } from 'lucide-react';

interface ToneConfig {
  Icon: LucideIcon;
  iconClassName: string;
  containerClassName: string;
  inactiveIconClassName: string;
  label: string;
}

interface HoursMoodIconProps {
  hours: number;
  active?: boolean;
  size?: number;
  className?: string;
}

/**
 * 根据工时强度返回对应的情绪图标配置。
 *
 * 工时越高，情绪越疲惫，帮助用户更直观感受到负载压力。
 */
export function getHoursMoodTone(hours: number): ToneConfig {
  if (hours <= 4) {
    return {
      Icon: Smile,
      iconClassName: 'text-emerald-600',
      containerClassName: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-lime-100',
      inactiveIconClassName: 'text-emerald-300',
      label: '轻松',
    };
  }

  if (hours <= 8) {
    return {
      Icon: Meh,
      iconClassName: 'text-sky-600',
      containerClassName: 'border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-100',
      inactiveIconClassName: 'text-sky-300',
      label: '专注',
    };
  }

  if (hours <= 11) {
    return {
      Icon: Frown,
      iconClassName: 'text-orange-600',
      containerClassName: 'border-orange-200 bg-gradient-to-br from-orange-50 to-amber-100',
      inactiveIconClassName: 'text-orange-300',
      label: '忙碌',
    };
  }

  return {
    Icon: Angry,
    iconClassName: 'text-rose-600',
    containerClassName: 'border-rose-200 bg-gradient-to-br from-rose-50 to-red-100',
    inactiveIconClassName: 'text-rose-300',
    label: '超载',
  };
}

export default function HoursMoodIcon({
  hours,
  active = true,
  size = 18,
  className = '',
}: HoursMoodIconProps) {
  const tone = getHoursMoodTone(hours);
  const Icon = tone.Icon;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl border transition-all duration-200 ${
        active
          ? `${tone.containerClassName} shadow-sm`
          : 'border-slate-200 bg-white/80'
      } ${className}`}
    >
      <Icon
        size={size}
        strokeWidth={2.2}
        className={active ? tone.iconClassName : tone.inactiveIconClassName}
      />
    </span>
  );
}
