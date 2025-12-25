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

import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { MixerService } from '@/lib/services/MixerService';
import { Volume2, VolumeX, Headphones, Radio } from 'lucide-react';
import { Fader } from '@/components/controls/base/Fader';
import { Knob } from '@/components/controls/base/Knob';
import { ChannelMiniMeter } from './ChannelMeter';
import { SendAcceptButton } from './SendAcceptButton';
import './MixerChannel.css';

const MixerChannelComponent = ({
  trackId,
  allTracks,
  isActive,
  isMaster,
  onClick,
  activeTrackId,
  isVisible = true
}) => {
  // Subscribe to track data
  const track = useMixerStore(state =>
    state.mixerTracks.find(t => t.id === trackId)
  );

  // If track was deleted, don't render
  if (!track) return null;

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(track.name);
  const colorBarRef = useRef(null);

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

  // ✅ Direct audio change (zero latency) + immediate store update (UI reactivity)
  const handleVolumeChange = useCallback((value) => {
    // 1. IMMEDIATE: Direct audio manipulation (zero latency)
    MixerService.setTrackVolume(track.id, value);

    // 2. IMMEDIATE: Store update for UI reactivity
    // Smart subscription (detectStructuralChanges) ensures this won't trigger full mixer sync
    handleMixerParamChange(track.id, 'volume', value);
  }, [track.id, handleMixerParamChange]);

  const handlePanChange = useCallback((normalizedPan) => {
    // 1. IMMEDIATE: Direct audio manipulation (zero latency)
    MixerService.setTrackPan(track.id, normalizedPan);

    // 2. IMMEDIATE: Store update for UI reactivity
    handleMixerParamChange(track.id, 'pan', normalizedPan);
  }, [track.id, handleMixerParamChange]);

  // ✅ OPTIMIZATION: Memoize computed values
  const volume = useMemo(() => track.volume !== undefined ? track.volume : 0, [track.volume]);
  const panNormalized = useMemo(() => track.pan !== undefined ? track.pan : 0, [track.pan]);
  const panDisplay = useMemo(() => Math.round(panNormalized * 100), [panNormalized]);
  const isMuted = useMemo(() => mutedChannels?.has(track.id) || false, [mutedChannels, track.id]);
  const isSolo = useMemo(() => soloedChannels?.has(track.id) || false, [soloedChannels, track.id]);
  const isMono = useMemo(() => monoChannels?.has(track.id) || false, [monoChannels, track.id]);

  // ✅ OPTIMIZATION: Memoize pan label calculation
  const panLabel = useMemo(() => {
    if (panNormalized === 0) return 'C';
    if (panNormalized > 0) return `R${Math.round(panNormalized * 100)}`;
    return `L${Math.round(-panNormalized * 100)}`;
  }, [panNormalized]);

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

  // ✅ OPTIMIZATION: Use global color picker via callback to parent
  const handleColorClick = useCallback((e) => {
    e.stopPropagation();
    if (colorBarRef.current && onClick) {
      const rect = colorBarRef.current.getBoundingClientRect();
      // Trigger parent to show global color picker
      onClick({ type: 'color-picker', trackId: track.id, rect });
    }
  }, [track.id, onClick]);

  // Handle channel click for selection
  const handleChannelSelect = useCallback((e) => {
    // If it's a color-picker event, pass it through. Otherwise it's a normal click.
    if (e?.type === 'color-picker') {
      onClick?.(e);
    } else {
      // Normal DOM click event - call onClick without the event
      onClick?.();
    }
  }, [onClick]);

  return (
    <div
      className={`mixer-channel-2 ${isActive ? 'mixer-channel-2--active' : ''} ${isMaster ? 'mixer-channel-2--master' : ''}`}
      onClick={handleChannelSelect}
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
          onChange={handleVolumeChange}
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
            handlePanChange(normalizedPan);
          }}
          size={36}
          unit=""
          precision={0}
          variant="mixer"
          showValue={false}
        />
        <div className="mixer-channel-2__pan-label">
          {panLabel}
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
      <SendAcceptButton targetTrack={track} sourceTrack={useMixerStore.getState().mixerTracks.find(t => t.id === activeTrackId)} />
    </div>
  );
};

// ✅ PERFORMANCE: Memoize component with custom equality check
// Only re-render when these specific props change
export const MixerChannel = memo(MixerChannelComponent, (prevProps, nextProps) => {
  // Simple prop check is enough now because track data is internal!
  return (
    prevProps.trackId === nextProps.trackId &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isMaster === nextProps.isMaster &&
    prevProps.activeTrackId === nextProps.activeTrackId // Important for Send button state
  );
});

MixerChannel.displayName = 'MixerChannel';

export default MixerChannel;
