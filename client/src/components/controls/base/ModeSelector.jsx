/**
 * MODE SELECTOR COMPONENT
 *
 * Segmented button group for mode selection
 *
 * Features:
 * - Horizontal/vertical orientation
 * - Icon support
 * - Tooltip descriptions
 * - Active indicator animation
 * - Category-based theming
 * - Keyboard navigation
 */

import React, { useState, useRef, useEffect } from 'react';
import { useControlTheme } from '../useControlTheme';

export const ModeSelector = ({
  modes = [],              // Array of { id, label, icon?, description? }
  activeMode,
  onChange,
  orientation = 'horizontal', // 'horizontal' | 'vertical'
  compact = false,         // Icon-only mode
  allowDeselect = false,   // Allow clicking active mode to deselect
  category,                // Plugin category for theming
  variant = 'default',
  className = '',
}) => {
  const { colors } = useControlTheme(variant, category);
  const [hoveredMode, setHoveredMode] = useState(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const buttonRefs = useRef({});
  const containerRef = useRef(null);

  if (!modes || modes.length === 0) {
    return null;
  }

  const handleClick = (modeId) => {
    if (allowDeselect && activeMode === modeId) {
      onChange(null);
    } else {
      onChange(modeId);
    }
  };

  const handleKeyDown = (e, modeId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(modeId);
    }
  };

  // Calculate indicator position based on actual button positions
  useEffect(() => {
    if (!activeMode || !buttonRefs.current[activeMode] || !containerRef.current) {
      return;
    }

    const activeButton = buttonRefs.current[activeMode];
    const container = containerRef.current;

    const buttonRect = activeButton.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    if (orientation === 'horizontal') {
      setIndicatorStyle({
        position: 'absolute',
        backgroundColor: colors.fill,
        borderRadius: '6px',
        transition: 'all 0.2s ease-out',
        pointerEvents: 'none',
        zIndex: 0,
        left: `${buttonRect.left - containerRect.left}px`,
        width: `${buttonRect.width}px`,
        top: '4px',
        bottom: '4px',
      });
    } else {
      setIndicatorStyle({
        position: 'absolute',
        backgroundColor: colors.fill,
        borderRadius: '6px',
        transition: 'all 0.2s ease-out',
        pointerEvents: 'none',
        zIndex: 0,
        top: `${buttonRect.top - containerRect.top}px`,
        height: `${buttonRect.height}px`,
        left: '4px',
        right: '4px',
      });
    }
  }, [activeMode, modes, orientation, colors.fill]);

  // Update indicator on window resize
  useEffect(() => {
    const updateIndicator = () => {
      if (!activeMode || !buttonRefs.current[activeMode] || !containerRef.current) {
        return;
      }

      const activeButton = buttonRefs.current[activeMode];
      const container = containerRef.current;

      const buttonRect = activeButton.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      if (orientation === 'horizontal') {
        setIndicatorStyle(prev => ({
          ...prev,
          left: `${buttonRect.left - containerRect.left}px`,
          width: `${buttonRect.width}px`,
        }));
      } else {
        setIndicatorStyle(prev => ({
          ...prev,
          top: `${buttonRect.top - containerRect.top}px`,
          height: `${buttonRect.height}px`,
        }));
      }
    };

    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeMode, orientation]);

  return (
    <div
      ref={containerRef}
      className={`mode-selector ${orientation} ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: orientation === 'horizontal' ? 'row' : 'column',
        gap: '2px',
        padding: '4px',
        backgroundColor: colors.track,
        borderRadius: '8px',
        position: 'relative',
      }}
      role="radiogroup"
      aria-label="Mode selection"
    >
      {/* Active indicator (animated underline/background) */}
      {activeMode && indicatorStyle.left !== undefined && (
        <div style={indicatorStyle} />
      )}

      {/* Mode buttons */}
      {modes.map((mode, index) => {
        const isActive = activeMode === mode.id;
        const isHovered = hoveredMode === mode.id;

        return (
          <button
            key={mode.id}
            ref={(el) => (buttonRefs.current[mode.id] = el)}
            className={`mode-button ${isActive ? 'active' : ''}`}
            onClick={() => handleClick(mode.id)}
            onMouseEnter={() => setHoveredMode(mode.id)}
            onMouseLeave={() => setHoveredMode(null)}
            onKeyDown={(e) => handleKeyDown(e, mode.id)}
            title={mode.description}
            role="radio"
            aria-checked={isActive}
            style={{
              position: 'relative',
              zIndex: 1,
              padding: compact ? '8px' : '8px 16px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              color: isActive ? '#fff' : colors.textMuted,
              fontSize: '12px',
              fontWeight: isActive ? 600 : 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              minWidth: compact ? 'auto' : '60px',
              outline: 'none',
              ...(isHovered && !isActive && {
                color: colors.text,
              }),
            }}
          >
            {mode.icon && (
              <span className="mode-icon" style={{ fontSize: '14px' }}>
                {mode.icon}
              </span>
            )}
            {!compact && <span className="mode-label">{mode.label}</span>}
          </button>
        );
      })}

      {/* Tooltip for hovered mode */}
      {hoveredMode && modes.find(m => m.id === hoveredMode)?.description && (
        <div
          className="mode-tooltip"
          style={{
            position: 'absolute',
            [orientation === 'horizontal' ? 'top' : 'left']: '100%',
            [orientation === 'horizontal' ? 'marginTop' : 'marginLeft']: '8px',
            padding: '6px 12px',
            backgroundColor: colors.surface || '#2a2a2a',
            borderRadius: '6px',
            fontSize: '11px',
            color: colors.text,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {modes.find(m => m.id === hoveredMode).description}
        </div>
      )}
    </div>
  );
};
