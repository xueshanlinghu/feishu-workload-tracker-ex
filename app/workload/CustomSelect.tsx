/**
 * 自定义下拉选择框组件
 * 使用Headless UI Listbox + 玻璃态设计
 * 支持搜索过滤和图标装饰
 */

'use client';

import { Fragment, useState, useRef, useEffect } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronsUpDown, Search, User, FileText } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: 'user' | 'file';
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  searchable?: boolean;
  showIcon?: boolean;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  label,
  disabled = false,
  searchable = true,
  showIcon = true,
}: CustomSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 计算下拉框应该向上还是向下弹出
  const calculateDirection = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 400; // 预估下拉框高度

      // 如果下方空间不足，向上弹出
      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        setDropdownDirection('up');
      } else {
        setDropdownDirection('down');
      }
    }
  };

  // 根据搜索查询过滤选项
  const filteredOptions = searchQuery === ''
    ? options
    : options.filter((option) =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // 获取选中的选项
  const selectedOption = options.find((opt) => opt.value === value);

  // 获取图标组件
  const getIcon = (iconType?: string) => {
    if (!showIcon || !iconType) return null;

    const iconClass = "w-5 h-5";
    switch (iconType) {
      case 'user':
        return <User className={iconClass} />;
      case 'file':
        return <FileText className={iconClass} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          {label}
        </label>
      )}

      <Listbox value={value} onChange={onChange} disabled={disabled}>
        {() => (
          <div className="relative">
            <Listbox.Button
              ref={buttonRef}
              onClick={calculateDirection}
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
                  {selectedOption && getIcon(selectedOption.icon)}
                  <span className={`block truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                  </span>
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
              </Listbox.Button>

            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options
                className={`absolute left-0 z-[9999] w-full bg-white border border-gray-200 rounded-2xl shadow-2xl focus:outline-none overflow-visible ${
                  dropdownDirection === 'down' ? 'mt-2' : 'bottom-full mb-2'
                }`}
              >
              {/* 搜索框 */}
              {searchable && (
                <div className="sticky top-0 bg-white border-b border-gray-200 p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="搜索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}

              {/* 选项列表 */}
              <div className="overflow-y-auto max-h-64 py-1">
                {filteredOptions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    没有找到匹配的选项
                  </div>
                ) : (
                  filteredOptions.map((option) => (
                    <Listbox.Option
                      key={option.value}
                      value={option.value}
                      className={({ active }) =>
                        `
                          relative cursor-pointer select-none py-3 px-4 mx-2 my-0.5 rounded-lg
                          transition-all duration-150
                          ${active
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-900'
                            : 'text-gray-900'
                          }
                        `
                      }
                    >
                      {({ selected, active }) => (
                        <div className="flex items-center gap-3">
                          {getIcon(option.icon)}
                          <span
                            className={`block truncate flex-1 ${
                              selected ? 'font-semibold' : 'font-medium'
                            }`}
                          >
                            {option.label}
                          </span>
                          {selected && (
                            <Check
                              className="h-5 w-5 text-blue-600"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      )}
                    </Listbox.Option>
                  ))
                )}
              </div>
            </Listbox.Options>
          </Transition>
          </div>
        )}
      </Listbox>
    </div>
  );
}
