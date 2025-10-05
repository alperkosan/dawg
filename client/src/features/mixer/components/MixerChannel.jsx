/**
 * MIXER CHANNEL
 *
 * FL Studio-inspired channel strip:
 * - Vertical fader
 * - Pan knob
 * - Meter
 * - Mute/Solo
 * - Activity indicator
 */

import React, { useState, useRef, useCallback } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { Volume2, VolumeX, Circle, Headphones } from 'lucide-react';
import './MixerChannel.css';

export const MixerChannel = ({ track, isActive, onClick }) => {
  const [isDraggingFader, setIsDraggingFader] = useState(false);
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const faderRef = useRef(null);
  const panRef = useRef(null);
  const faderRafRef = useRef(null);
  const panRafRef = useRef(null);

  const {
    handleMixerParamChange,
    toggleMute,
    toggleSolo
  } = useMixerStore();

  // Fader drag handling with RAF throttling
  const handleFaderMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDraggingFader(true);

    const latestY = { value: e.clientY };

    const handleMouseMove = (e) => {
      if (!faderRef.current) return;

      // Store latest Y position
      latestY.value = e.clientY;

      // OPTIMIZED: Throttle with RAF (max 60fps)
      if (faderRafRef.current !== null) return;

      faderRafRef.current = requestAnimationFrame(() => {
        if (!faderRef.current) return;
        const rect = faderRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(1, 1 - (latestY.value - rect.top) / rect.height));
        const db = (y * 12) - 60; // -60dB to +12dB
        handleMixerParamChange(track.id, 'volume', db);
        faderRafRef.current = null;
      });
    };

    const handleMouseUp = () => {
      setIsDraggingFader(false);

      // Cleanup RAF
      if (faderRafRef.current !== null) {
        cancelAnimationFrame(faderRafRef.current);
        faderRafRef.current = null;
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [track.id, handleMixerParamChange]);

  // Pan knob drag handling with RAF throttling
  const handlePanMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDraggingPan(true);

    const panStart = { y: e.clientY, pan: track.pan || 0 };
    const latestY = { value: e.clientY };

    const handleMouseMove = (e) => {
      // Store latest Y position
      latestY.value = e.clientY;

      // OPTIMIZED: Throttle with RAF (max 60fps)
      if (panRafRef.current !== null) return;

      panRafRef.current = requestAnimationFrame(() => {
        const deltaY = panStart.y - latestY.value;
        const newPan = Math.max(-1, Math.min(1, panStart.pan + deltaY / 100));
        handleMixerParamChange(track.id, 'pan', newPan);
        panRafRef.current = null;
      });
    };

    const handleMouseUp = () => {
      setIsDraggingPan(false);

      // Cleanup RAF
      if (panRafRef.current !== null) {
        cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [track.id, track.pan, handleMixerParamChange]);

  // Calculate fader position (0-1)
  const volume = track.volume !== undefined ? track.volume : 0; // in dB
  const faderPosition = (volume + 60) / 72; // -60dB to +12dB mapped to 0-1

  // Calculate pan rotation
  const pan = track.pan || 0;
  const panRotation = pan * 135; // -135deg to +135deg

  // Meter level (simplified - would be real-time in production)
  const meterLevel = track.isMuted ? 0 : faderPosition * 0.8;

  return (
    <div
      className={`mixer-channel ${isActive ? 'mixer-channel--active' : ''}`}
      onClick={onClick}
    >
      {/* Activity Indicator */}
      <div className="mixer-channel__activity">
        <Circle
          size={6}
          fill={meterLevel > 0.1 ? '#22c55e' : '#333'}
          stroke="none"
        />
      </div>

      {/* Channel Header */}
      <div className="mixer-channel__header">
        <div
          className="mixer-channel__color"
          style={{ backgroundColor: track.color || '#4b5563' }}
        />
        <div className="mixer-channel__name">{track.name}</div>
      </div>

      {/* Meter */}
      <div className="mixer-channel__meter">
        <div
          className="mixer-channel__meter-fill"
          style={{
            height: `${meterLevel * 100}%`,
            background: meterLevel > 0.9 ? '#ef4444' : meterLevel > 0.7 ? '#f59e0b' : '#22c55e'
          }}
        />
      </div>

      {/* Fader */}
      <div className="mixer-channel__fader-container">
        <div
          ref={faderRef}
          className="mixer-channel__fader-track"
          onMouseDown={handleFaderMouseDown}
        >
          <div
            className="mixer-channel__fader-thumb"
            style={{ bottom: `${faderPosition * 100}%` }}
          >
            <div className="mixer-channel__fader-line" />
          </div>
        </div>
      </div>

      {/* Volume Label */}
      <div className="mixer-channel__volume-label">
        {volume > 0 ? '+' : ''}{volume.toFixed(1)}
      </div>

      {/* Pan Knob */}
      <div className="mixer-channel__pan">
        <div
          ref={panRef}
          className="mixer-channel__pan-knob"
          onMouseDown={handlePanMouseDown}
          onDoubleClick={() => handleMixerParamChange(track.id, 'pan', 0)}
        >
          <div
            className="mixer-channel__pan-indicator"
            style={{ transform: `rotate(${panRotation}deg)` }}
          />
        </div>
        <div className="mixer-channel__pan-label">
          {pan === 0 ? 'C' : pan > 0 ? `R${Math.round(pan * 100)}` : `L${Math.round(-pan * 100)}`}
        </div>
      </div>

      {/* Controls */}
      <div className="mixer-channel__controls">
        <button
          className={`mixer-channel__btn mixer-channel__btn--mute ${track.isMuted ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMute(track.id);
          }}
          title="Mute"
        >
          {track.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>

        <button
          className={`mixer-channel__btn mixer-channel__btn--solo ${track.isSolo ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleSolo(track.id);
          }}
          title="Solo"
        >
          <Headphones size={12} />
        </button>
      </div>

      {/* Effects Count Badge */}
      {track.effects && track.effects.length > 0 && (
        <div className="mixer-channel__effects-badge">
          {track.effects.length}
        </div>
      )}
    </div>
  );
};

export default MixerChannel;
