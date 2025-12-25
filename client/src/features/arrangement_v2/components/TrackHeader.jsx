/**
 * 🎛️ TRACK HEADER
 *
 * Individual track header with controls
 * - Track name, color indicator
 * - Mute, solo, lock buttons
 * - Volume and pan controls (compact)
 * - Double-click to rename
 * - Drag handle for reordering
 * 
 * ✅ PHASE 2: Design Consistency - Using component library
 */

import React, { useState, useRef, useEffect } from 'react';
// ✅ PHASE 2: Design Consistency - Using component library
import { Button } from '@/components/controls/base/Button';
import { Toggle } from '@/components/controls/base/Toggle';
import { Slider } from '@/components/controls/base/Slider';
import { Checkbox } from '@/components/controls/base/Checkbox';
import { GripVertical, Volume2, VolumeX, Headphones, Lock, TrendingUp } from 'lucide-react';
import './TrackHeader.css';

/**
 * TrackHeader component
 * ✅ PHASE 2: Design Consistency - Removed color palette, tracks use alternating dark-light Zenith theme
 */

export function TrackHeader({
  track,
  index,
  height = 80,
  onUpdate,
  onDoubleClick,
  onDragStart,
  isSelected = false,
  showAutomation = false, // ✅ NEW: Show automation lanes toggle
  onToggleAutomation // ✅ NEW: Callback for toggling automation
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(track.name);
  const inputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // ✅ PHASE 2: Color picker removed - tracks use alternating dark-light backgrounds

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

  // ✅ PHASE 2: Color picker handlers removed - tracks use alternating dark-light backgrounds

  // ✅ PHASE 2: Design Consistency - Alternating dark-light backgrounds
  const trackClassName = index % 2 === 0 ? 'track-even' : 'track-odd';

  return (
    <div
      className={`arr-v2-track-header ${trackClassName} ${isSelected ? 'selected' : ''}`}
      style={{ height: `${height}px` }}
      onDoubleClick={onDoubleClick}
    >
      {/* ✅ PHASE 2: Color indicator removed - tracks use alternating dark-light backgrounds */}

      {/* Main content */}
      <div className="arr-v2-track-content">
        {/* Drag handle */}
        <div
          className="arr-v2-track-drag-handle"
          onMouseDown={onDragStart}
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </div>

        {/* Track name - ✅ PHASE 2: Color picker removed */}
        <div className="arr-v2-track-name-container">
          <div className="arr-v2-track-name-row">
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

        {/* Control buttons - ✅ PHASE 2: Using Button component from library */}
        <div className="arr-v2-track-buttons">
          <Button
            active={track.muted}
            onClick={toggleMute}
            variant="default"
            size="sm"
            className="arr-v2-track-btn"
            title="Mute track"
          >
            {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </Button>
          <Button
            active={track.solo}
            onClick={toggleSolo}
            variant="default"
            size="sm"
            className="arr-v2-track-btn"
            title="Solo track"
          >
            <Headphones size={14} />
          </Button>
          <Button
            active={track.locked}
            onClick={toggleLock}
            variant="default"
            size="sm"
            className="arr-v2-track-btn"
            title="Lock track"
          >
            <Lock size={14} />
          </Button>
        </div>

        {/* Volume control - ✅ PHASE 2: Using component library Slider */}
        <div className="arr-v2-track-control">
          <label className="arr-v2-track-control-label">Vol</label>
          <Slider
            value={track.volume}
            min={0}
            max={2}
            step={0.01}
            onChange={(value) => onUpdate?.({ volume: value })}
            width={60}
            showValue={false}
            precision={0}
            variant="default"
            className="arr-v2-track-volume-slider"
          />
          <span className="arr-v2-track-control-value">
            {Math.round(track.volume * 100)}%
          </span>
        </div>

        {/* Pan control - ✅ PHASE 2: Using component library Slider (bipolar) */}
        <div className="arr-v2-track-control">
          <label className="arr-v2-track-control-label">Pan</label>
          <Slider
            value={track.pan}
            min={-1}
            max={1}
            step={0.01}
            bipolar={true}
            onChange={(value) => onUpdate?.({ pan: value })}
            width={60}
            showValue={false}
            precision={0}
            variant="default"
            className="arr-v2-track-pan-slider"
          />
          <span className="arr-v2-track-control-value">
            {track.pan === 0 ? 'C' : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : `L${Math.abs(Math.round(track.pan * 100))}`}
          </span>
        </div>

        {/* ✅ NEW: Automation toggle button */}
        {onToggleAutomation && (
          <div className="arr-v2-track-control">
            <Button
              active={showAutomation}
              onClick={(e) => {
                e.stopPropagation();
                onToggleAutomation();
              }}
              variant="default"
              size="sm"
              className="arr-v2-track-btn"
              title={showAutomation ? "Hide automation lanes" : "Show automation lanes"}
            >
              <TrendingUp size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrackHeader;
