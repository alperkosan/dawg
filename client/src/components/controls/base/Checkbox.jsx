/**
 * CHECKBOX COMPONENT v2.0
 * 
 * Category-themed checkbox with consistent styling
 * 
 * Usage:
 * <Checkbox
 *   checked={enabled}
 *   onChange={(checked) => setEnabled(checked)}
 *   label="Enable Feature"
 *   description="Optional description"
 *   category="dynamics-forge"
 * />
 */

import React from 'react';
import { getCategoryColors } from '@/components/plugins/PluginDesignSystem';

export const Checkbox = ({
  checked = false,
  onChange,
  label,
  description,
  category = 'dynamics-forge',
  disabled = false,
  className = '',
}) => {
  const categoryColors = getCategoryColors(category);
  
  const handleChange = (e) => {
    if (!disabled && onChange) {
      onChange(e.target.checked);
    }
  };

  return (
    <label 
      className={`flex items-center gap-3 cursor-pointer group ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="w-4 h-4 rounded transition-all appearance-none cursor-pointer"
        style={{
          border: `1px solid ${categoryColors.primary}30`,
          backgroundColor: checked ? categoryColors.primary : 'rgba(0, 0, 0, 0.5)',
          borderColor: checked ? categoryColors.primary : `${categoryColors.primary}30`,
          boxShadow: checked ? `0 0 8px ${categoryColors.primary}40` : 'none',
        }}
      />
      <div className="flex-1">
        {label && (
          <div 
            className="text-xs font-medium transition-colors"
            style={{
              color: checked ? categoryColors.primary : 'white',
            }}
          >
            {label}
          </div>
        )}
        {description && (
          <div className="text-[10px] text-white/40 mt-0.5">
            {description}
          </div>
        )}
      </div>
      
      {/* Custom checkmark */}
      {checked && (
        <svg
          className="absolute w-3 h-3 pointer-events-none"
          style={{
            left: '2px',
            top: '2px',
            color: '#fff',
          }}
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 6L5 9L10 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </label>
  );
};

