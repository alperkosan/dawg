/**
 * SELECT COMPONENT v2.0
 * 
 * Category-themed select dropdown with consistent styling
 * 
 * Usage:
 * <Select
 *   value={selectedValue}
 *   onChange={(value) => setSelectedValue(value)}
 *   options={[{value: '1', label: 'Option 1'}]}
 *   category="dynamics-forge"
 * />
 */

import React from 'react';
import { getCategoryColors } from '@/components/plugins/PluginDesignSystem';

export const Select = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  label,
  category = 'dynamics-forge',
  disabled = false,
  className = '',
}) => {
  const categoryColors = getCategoryColors(category);

  const handleChange = (e) => {
    if (!disabled && onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <div className={className}>
      {label && (
        <label
          className="text-[10px] font-bold uppercase tracking-wider mb-2 block"
          style={{ color: `${categoryColors.secondary}cc` }}
        >
          {label}
        </label>
      )}
      <select
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        className="w-full text-xs text-white rounded px-2 py-1.5 transition-all outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          border: `1px solid ${categoryColors.primary}20`,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = categoryColors.primary;
          e.target.style.boxShadow = `0 0 8px ${categoryColors.primary}30`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = `${categoryColors.primary}20`;
          e.target.style.boxShadow = 'none';
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => {
          const optValue = typeof option === 'string' ? option : option.value;
          const optLabel = typeof option === 'string' ? option : option.label;
          return (
            <option
              key={optValue}
              value={optValue}
              style={{
                backgroundColor: '#1a1a1a',
                color: '#fff',
              }}
            >
              {optLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
};

