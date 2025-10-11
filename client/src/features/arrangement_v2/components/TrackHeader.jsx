/**
 * 🎛️ TRACK HEADER
 *
 * Individual track header with controls
 * - Track name, color indicator
 * - Mute, solo, lock buttons
 * - Volume and pan controls (compact)
 * - Double-click to rename
 * - Drag handle for reordering
 */

import React, { useState, useRef, useEffect } from 'react';
import './TrackHeader.css';

/**
 * TrackHeader component
 */
// Available colors for tracks
const TRACK_COLORS = [
  '#f43f5e', // Red
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Green
  '#f59e0b', // Orange
  '#ec4899', // Pink
  '#6366f1', // Indigo
];

export function TrackHeader({
  track,
  index,
  height = 80,
  onUpdate,
  onDoubleClick,
  onDragStart,
  isSelected = false
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(track.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef(null);
  const colorPickerRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return;

    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  // Handle name edit
  const handleNameDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(track.name);
  };

  const handleNameSubmit = () => {
    if (editValue.trim() && editValue !== track.name) {
      onUpdate?.({ name: editValue.trim() });
    }
    setIsEditing(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(track.name);
    }
  };

  // Toggle buttons
  const toggleMute = (e) => {
    e.stopPropagation();
    onUpdate?.({ muted: !track.muted });
  };

  const toggleSolo = (e) => {
    e.stopPropagation();
    onUpdate?.({ solo: !track.solo });
  };

  const toggleLock = (e) => {
    e.stopPropagation();
    onUpdate?.({ locked: !track.locked });
  };

  // Volume/Pan handlers
  const handleVolumeChange = (e) => {
    onUpdate?.({ volume: parseFloat(e.target.value) });
  };

  const handlePanChange = (e) => {
    onUpdate?.({ pan: parseFloat(e.target.value) });
  };

  // Color picker handlers
  const toggleColorPicker = (e) => {
    e.stopPropagation();
    setShowColorPicker(!showColorPicker);
  };

  const handleColorSelect = (color) => {
    onUpdate?.({ color });
    setShowColorPicker(false);
  };

  return (
    <div
      className={`arr-v2-track-header ${isSelected ? 'selected' : ''}`}
      style={{ height: `${height}px` }}
      onDoubleClick={onDoubleClick}
    >
      {/* Color indicator */}
      <div
        className="arr-v2-track-color"
        style={{ backgroundColor: track.color }}
      />

      {/* Main content */}
      <div className="arr-v2-track-content">
        {/* Drag handle */}
        <div
          className="arr-v2-track-drag-handle"
          onMouseDown={onDragStart}
          title="Drag to reorder"
        >
          <span>⋮⋮</span>
        </div>

        {/* Track name with color picker */}
        <div className="arr-v2-track-name-container">
          <div className="arr-v2-track-name-row">
            {/* Color picker button */}
            <div className="arr-v2-track-color-picker-wrapper">
              <button
                className="arr-v2-track-color-btn"
                style={{ backgroundColor: track.color }}
                onClick={toggleColorPicker}
                title="Change track color"
              />

              {/* Color picker dropdown */}
              {showColorPicker && (
                <div ref={colorPickerRef} className="arr-v2-color-picker-dropdown">
                  {TRACK_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`arr-v2-color-option ${track.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleColorSelect(color)}
                      title={color}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Track name */}
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                className="arr-v2-track-name-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleNameKeyDown}
              />
            ) : (
              <div
                className="arr-v2-track-name"
                onDoubleClick={handleNameDoubleClick}
                title="Double-click to rename"
              >
                {track.name}
              </div>
            )}
          </div>
        </div>

        {/* Control buttons */}
        <div className="arr-v2-track-buttons">
          <button
            className={`arr-v2-track-btn ${track.muted ? 'active' : ''}`}
            onClick={toggleMute}
            title="Mute track"
          >
            M
          </button>
          <button
            className={`arr-v2-track-btn ${track.solo ? 'active' : ''}`}
            onClick={toggleSolo}
            title="Solo track"
          >
            S
          </button>
          <button
            className={`arr-v2-track-btn ${track.locked ? 'active' : ''}`}
            onClick={toggleLock}
            title="Lock track"
          >
            L
          </button>
        </div>

        {/* Volume control */}
        <div className="arr-v2-track-control">
          <label className="arr-v2-track-control-label">Vol</label>
          <input
            type="range"
            className="arr-v2-track-slider"
            min="0"
            max="2"
            step="0.01"
            value={track.volume}
            onChange={handleVolumeChange}
            title={`Volume: ${Math.round(track.volume * 100)}%`}
          />
          <span className="arr-v2-track-control-value">
            {Math.round(track.volume * 100)}
          </span>
        </div>

        {/* Pan control */}
        <div className="arr-v2-track-control">
          <label className="arr-v2-track-control-label">Pan</label>
          <input
            type="range"
            className="arr-v2-track-slider"
            min="-1"
            max="1"
            step="0.01"
            value={track.pan}
            onChange={handlePanChange}
            title={`Pan: ${track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}${Math.abs(Math.round(track.pan * 100))}`}
          />
          <span className="arr-v2-track-control-value">
            {track.pan === 0 ? 'C' : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : `L${Math.abs(Math.round(track.pan * 100))}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TrackHeader;
