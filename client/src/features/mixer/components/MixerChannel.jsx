/**
 * MIXER CHANNEL V2
 *
 * Clean channel strip with:
 * - Real-time dB meter
 * - Vertical fader
 * - Pan knob
 * - Mute/Solo buttons
 * - Simple insert routing selector
 * - Send Accept Button (target-based routing)
 */

import React, { useState, useRef, useEffect, memo } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { Volume2, VolumeX, Headphones, Radio } from 'lucide-react';
import { Fader } from '@/components/controls/base/Fader';
import { Knob } from '@/components/controls/base/Knob';
import { ChannelMiniMeter } from './ChannelMeter';
import { SendAcceptButton } from './SendAcceptButton';
import './MixerChannel.css';

const MixerChannelComponent = ({
  track,
  allTracks,
  isActive,
  isMaster,
  onClick,
  activeTrack,
  isVisible = true
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(track.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const colorPickerRef = useRef(null);
  const colorBarRef = useRef(null);

  // ✅ Throttle refs for performance
  const volumeThrottleRef = useRef(null);
  const panThrottleRef = useRef(null);
  const lastVolumeRef = useRef(null);
  const lastPanRef = useRef(null);

  const {
    handleMixerParamChange,
    toggleMute,
    toggleSolo,
    toggleMono,
    setTrackName,
    setTrackColor,
    mutedChannels,
    soloedChannels,
    monoChannels
  } = useMixerStore();

  // ✅ Throttled parameter update (16ms = 60fps max)
  const handleThrottledParamChange = (trackId, param, value) => {
    const throttleRef = param === 'volume' ? volumeThrottleRef : panThrottleRef;
    const lastValueRef = param === 'volume' ? lastVolumeRef : lastPanRef;

    // Store the latest value
    lastValueRef.current = value;

    // Skip if already scheduled
    if (throttleRef.current) return;

    // Schedule update
    throttleRef.current = requestAnimationFrame(() => {
      handleMixerParamChange(trackId, param, lastValueRef.current);
      throttleRef.current = null;
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (volumeThrottleRef.current) {
        cancelAnimationFrame(volumeThrottleRef.current);
      }
      if (panThrottleRef.current) {
        cancelAnimationFrame(panThrottleRef.current);
      }
    };
  }, []);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
        setShowColorPicker(false);
      }
    };

    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker]);

  const volume = track.volume !== undefined ? track.volume : 0;
  // Pan: stored as -1 to 1 (Web Audio API standard), displayed as -100 to 100 (user-friendly)
  const panNormalized = track.pan !== undefined ? track.pan : 0;
  const panDisplay = Math.round(panNormalized * 100);
  const isMuted = mutedChannels?.has(track.id) || false;
  const isSolo = soloedChannels?.has(track.id) || false;
  const isMono = monoChannels?.has(track.id) || false;

  // Pan label helper
  const getPanLabel = (panValue) => {
    if (panValue === 0) return 'C';
    if (panValue > 0) return `R${Math.round(panValue * 100)}`;
    return `L${Math.round(-panValue * 100)}`;
  };

  // Preset colors for quick selection
  const presetColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b'
  ];

  const handleNameDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditingName(true);
    setEditedName(track.name);
  };

  const handleNameChange = (e) => {
    setEditedName(e.target.value);
  };

  const handleNameBlur = () => {
    if (editedName.trim() && editedName !== track.name) {
      setTrackName(track.id, editedName.trim());
    } else {
      setEditedName(track.name);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setEditedName(track.name);
      setIsEditingName(false);
    }
  };

  const handleColorClick = (e) => {
    e.stopPropagation();

    if (!showColorPicker && colorBarRef.current) {
      const rect = colorBarRef.current.getBoundingClientRect();
      const pickerWidth = 172; // Actual width: 160px + 8px padding + 4px border
      const pickerHeight = 130; // Actual height with padding

      // Get mixer panel container boundaries
      const mixerPanel = colorBarRef.current.closest('.workspace-panel__content') ||
                         colorBarRef.current.closest('.mixer-2');
      const panelRect = mixerPanel ? mixerPanel.getBoundingClientRect() : {
        left: 0,
        right: window.innerWidth,
        top: 0,
        bottom: window.innerHeight
      };

      // ✅ Simple strategy: Stick to color bar, minimal offset
      let left = rect.left - 2; // Slight left offset for visual alignment
      let top = rect.bottom + 2; // Minimal gap

      // ✅ Constrain to panel boundaries
      const minLeft = panelRect.left + 4;
      const maxLeft = panelRect.right - pickerWidth - 4;
      const minTop = panelRect.top + 4;
      const maxBottom = panelRect.bottom - 4;

      // Horizontal: clamp to panel
      left = Math.max(minLeft, Math.min(left, maxLeft));

      // Vertical: if doesn't fit below, try above
      if (top + pickerHeight > maxBottom) {
        const topAbove = rect.top - pickerHeight - 2;
        if (topAbove >= minTop) {
          top = topAbove;
        } else {
          // Clamp to panel top if nowhere to go
          top = Math.max(minTop, Math.min(top, maxBottom - pickerHeight));
        }
      }

      setPickerPosition({ top, left });
    }

    setShowColorPicker(!showColorPicker);
  };

  const handleColorSelect = (color) => {
    setTrackColor(track.id, color);
    setShowColorPicker(false);
  };

  return (
    <div
      className={`mixer-channel-2 ${isActive ? 'mixer-channel-2--active' : ''} ${isMaster ? 'mixer-channel-2--master' : ''}`}
      onClick={onClick}
      data-channel-id={track.id}
    >
      {/* Header */}
      <div className="mixer-channel-2__header">
        <div className="mixer-channel-2__color-container">
          <div
            ref={colorBarRef}
            className="mixer-channel-2__color"
            style={{ backgroundColor: track.color || '#4b5563' }}
            onClick={handleColorClick}
            title="Click to change color"
          />
          {showColorPicker && (
            <div
              ref={colorPickerRef}
              className="mixer-channel-2__color-picker"
              style={{
                position: 'fixed',
                top: `${pickerPosition.top}px`,
                left: `${pickerPosition.left}px`
              }}
            >
              <div className="mixer-channel-2__color-grid">
                {presetColors.map(color => (
                  <button
                    key={color}
                    className={`mixer-channel-2__color-swatch ${track.color === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorSelect(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mixer-channel-2__name-container">
          {isEditingName ? (
            <input
              type="text"
              className="mixer-channel-2__name-input"
              value={editedName}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="mixer-channel-2__name"
              onDoubleClick={handleNameDoubleClick}
              title="Double-click to edit"
            >
              {track.name}
            </div>
          )}
        </div>
      </div>

      {/* Real-time Meter */}
      <div className="mixer-channel-2__meter-container">
        <ChannelMiniMeter trackId={track.id} isVisible={isVisible} />
      </div>

      {/* Fader */}
      <div className="mixer-channel-2__fader-container">
        <Fader
          value={volume}
          min={-60}
          max={12}
          defaultValue={0}
          onChange={(value) => handleThrottledParamChange(track.id, 'volume', value)}
          height={120}
          width={30}
          variant="mixer"
          showValue={false}
          unit="dB"
          precision={1}
        />
      </div>

      {/* Volume Label */}
      <div className="mixer-channel-2__volume-label">
        {volume > 0 ? '+' : ''}{volume.toFixed(1)}
      </div>

      {/* Pan Knob */}
      <div className="mixer-channel-2__pan-container">
        <Knob
          value={panDisplay}
          min={-100}
          max={100}
          defaultValue={0}
          onChange={(value) => {
            // Convert display value (-100 to 100) to Web Audio API range (-1 to 1)
            const normalizedPan = value / 100;
            handleThrottledParamChange(track.id, 'pan', normalizedPan);
          }}
          size={36}
          unit=""
          precision={0}
          variant="mixer"
          showValue={false}
        />
        <div className="mixer-channel-2__pan-label">
          {getPanLabel(panNormalized)}
        </div>
      </div>

      {/* Mute/Solo/Mono Controls */}
      <div className="mixer-channel-2__controls">
        <button
          className={`mixer-channel-2__btn mixer-channel-2__btn--mute ${isMuted ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMute(track.id);
          }}
          title="Mute"
        >
          {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>

        <button
          className={`mixer-channel-2__btn mixer-channel-2__btn--solo ${isSolo ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleSolo(track.id);
          }}
          title="Solo"
        >
          <Headphones size={12} />
        </button>

        <button
          className={`mixer-channel-2__btn mixer-channel-2__btn--mono ${isMono ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMono(track.id);
          }}
          title={isMono ? "Stereo" : "Mono"}
        >
          <Radio size={12} />
        </button>
      </div>

      {/* Send Accept Button - Target-based routing */}
      <SendAcceptButton targetTrack={track} sourceTrack={activeTrack} />
    </div>
  );
};

// ✅ PERFORMANCE: Memoize component with custom equality check
// Only re-render when these specific props change
export const MixerChannel = memo(MixerChannelComponent, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  // Return false if props are different (do re-render)

  // ✅ CRITICAL: Check activeTrack.sends changes (for SendAcceptButton reactivity)
  const prevActiveSends = prevProps.activeTrack?.sends || [];
  const nextActiveSends = nextProps.activeTrack?.sends || [];
  const activeSendsChanged = prevActiveSends.length !== nextActiveSends.length ||
    JSON.stringify(prevActiveSends) !== JSON.stringify(nextActiveSends);

  return (
    prevProps.track.id === nextProps.track.id &&
    prevProps.track.volume === nextProps.track.volume &&
    prevProps.track.pan === nextProps.track.pan &&
    prevProps.track.name === nextProps.track.name &&
    prevProps.track.color === nextProps.track.color &&
    prevProps.track.muted === nextProps.track.muted &&
    prevProps.track.solo === nextProps.track.solo &&
    prevProps.track.output === nextProps.track.output &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isMaster === nextProps.isMaster &&
    // ✅ CRITICAL FIX: Check activeTrack changes for SendAcceptButton updates
    prevProps.activeTrack?.id === nextProps.activeTrack?.id &&
    !activeSendsChanged && // Re-render when active track's sends change
    // Deep comparison for arrays/objects
    JSON.stringify(prevProps.track.insertEffects) === JSON.stringify(nextProps.track.insertEffects) &&
    JSON.stringify(prevProps.track.sends) === JSON.stringify(nextProps.track.sends) &&
    JSON.stringify(prevProps.track.eq) === JSON.stringify(nextProps.track.eq)
  );
});

MixerChannel.displayName = 'MixerChannel';

export default MixerChannel;
