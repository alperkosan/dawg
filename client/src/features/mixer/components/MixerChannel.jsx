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
import { Fader } from '@/components/controls/base/Fader';
import { Knob } from '@/components/controls/base/Knob';
import './MixerChannel.css';

export const MixerChannel = ({ track, isActive, onClick }) => {
  const {
    handleMixerParamChange,
    toggleMute,
    toggleSolo
  } = useMixerStore();

  const volume = track.volume !== undefined ? track.volume : 0;
  const pan = track.pan || 0;

  // Meter level (simplified - would be real-time in production)
  const faderPosition = (volume + 60) / 72; // -60dB to +12dB mapped to 0-1
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
        <Fader
          value={volume}
          min={-60}
          max={12}
          defaultValue={0}
          onChange={(value) => handleMixerParamChange(track.id, 'volume', value)}
          height={100}
          width={30}
          variant="mixer"
          showValue={false}
          unit="dB"
          precision={1}
        />
      </div>

      {/* Volume Label */}
      <div className="mixer-channel__volume-label">
        {volume > 0 ? '+' : ''}{volume.toFixed(1)}
      </div>

      {/* Pan Knob */}
      <div className="mixer-channel__pan">
        <Knob
          value={pan * 100}
          min={-100}
          max={100}
          defaultValue={0}
          onChange={(value) => handleMixerParamChange(track.id, 'pan', value / 100)}
          size={36}
          unit=""
          precision={0}
          variant="mixer"
          showValue={false}
        />
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
