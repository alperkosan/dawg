import React, { useState } from 'react';
import { Play, Pause, Square, Wind, Repeat } from 'lucide-react';
import { Knob } from '@/components/controls';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '@/config/constants';
import { usePlaybackStore } from '@/store/usePlaybackStoreV2';
import { AudioContextService } from '@/lib/services/AudioContextService';

// Format position for display (bar:beat:tick format)
const formatPosition = (position) => {
  // Convert step position to bar:beat:tick format
  const step = Math.floor(position || 0);
  const bar = Math.floor(step / 16) + 1;
  const beat = Math.floor((step % 16) / 4) + 1;
  const tick = (step % 4) + 1;

  return `${bar}:${beat}:${tick}`;
};

const ModeButton = ({ label, mode, activeMode, onClick }) => {
    const isActive = activeMode === mode;
    const className = `top-toolbar__mode-btn ${isActive ? 'top-toolbar__mode-btn--active' : ''}`;
    return (
        <button onClick={() => onClick(mode)} className={className}>
            {label}
        </button>
    );
};

function TopToolbar() {
  // ✅ UNIFIED STATE from PlaybackStore (single source of truth)
  // Use selector pattern for better reactivity
  const playbackMode = usePlaybackStore(state => state.playbackMode);
  const isPlaying = usePlaybackStore(state => state.isPlaying);
  const playbackState = usePlaybackStore(state => state.playbackState);
  const bpm = usePlaybackStore(state => state.bpm);
  const currentPosition = usePlaybackStore(state => state.currentStep);
  const loopEnabled = usePlaybackStore(state => state.loopEnabled);

  const setPlaybackMode = usePlaybackStore(state => state.setPlaybackMode);
  const setBPM = usePlaybackStore(state => state.handleBpmChange);
  const setLoopEnabled = usePlaybackStore(state => state.setLoopEnabled);
  const togglePlayPause = usePlaybackStore(state => state.togglePlayPause);
  const handleStop = usePlaybackStore(state => state.handleStop);

  const isReady = true; // Store is always ready

  // Master volume state
  const [masterVolume, setMasterVolume] = useState(0.8);

  const handleMasterVolumeChange = (value) => {
    setMasterVolume(value);
    AudioContextService.setMasterVolume(value);
  };


  // ✅ Dynamic button classes with state-specific indicators
  const playButtonClass = `top-toolbar__transport-btn transport-btn ${
    playbackState === PLAYBACK_STATES.PLAYING ? 'transport-btn--playing' :
    playbackState === PLAYBACK_STATES.PAUSED ? 'transport-btn--paused' : ''
  }`;
  const stopButtonClass = `top-toolbar__transport-btn transport-btn ${
    playbackState === PLAYBACK_STATES.STOPPED ? 'transport-btn--stopped' : ''
  }`;


  return (
    <header className="top-toolbar">
      <div className="toolbar__group">
        <div className="top-toolbar__logo">
          <Wind size={24} className="text-[var(--zenith-accent-cool)]" />
          <h1 className="top-toolbar__logo-title">SoundForge</h1>
        </div>
      </div>

      <div className="toolbar__group">
        <button
            title={
              playbackState === PLAYBACK_STATES.PLAYING ? 'Pause' :
              playbackState === PLAYBACK_STATES.PAUSED ? 'Resume' : 'Play'
            }
            onClick={togglePlayPause}
            className={playButtonClass}
        >
          {playbackState === PLAYBACK_STATES.PLAYING ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
            title="Stop"
            onClick={handleStop}
            className={stopButtonClass}
        >
          <Square size={18} />
        </button>
        <button
            title={loopEnabled ? "Disable Loop" : "Enable Loop"}
            onClick={() => setLoopEnabled(!loopEnabled)}
            className={`top-toolbar__transport-btn transport-btn ${loopEnabled ? 'transport-btn--active' : ''}`}
        >
          <Repeat size={18} />
        </button>
        <div className="top-toolbar__mode-toggle">
            <ModeButton
              label="Pattern"
              mode={PLAYBACK_MODES.PATTERN}
              activeMode={playbackMode}
              onClick={setPlaybackMode}
            />
            <ModeButton
              label="Song"
              mode={PLAYBACK_MODES.SONG}
              activeMode={playbackMode}
              onClick={setPlaybackMode}
            />
        </div>
        <div className="top-toolbar__display">
          <input
            type="number"
            value={Math.round(bpm)}
            onChange={(e) => setBPM(Number(e.target.value))}
            className="top-toolbar__bpm-input"
          />
          <span className="top-toolbar__bpm-label">BPM</span>
          <div className="top-toolbar__transport-pos">
            {formatPosition(currentPosition || 0)}
          </div>
        </div>
      </div>

      <div className="toolbar__group" style={{ width: '200px', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Knob
            size={28}
            value={masterVolume}
            onChange={handleMasterVolumeChange}
            min={0}
            max={1}
            defaultValue={0.8}
            precision={2}
            showValue={false}
            aria-label="Master Volume"
          />
          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--zenith-text-secondary)', letterSpacing: '0.1em' }}>M</span>
        </div>
      </div>
    </header>
  );
}

export default TopToolbar;

