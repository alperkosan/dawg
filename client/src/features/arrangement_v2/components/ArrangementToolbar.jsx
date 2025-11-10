/**
 * 🛠️ ARRANGEMENT TOOLBAR
 *
 * Main toolbar for ArrangementV2
 * - Tool selection (Select, Delete, Split, etc.)
 * - Snap settings
 * - Zoom controls
 * - Transport controls
 * 
 * ✅ PHASE 2: Design Consistency - Using component library
 */

import React from 'react';
import { Button } from '@/components/controls/base/Button';
import { Select } from '@/components/controls/base/Select';
import { Toggle } from '@/components/controls/base/Toggle';
import { MousePointer, Scissors, Trash2, Pencil, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
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
  // ✅ PHASE 2: Design Consistency - Tool definitions with icons
  const tools = [
    { id: 'select', label: 'Select', icon: MousePointer, shortcut: 'V' },
    { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'D', tooltip: 'Hold right-click to delete' },
    { id: 'split', label: 'Split', icon: Scissors, shortcut: 'S' },
    { id: 'draw', label: 'Draw', icon: Pencil, shortcut: 'P' }
  ];

  // Snap size options
  const snapSizeOptions = [
    { value: 0.25, label: '1/4 beat' },
    { value: 0.5, label: '1/2 beat' },
    { value: 1, label: '1 beat' },
    { value: 2, label: '2 beats' },
    { value: 4, label: '4 beats' }
  ];

  return (
    <div className="arr-v2-toolbar">
      {/* Left: Brand + Tools */}
      <div className="arr-v2-toolbar-section">
        <div className="arr-v2-brand">
          <span className="arr-v2-brand-text">Arrangement</span>
        </div>

        {/* ✅ PHASE 2: Tool buttons - using Button component from library */}
        <div className="arr-v2-toolbar-group">
          {tools.map(tool => {
            const Icon = tool.icon;
            return (
              <Button
                key={tool.id}
                active={activeTool === tool.id}
                onClick={() => onToolChange(tool.id)}
                variant="default"
                size="sm"
                className="arr-v2-toolbar-btn"
                title={`${tool.label} (${tool.shortcut})${tool.tooltip ? ` - ${tool.tooltip}` : ''}`}
              >
                <Icon size={18} />
                <span className="arr-v2-toolbar-btn-label">{tool.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Right: Snap + Zoom */}
      <div className="arr-v2-toolbar-section arr-v2-toolbar-section-right">
        {/* Snap Settings */}
        <div className="arr-v2-setting-item">
          <label htmlFor="snap-toggle" className="arr-v2-setting-label">Snap:</label>
          <Toggle
            value={snapEnabled}
            onChange={onSnapToggle}
            size="sm"
            variant="default"
            className="arr-v2-snap-toggle"
          />
          
          {snapEnabled && (
            <Select
              value={snapSize.toString()}
              onChange={(value) => onSnapSizeChange(parseFloat(value))}
              options={snapSizeOptions}
              className="arr-v2-snap-select"
              category="dynamics-forge"
            />
          )}
        </div>

        {/* Zoom Controls - ✅ PHASE 2: Using Button component from library */}
        <div className="arr-v2-toolbar-group">
          <Button
            onClick={() => onZoomChange(zoomX * 0.8, zoomY)}
            variant="default"
            size="sm"
            className="arr-v2-toolbar-btn-icon-only"
            title="Zoom Out (Ctrl+-)"
          >
            <ZoomOut size={16} />
          </Button>

          <div className="arr-v2-toolbar-zoom-display" title="Current Zoom">
            {(zoomX * 100).toFixed(0)}%
          </div>

          <Button
            onClick={() => onZoomChange(zoomX * 1.25, zoomY)}
            variant="default"
            size="sm"
            className="arr-v2-toolbar-btn-icon-only"
            title="Zoom In (Ctrl++)"
          >
            <ZoomIn size={16} />
          </Button>

          <Button
            onClick={() => onZoomChange(1.0, 1.0)}
            variant="default"
            size="sm"
            className="arr-v2-toolbar-btn-icon-only"
            title="Reset Zoom (Ctrl+0)"
          >
            <RotateCcw size={16} />
          </Button>

          <Button
            onClick={onFitToView}
            variant="default"
            size="sm"
            className="arr-v2-toolbar-btn-icon-only"
            title="Fit to View (F)"
          >
            <Maximize2 size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
