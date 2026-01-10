/**
 * 自定义日期选择器组件
 * 玻璃态设计的日历弹窗
 */

'use client';

import { Fragment, useState } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  label?: string;
  disabled?: boolean;
}

export default function CustomDatePicker({
  value,
  onChange,
  label,
  disabled = false,
}: CustomDatePickerProps) {
  // 将字符串日期转换为Date对象
  const selectedDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  // 获取当前月份的所有日期（包括前后填充）
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // 周一开始
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // 处理日期选择
  const handleDateSelect = (date: Date, close: () => void) => {
    const dateString = format(date, 'yyyy-MM-dd');
    onChange(dateString);
    close();
  };

  // 上一月
  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // 下一月
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // 回到今天
  const goToToday = (close?: () => void) => {
    const today = new Date();
    setCurrentMonth(today);
    const todayString = format(today, 'yyyy-MM-dd');
    onChange(todayString);
    if (close) close();
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          {label}
        </label>
      )}

      <Popover className="relative">
        {({ close }) => (
          <>
            <Popover.Button
              disabled={disabled}
              className={`
                relative w-full px-4 py-3
                bg-white border border-gray-300 rounded-xl
                text-left cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
                hover:border-blue-400
              `}
            >
              <span className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-500" />
                <span className="block truncate text-gray-900 font-medium">
                  {value ? format(selectedDate, 'yyyy年MM月dd日', { locale: zhCN }) : '选择日期'}
                </span>
              </span>
            </Popover.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <Popover.Panel
                className="absolute left-0 z-[9999] mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4"
              >
                {/* 月份导航 */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={previousMonth}
                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-600" />
                  </button>

                  <div className="font-semibold text-gray-900">
                    {format(currentMonth, 'yyyy年MM月', { locale: zhCN })}
                  </div>

                  <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  </button>
                </div>

                {/* 星期标题 */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-gray-500 py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* 日期网格 */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day, idx) => {
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = value && isSameDay(day, selectedDate);
                    const isTodayDate = isToday(day);

                    return (
                      <button
                        key={idx}
                        onClick={() => handleDateSelect(day, close)}
                        className={`
                          aspect-square p-2 text-sm rounded-lg
                          transition-all duration-150
                          ${!isCurrentMonth
                            ? 'text-gray-300 hover:text-gray-400'
                            : 'text-gray-900 hover:bg-blue-50'
                          }
                          ${isSelected
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 font-semibold shadow-md'
                            : ''
                          }
                          ${isTodayDate && !isSelected
                            ? 'ring-2 ring-blue-500 font-semibold'
                            : ''
                          }
                        `}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>

                {/* 底部快捷操作 */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                  <button
                    onClick={() => goToToday(close)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    今天
                  </button>
                  <button
                    onClick={() => close()}
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                  >
                    关闭
                  </button>
                </div>
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </div>
  );
}
