import React, { useRef, useEffect } from 'react';
import { Play, Pause, Square, Wind } from 'lucide-react';
import VolumeKnob from '../../ui/VolumeKnob';
import { useTransportControls, useTransportButton } from '../../hooks/useTransportManager.js';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '../../config/constants';

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
  // ✅ UNIFIED TRANSPORT SYSTEM
  const {
    isPlaying,
    playbackState,
    bpm,
    loopEnabled,
    isReady,
    setBPM,
    setLoopEnabled
  } = useTransportControls();

  // ✅ TRANSPORT BUTTONS with auto-registration
  const playPauseButton = useTransportButton('toggle');
  const stopButton = useTransportButton('stop');

  // Refs for button registration
  const playPauseRef = useRef(null);
  const stopRef = useRef(null);

  // ✅ AUTO-REGISTER BUTTONS with TransportManager
  useEffect(() => {
    if (playPauseRef.current && isReady) {
      playPauseButton.registerButtonElement('top-toolbar-play-pause', playPauseRef.current);
    }
    return () => {
      if (isReady) {
        playPauseButton.unregisterElement('top-toolbar-play-pause');
      }
    };
  }, [isReady, playPauseButton]);

  useEffect(() => {
    if (stopRef.current && isReady) {
      stopButton.registerButtonElement('top-toolbar-stop', stopRef.current);
    }
    return () => {
      if (isReady) {
        stopButton.unregisterElement('top-toolbar-stop');
      }
    };
  }, [isReady, stopButton]);

  console.log('🎛️ TopToolbar UNIFIED state:', {
    isPlaying,
    playbackState,
    bpm,
    isReady
  });

  // ✅ UNIFIED BUTTON CLASSES (auto-managed by TransportManager)
  const playButtonClass = `top-toolbar__transport-btn transport-btn`;
  const stopButtonClass = `top-toolbar__transport-btn transport-btn`;

  return (
    <header className="top-toolbar">
      <div className="toolbar__group">
        <div className="top-toolbar__logo">
          <Wind size={24} className="text-[var(--color-accent-primary)]" />
          <h1 className="top-toolbar__logo-title">SoundForge</h1>
        </div>
        <div className="top-toolbar__master-knob-wrapper">
            <VolumeKnob
              label="Master"
              size={32}
              value={0.8} // TODO: Get from new system
              onChange={() => {}} // TODO: Integrate with new system
              defaultValue={0} min={-60} max={6}
            />
        </div>
      </div>

      <div className="toolbar__group">
        <button
            ref={playPauseRef}
            title={
              playbackState === PLAYBACK_STATES.PLAYING ? 'Pause' :
              playbackState === PLAYBACK_STATES.PAUSED ? 'Resume' : 'Play'
            }
            onClick={playPauseButton.handleClick}
            className={playButtonClass}
        >
          {playbackState === PLAYBACK_STATES.PLAYING ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
            ref={stopRef}
            title="Stop"
            onClick={stopButton.handleClick}
            className={stopButtonClass}
        >
          <Square size={18} />
        </button>
        <div className="top-toolbar__mode-toggle">
            {/* TODO: Integrate playback modes with new system */}
            <ModeButton label="Pattern" mode={PLAYBACK_MODES.PATTERN} activeMode={PLAYBACK_MODES.PATTERN} onClick={() => {}} />
            <ModeButton label="Song" mode={PLAYBACK_MODES.SONG} activeMode={PLAYBACK_MODES.PATTERN} onClick={() => {}} />
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
            {/* TODO: Add position display from new system */}
            00:00:00
          </div>
        </div>
      </div>

      <div className="toolbar__group" style={{ width: '200px', justifyContent: 'flex-end' }}>
        {/* Sağ taraf boş */}
      </div>
    </header>
  );
}

export default TopToolbar;

