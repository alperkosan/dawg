import React from 'react';
import { Play, Pause, Square, Wind } from 'lucide-react';
import VolumeKnob from '../../ui/VolumeKnob';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { PLAYBACK_MODES } from '../../config/constants'; // GÜNCELLENDİ

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
  const { 
      playbackState, bpm, transportPosition, masterVolume, playbackMode 
  } = usePlaybackStore();
  
  const { 
      handlePlay, handlePause, handleStop, handleBpmChange, 
      handleMasterVolumeChange, setPlaybackMode 
  } = usePlaybackStore.getState();
  
  const handlePlayPauseClick = () => {
    if (playbackState === 'playing') handlePause();
    else handlePlay();
  };
  
  const playButtonClass = `top-toolbar__transport-btn ${playbackState === 'playing' ? 'top-toolbar__transport-btn--playing' : ''}`;

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
              value={masterVolume}
              onChange={handleMasterVolumeChange}
              defaultValue={0} min={-60} max={6}
            />
        </div>
      </div>

      <div className="toolbar__group">
        <button 
            title={playbackState === 'playing' ? 'Pause' : 'Play'} 
            onClick={handlePlayPauseClick} 
            className={playButtonClass}
        >
          {playbackState === 'playing' ? <Pause size={18} /> : <Play size={18} />}
        </button>
        {(playbackState === 'playing' || playbackState === 'paused') && (
          <button title="Stop" onClick={handleStop} className="top-toolbar__transport-btn">
            <Square size={18} />
          </button>
        )}
        <div className="top-toolbar__mode-toggle">
            <ModeButton label={PLAYBACK_MODES.PATTERN} mode={PLAYBACK_MODES.SONG} activeMode={playbackMode} onClick={setPlaybackMode} />
        </div>
        <div className="top-toolbar__display">
          <input
            type="number"
            value={Math.round(bpm)}
            onChange={(e) => handleBpmChange(Number(e.target.value))}
            className="top-toolbar__bpm-input"
          />
          <span className="top-toolbar__bpm-label">BPM</span>
          <div className="top-toolbar__transport-pos">
            {transportPosition}
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

