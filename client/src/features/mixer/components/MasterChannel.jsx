/**
 * MASTER CHANNEL
 *
 * Master output channel with:
 * - Larger fader
 * - Stereo meter
 * - Master effects
 * - Output level display
 */

import React, { useState, useRef, useCallback } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { Volume2, VolumeX, Activity } from 'lucide-react';
import './MasterChannel.css';

export const MasterChannel = ({ track, isActive, onClick }) => {
  const [isDraggingFader, setIsDraggingFader] = useState(false);
  const faderRef = useRef(null);

  const {
    handleMixerParamChange,
    toggleMute
  } = useMixerStore();

  // Fader drag handling
  const handleFaderMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDraggingFader(true);

    const handleMouseMove = (e) => {
      if (!faderRef.current) return;
      const rect = faderRef.current.getBoundingClientRect();
      const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      const db = (y * 12) - 60; // -60dB to +12dB
      handleMixerParamChange(track.id, 'volume', db);
    };

    const handleMouseUp = () => {
      setIsDraggingFader(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [track.id, handleMixerParamChange]);

  // Calculate fader position
  const volume = track.volume !== undefined ? track.volume : 0;
  const faderPosition = (volume + 60) / 72;

  // Simplified stereo meter
  const meterLevelL = track.isMuted ? 0 : faderPosition * 0.75;
  const meterLevelR = track.isMuted ? 0 : faderPosition * 0.73;

  return (
    <div
      className={`master-channel ${isActive ? 'master-channel--active' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="master-channel__header">
        <div className="master-channel__title">
          <Activity size={14} />
          <span>MASTER</span>
        </div>
      </div>

      {/* Stereo Meters */}
      <div className="master-channel__meters">
        <div className="master-channel__meter">
          <div className="master-channel__meter-label">L</div>
          <div className="master-channel__meter-track">
            <div
              className="master-channel__meter-fill"
              style={{
                height: `${meterLevelL * 100}%`,
                background: meterLevelL > 0.9 ? '#ef4444' : meterLevelL > 0.7 ? '#f59e0b' : '#22c55e'
              }}
            />
          </div>
        </div>
        <div className="master-channel__meter">
          <div className="master-channel__meter-label">R</div>
          <div className="master-channel__meter-track">
            <div
              className="master-channel__meter-fill"
              style={{
                height: `${meterLevelR * 100}%`,
                background: meterLevelR > 0.9 ? '#ef4444' : meterLevelR > 0.7 ? '#f59e0b' : '#22c55e'
              }}
            />
          </div>
        </div>
      </div>

      {/* Fader */}
      <div className="master-channel__fader-container">
        <div
          ref={faderRef}
          className="master-channel__fader-track"
          onMouseDown={handleFaderMouseDown}
        >
          <div
            className="master-channel__fader-thumb"
            style={{ bottom: `${faderPosition * 100}%` }}
          >
            <div className="master-channel__fader-line" />
          </div>
        </div>
      </div>

      {/* Volume Display */}
      <div className="master-channel__volume-display">
        <div className="master-channel__volume-value">
          {volume > 0 ? '+' : ''}{volume.toFixed(1)} dB
        </div>
      </div>

      {/* Peak Indicator */}
      <div className={`master-channel__peak ${meterLevelL > 0.95 || meterLevelR > 0.95 ? 'active' : ''}`}>
        PEAK
      </div>

      {/* Mute Button */}
      <button
        className={`master-channel__mute ${track.isMuted ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleMute(track.id);
        }}
      >
        {track.isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        <span>Mute</span>
      </button>

      {/* Effects Badge */}
      {track.effects && track.effects.length > 0 && (
        <div className="master-channel__effects-count">
          {track.effects.length} {track.effects.length === 1 ? 'Effect' : 'Effects'}
        </div>
      )}
    </div>
  );
};

export default MasterChannel;
