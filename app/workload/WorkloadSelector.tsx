/**
 * 工时选择器组件
 *
 * 支持两种展示模式：
 * 1. inline: 直接展开 14 个工时选项，适合弹窗内精细编辑
 * 2. dropdown: 使用单行按钮触发弹出面板，适合列表区节省空间
 */

'use client';

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { ChevronsUpDown } from 'lucide-react';
import HoursMoodIcon, { getHoursMoodTone } from './HoursMoodIcon';
import {
  formatHoursValue,
  hoursToWorkloadRatio,
  MAX_DAILY_HOURS,
  MIN_RECORD_HOURS,
} from '@/lib/work-hours';

interface WorkloadSelectorProps {
  value: number; // 当前值，范围 1-14 小时
  onChange: (value: number) => void; // 值变化回调
  disabled?: boolean; // 是否禁用
  mode?: 'inline' | 'dropdown'; // 展示模式
}

interface PickerContentProps {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  onSelect?: () => void;
}

function PickerContent({
  value,
  onChange,
  disabled,
  onSelect,
}: PickerContentProps) {
  const [hoverHours, setHoverHours] = useState<number>(0);
  const previewHours = hoverHours || value;
  const hourSlots = Array.from(
    { length: MAX_DAILY_HOURS - MIN_RECORD_HOURS + 1 },
    (_, index) => index + MIN_RECORD_HOURS
  );
  const previewTone = previewHours > 0 ? getHoursMoodTone(previewHours) : null;

  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="grid grid-cols-7 gap-2">
        {hourSlots.map((hours) => {
          const highlighted = previewHours > 0 ? hours <= previewHours : false;
          const tone = getHoursMoodTone(hours);

          return (
            <button
              key={hours}
              type="button"
              onClick={() => {
                onChange(hours);
                onSelect?.();
              }}
              onMouseEnter={() => setHoverHours(hours)}
              onMouseLeave={() => setHoverHours(0)}
              disabled={disabled}
              className={`group flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-all duration-150 ${
                highlighted
                  ? 'scale-[1.02] bg-white shadow-sm'
                  : 'hover:bg-white/80'
              } ${!disabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              aria-label={`选择 ${hours} 小时，约 ${hoursToWorkloadRatio(hours).toFixed(1)} 人天`}
              title={`选择 ${hours} 小时（约 ${hoursToWorkloadRatio(hours).toFixed(1)} 人天）`}
            >
              <HoursMoodIcon
                hours={hours}
                active={highlighted}
                size={20}
                className="h-10 w-10"
              />
              <span
                className={`text-[11px] font-semibold ${
                  highlighted ? tone.iconClassName : 'text-slate-400'
                }`}
              >
                {hours}h
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-3">
          {previewTone ? (
            <HoursMoodIcon hours={previewHours} active={true} size={20} className="h-11 w-11" />
          ) : (
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-slate-400">
              -
            </span>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {previewHours > 0 ? `${formatHoursValue(previewHours)} 小时` : '请选择工时'}
            </p>
            <p className="text-xs text-slate-500">
              {previewHours > 0
                ? `约 ${hoursToWorkloadRatio(previewHours).toFixed(1)} 人天${previewTone ? ` · ${previewTone.label}` : ''}`
                : '1 天标准工时按 8 小时折算'}
            </p>
          </div>
        </div>
        {value > 0 && (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            已选 {formatHoursValue(value)}h
          </span>
        )}
      </div>
    </div>
  );
}

interface DropdownPanelProps extends PickerContentProps {
  open: boolean;
  direction: 'down' | 'up';
  calculateDropdownLayout: () => void;
}

function DropdownPanel({
  open,
  direction,
  calculateDropdownLayout,
  value,
  onChange,
  disabled,
  onSelect,
}: DropdownPanelProps) {
  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    calculateDropdownLayout();
  }, [calculateDropdownLayout, open]);

  return (
    <Transition
      as={Fragment}
      enter="transition ease-out duration-150"
      enterFrom={`opacity-0 ${direction === 'down' ? 'translate-y-1' : '-translate-y-1'} scale-95`}
      enterTo="opacity-100 translate-y-0 scale-100"
      leave="transition ease-in duration-100"
      leaveFrom="opacity-100 translate-y-0 scale-100"
      leaveTo={`opacity-0 ${direction === 'down' ? 'translate-y-1' : '-translate-y-1'} scale-95`}
    >
      <Popover.Panel
        className={`absolute right-0 z-30 w-[24rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl ${
          direction === 'down' ? 'mt-2' : 'bottom-full mb-2'
        }`}
      >
        <PickerContent
          value={value}
          onChange={onChange}
          disabled={disabled}
          onSelect={onSelect}
        />
      </Popover.Panel>
    </Transition>
  );
}

export default function WorkloadSelector({
  value,
  onChange,
  disabled = false,
  mode = 'inline',
}: WorkloadSelectorProps) {
  const selectedTone = value > 0 ? getHoursMoodTone(value) : null;
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 让工时下拉和左侧选择框保持一致：优先向下展开，空间不足时改为向上弹出
  const calculateDropdownLayout = useCallback(() => {
    if (typeof window === 'undefined' || !buttonRef.current) {
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedDropdownHeight = 360;

    if (spaceBelow < estimatedDropdownHeight && rect.top > estimatedDropdownHeight) {
      setDropdownDirection('up');
      return;
    }

    setDropdownDirection('down');
  }, []);

  useEffect(() => {
    if (mode !== 'dropdown') {
      return;
    }

    const handleResize = () => {
      calculateDropdownLayout();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateDropdownLayout, mode]);

  if (mode === 'inline') {
    return (
      <PickerContent
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  return (
    <Popover className="relative w-full min-w-0">
      {({ open, close }) => (
        <>
          <Popover.Button
            ref={buttonRef}
            onMouseDown={calculateDropdownLayout}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                calculateDropdownLayout();
              }
            }}
            disabled={disabled}
            className={`relative flex h-[50px] w-full items-center rounded-xl border bg-white px-4 text-left transition-all duration-200 ${
              disabled
                ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                : open
                  ? 'border-blue-400 shadow-md ring-2 ring-blue-100'
                  : 'border-gray-300 hover:border-blue-400 hover:shadow-sm'
            }`}
          >
            <span className="flex min-w-0 items-center gap-3 pr-8">
              {selectedTone ? (
                <HoursMoodIcon
                  hours={value}
                  active={true}
                  size={16}
                  className="h-7 w-7 flex-shrink-0"
                />
              ) : (
                <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-400">
                  h
                </span>
              )}
              <span
                className={`block min-w-0 truncate text-sm ${
                  value > 0
                    ? `font-medium ${selectedTone?.iconClassName || 'text-slate-700'}`
                    : 'text-gray-400'
                }`}
                title={
                  value > 0
                    ? `${formatHoursValue(value)} 小时，约 ${hoursToWorkloadRatio(value).toFixed(1)} 人天`
                    : '选择工时'
                }
              >
                {value > 0
                  ? `${formatHoursValue(value)} 小时 · 约 ${hoursToWorkloadRatio(value).toFixed(1)} 人天`
                  : '选择工时'}
              </span>
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronsUpDown
                className={`h-5 w-5 flex-shrink-0 ${disabled ? 'text-slate-300' : 'text-slate-400'}`}
              />
            </span>
          </Popover.Button>

          <DropdownPanel
            open={open}
            direction={dropdownDirection}
            calculateDropdownLayout={calculateDropdownLayout}
            value={value}
            onChange={onChange}
            disabled={disabled}
            onSelect={close}
          />
        </>
      )}
    </Popover>
  );
}
