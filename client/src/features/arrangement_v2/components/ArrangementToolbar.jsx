/**
 * 🛠️ ARRANGEMENT TOOLBAR
 *
 * Main toolbar for ArrangementV2
 * - Tool selection (Select, Delete, Split, etc.)
 * - Snap settings
 * - Zoom controls
 * - Transport controls
 */

import React from 'react';
import './ArrangementToolbar.css';

export function ArrangementToolbar({
  activeTool,
  onToolChange,
  snapEnabled,
  snapSize,
  onSnapToggle,
  onSnapSizeChange,
  zoomX,
  zoomY,
  onZoomChange,
  onFitToView
}) {
  const tools = [
    { id: 'select', label: 'Select', icon: '⬚', shortcut: 'V' },
    { id: 'delete', label: 'Delete', icon: '🗑️', shortcut: 'D', tooltip: 'Hold right-click to delete' },
    { id: 'split', label: 'Split', icon: '✂️', shortcut: 'S' },
    { id: 'draw', label: 'Draw', icon: '✏️', shortcut: 'P' }
  ];

  const snapSizes = [0.25, 0.5, 1, 2, 4];

  return (
    <div className="arr-v2-toolbar">
      {/* Left: Brand + Tools */}
      <div className="arr-v2-toolbar-section">
        <div className="arr-v2-brand">
          <span className="arr-v2-brand-text">Arrangement</span>
        </div>

        <div className="arr-v2-toolbar-group">
          {tools.map(tool => (
            <button
              key={tool.id}
              className={`arr-v2-toolbar-btn ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => onToolChange(tool.id)}
              title={`${tool.label} (${tool.shortcut})${tool.tooltip ? ` - ${tool.tooltip}` : ''}`}
            >
              <span className="arr-v2-toolbar-btn-icon">{tool.icon}</span>
              <span className="arr-v2-toolbar-btn-label">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Snap + Zoom */}
      <div className="arr-v2-toolbar-section arr-v2-toolbar-section-right">
        {/* Snap Settings */}
        <div className="arr-v2-setting-item">
          <button
            className={`arr-v2-toolbar-btn ${snapEnabled ? 'active' : ''}`}
            onClick={onSnapToggle}
            title="Toggle Snap (Alt+S)"
          >
            <span className="arr-v2-toolbar-btn-icon">🧲</span>
            <span className="arr-v2-toolbar-btn-label">Snap</span>
          </button>

          {snapEnabled && (
            <>
              <label htmlFor="snap-select" className="arr-v2-setting-label">Grid:</label>
              <select
                id="snap-select"
                className="arr-v2-toolbar-select"
                value={snapSize}
                onChange={(e) => onSnapSizeChange(parseFloat(e.target.value))}
                title="Snap Size"
              >
                {snapSizes.map(size => (
                  <option key={size} value={size}>
                    {size >= 1 ? `${size} beat${size > 1 ? 's' : ''}` : `1/${1/size}`}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="arr-v2-toolbar-group">
          <button
            className="arr-v2-toolbar-btn arr-v2-toolbar-btn-icon-only"
            onClick={() => onZoomChange(zoomX * 0.8, zoomY)}
            title="Zoom Out (Ctrl+-)"
          >
            <span className="arr-v2-toolbar-btn-icon">−</span>
          </button>

          <div className="arr-v2-toolbar-zoom-display" title="Current Zoom">
            {(zoomX * 100).toFixed(0)}%
          </div>

          <button
            className="arr-v2-toolbar-btn arr-v2-toolbar-btn-icon-only"
            onClick={() => onZoomChange(zoomX * 1.25, zoomY)}
            title="Zoom In (Ctrl++)"
          >
            <span className="arr-v2-toolbar-btn-icon">+</span>
          </button>

          <button
            className="arr-v2-toolbar-btn arr-v2-toolbar-btn-icon-only"
            onClick={() => onZoomChange(1.0, 1.0)}
            title="Reset Zoom (Ctrl+0)"
          >
            <span className="arr-v2-toolbar-btn-icon">⟲</span>
          </button>

          <button
            className="arr-v2-toolbar-btn arr-v2-toolbar-btn-icon-only"
            onClick={onFitToView}
            title="Fit to View (F)"
          >
            <span className="arr-v2-toolbar-btn-icon">⛶</span>
          </button>
        </div>
      </div>
    </div>
  );
}
