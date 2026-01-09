/**
 * 人力占用选择器组件
 *
 * 使用10个笑脸来表示人力占用（0.1-1.0）
 * - 初始状态：10个灰色笑脸
 * - 悬停预览：鼠标位置及左侧的笑脸高亮
 * - 点击确认：点亮的笑脸对应人力值
 */

'use client';

import { useState } from 'react';

interface WorkloadSelectorProps {
  value: number; // 当前值，范围 0.1-1.0
  onChange: (value: number) => void; // 值变化回调
  disabled?: boolean; // 是否禁用
}

export default function WorkloadSelector({ value, onChange, disabled = false }: WorkloadSelectorProps) {
  const [hoverIndex, setHoverIndex] = useState<number>(-1); // 悬停的笑脸索引（-1表示无悬停）

  // 将值转换为索引（0.1 -> 0, 0.5 -> 4, 1.0 -> 9）
  const valueToIndex = (val: number): number => {
    return Math.round(val * 10) - 1;
  };

  // 将索引转换为值（0 -> 0.1, 4 -> 0.5, 9 -> 1.0）
  const indexToValue = (index: number): number => {
    return (index + 1) / 10;
  };

  // 当前选中的索引
  const selectedIndex = valueToIndex(value);

  // 点击笑脸
  const handleClick = (index: number) => {
    const newValue = indexToValue(index);
    onChange(newValue);
  };

  // 鼠标进入
  const handleMouseEnter = (index: number) => {
    setHoverIndex(index);
  };

  // 鼠标离开
  const handleMouseLeave = () => {
    setHoverIndex(-1);
  };

  // 判断某个笑脸是否应该高亮
  const isHighlighted = (index: number): boolean => {
    // 如果正在悬停，使用悬停位置
    if (hoverIndex >= 0) {
      return index <= hoverIndex;
    }
    // 否则使用已选中的值
    return index <= selectedIndex;
  };

  // 生成10个笑脸
  const smiles = Array.from({ length: 10 }, (_, i) => i);

  return (
    <div className={`flex items-center gap-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {smiles.map((_, index) => {
        const highlighted = isHighlighted(index);

        // 根据高亮状态选择不同的笑脸
        let smileEmoji = '😶';
        if (highlighted) {
          if (index <= 2) {
            smileEmoji = '🙂';
          } else if (index <= 5) {
            smileEmoji = '😊';
          } else if (index <= 7) {
            smileEmoji = '😄';
          } else {
            smileEmoji = '🤩';
          }
        }

        return (
          <button
            key={index}
            type="button"
            onClick={() => handleClick(index)}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
            disabled={disabled}
            className={`text-2xl transition-all duration-150 ease-in-out transform hover:scale-125 ${
              highlighted
                ? 'filter drop-shadow-lg'
                : 'opacity-30 grayscale'
            } ${!disabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            aria-label={`选择${indexToValue(index).toFixed(1)}人力`}
            title={`${indexToValue(index).toFixed(1)}人力`}
          >
            {smileEmoji}
          </button>
        );
      })}

      {/* 显示当前值 */}
      <span className="ml-3 text-sm font-medium text-gray-600 min-w-[60px]">
        {value > 0 ? value.toFixed(1) : '-'}
      </span>
    </div>
  );
}
