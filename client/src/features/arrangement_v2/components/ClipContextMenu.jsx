/**
 * 🎯 CLIP CONTEXT MENU
 *
 * Right-click context menu for clips in ArrangementV2
 * - Copy, Cut, Paste, Delete
 * - Duplicate, Split
 * - Rename, Color
 */

import React from 'react';
import './ClipContextMenu.css';

// Color palette for clips
const CLIP_COLORS = [
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
];

export function ClipContextMenu({
  x,
  y,
  clipIds,
  hasClipboard,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onDuplicate,
  onRename,
  onColorChange,
  onClose
}) {
  const isSingleClip = clipIds.length === 1;
  const isMultiClip = clipIds.length > 1;

  const handleAction = (action) => {
    action();
    onClose();
  };

  const handleColorChange = (color) => {
    onColorChange(color);
    onClose();
  };

  return (
    <div
      className="arr-v2-context-menu"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Clipboard operations */}
      <div className="arr-v2-context-menu-section">
        <button
          className="arr-v2-context-menu-item"
          onClick={() => handleAction(onCopy)}
        >
          <span className="arr-v2-context-menu-icon">📋</span>
          <span className="arr-v2-context-menu-label">Copy</span>
          <span className="arr-v2-context-menu-shortcut">Ctrl+C</span>
        </button>

        <button
          className="arr-v2-context-menu-item"
          onClick={() => handleAction(onCut)}
        >
          <span className="arr-v2-context-menu-icon">✂️</span>
          <span className="arr-v2-context-menu-label">Cut</span>
          <span className="arr-v2-context-menu-shortcut">Ctrl+X</span>
        </button>

        <button
          className="arr-v2-context-menu-item"
          onClick={() => handleAction(onPaste)}
          disabled={!hasClipboard}
        >
          <span className="arr-v2-context-menu-icon">📄</span>
          <span className="arr-v2-context-menu-label">Paste</span>
          <span className="arr-v2-context-menu-shortcut">Ctrl+V</span>
        </button>
      </div>

      {/* Edit operations */}
      <div className="arr-v2-context-menu-section">
        <button
          className="arr-v2-context-menu-item"
          onClick={() => handleAction(onDuplicate)}
        >
          <span className="arr-v2-context-menu-icon">📑</span>
          <span className="arr-v2-context-menu-label">Duplicate</span>
          <span className="arr-v2-context-menu-shortcut">Ctrl+D</span>
        </button>

        <button
          className="arr-v2-context-menu-item"
          onClick={() => handleAction(onDelete)}
        >
          <span className="arr-v2-context-menu-icon">🗑️</span>
          <span className="arr-v2-context-menu-label">Delete</span>
          <span className="arr-v2-context-menu-shortcut">Del</span>
        </button>
      </div>

      {/* Single clip operations */}
      {isSingleClip && (
        <div className="arr-v2-context-menu-section">
          <button
            className="arr-v2-context-menu-item"
            onClick={() => handleAction(onRename)}
          >
            <span className="arr-v2-context-menu-icon">✏️</span>
            <span className="arr-v2-context-menu-label">Rename</span>
            <span className="arr-v2-context-menu-shortcut">F2</span>
          </button>
        </div>
      )}

      {/* Color picker */}
      <div className="arr-v2-context-menu-section">
        <div className="arr-v2-context-menu-label" style={{ padding: '4px 12px', fontSize: '11px', opacity: 0.7 }}>
          Color
        </div>
        <div className="arr-v2-color-palette">
          {CLIP_COLORS.map(color => (
            <button
              key={color.value}
              className="arr-v2-color-swatch"
              style={{ backgroundColor: color.value }}
              onClick={() => handleColorChange(color.value)}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Multi-selection info */}
      {isMultiClip && (
        <div className="arr-v2-context-menu-info">
          {clipIds.length} clips selected
        </div>
      )}
    </div>
  );
}
