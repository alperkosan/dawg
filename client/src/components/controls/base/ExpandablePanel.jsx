/**
 * EXPANDABLE PANEL COMPONENT
 *
 * Collapsible panel for progressive disclosure
 *
 * Features:
 * - Smooth expand/collapse animation
 * - Optional icon
 * - Category-based theming
 * - Keyboard accessible
 * - Controlled or uncontrolled
 */

import React, { useState } from 'react';
import { useControlTheme } from '../useControlTheme';

export const ExpandablePanel = ({
  title,
  defaultExpanded = false,
  expanded: controlledExpanded, // For controlled mode
  onExpandedChange,              // For controlled mode
  children,
  icon,
  category,
  variant = 'default',
  className = '',
}) => {
  const { colors } = useControlTheme(variant, category);

  // Uncontrolled state
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);

  // Use controlled if provided, otherwise uncontrolled
  const isExpanded = controlledExpanded !== undefined
    ? controlledExpanded
    : uncontrolledExpanded;

  const handleToggle = () => {
    if (controlledExpanded !== undefined) {
      // Controlled mode
      onExpandedChange?.(!isExpanded);
    } else {
      // Uncontrolled mode
      setUncontrolledExpanded(!isExpanded);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div
      className={`expandable-panel ${className}`}
      style={{
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: colors.background || 'rgba(255, 255, 255, 0.02)',
      }}
    >
      {/* Header */}
      <button
        className="panel-header"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        style={{
          width: '100%',
          padding: '12px 16px',
          backgroundColor: 'transparent',
          border: 'none',
          borderLeft: `3px solid ${colors.fill}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          transition: 'all 0.15s ease-out',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.backgroundHover || 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* Icon */}
        {icon && (
          <span className="panel-icon" style={{ fontSize: '14px', color: colors.fill }}>
            {icon}
          </span>
        )}

        {/* Title */}
        <span
          className="panel-title"
          style={{
            flex: 1,
            textAlign: 'left',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: colors.text,
          }}
        >
          {title}
        </span>

        {/* Chevron */}
        <span
          className={`panel-chevron ${isExpanded ? 'expanded' : ''}`}
          style={{
            fontSize: '10px',
            color: colors.textMuted,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease-out',
          }}
        >
          ▼
        </span>
      </button>

      {/* Content */}
      <div
        className={`panel-content ${isExpanded ? 'expanded' : 'collapsed'}`}
        style={{
          maxHeight: isExpanded ? '1000px' : '0',
          opacity: isExpanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <div
          className="panel-inner"
          style={{
            padding: isExpanded ? '12px 16px' : '0 16px',
            transition: 'padding 0.3s ease-in-out',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
