import React, { useState } from 'react';
import { Play, Pause, Square, Repeat, Maximize2, ChevronRight, X, Download, Save, Loader2, Sparkles, Music, Keyboard } from 'lucide-react';
import { Knob } from '@/components/controls';
import { BPMInput } from '@/components/controls/BPMInput';
import { CPUMonitor } from '@/components/monitors/CPUMonitor';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '@/config/constants';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { usePanelsStore } from '@/store/usePanelsStore';
import { AudioContextService } from '@/lib/services/AudioContextService';
import EventBus from '@/lib/core/EventBus.js';

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

function TopToolbar({ onExportClick, onSaveClick, saveStatus = 'saved', lastSavedAt = null }) {
  // ✅ UNIFIED STATE from PlaybackStore (single source of truth)
  // Use selector pattern for better reactivity
  const playbackMode = usePlaybackStore(state => state.playbackMode);
  const isPlaying = usePlaybackStore(state => state.isPlaying);
  const playbackState = usePlaybackStore(state => state.playbackState);
  const bpm = usePlaybackStore(state => state.bpm);
  const currentPosition = usePlaybackStore(state => state.currentStep);
  const loopEnabled = usePlaybackStore(state => state.loopEnabled);
  const followPlayheadMode = usePlaybackStore(state => state.followPlayheadMode);

  const setPlaybackMode = usePlaybackStore(state => state.setPlaybackMode);
  const setBPM = usePlaybackStore(state => state.handleBpmChange);
  const setLoopEnabled = usePlaybackStore(state => state.setLoopEnabled);
  const togglePlayPause = usePlaybackStore(state => state.togglePlayPause);
  const handleStop = usePlaybackStore(state => state.handleStop);
  const cycleFollowPlayheadMode = usePlaybackStore(state => state.cycleFollowPlayheadMode);

  const keyboardPianoMode = usePlaybackStore(state => state.keyboardPianoMode);
  const setKeyboardPianoMode = usePlaybackStore(state => state.setKeyboardPianoMode);

  const isReady = true; // Store is always ready

  // Preset Library state
  const setPresetLibraryOpen = usePanelsStore(state => state.setPresetLibraryOpen);

  // Master volume state
  const [masterVolume, setMasterVolume] = useState(0.8);

  const handleMasterVolumeChange = (value) => {
    setMasterVolume(value);
    AudioContextService.setMasterVolume(value);
  };


  // ✅ Dynamic button classes with state-specific indicators
  const playButtonClass = `top-toolbar__transport-btn transport-btn ${playbackState === PLAYBACK_STATES.PLAYING ? 'transport-btn--playing' :
    playbackState === PLAYBACK_STATES.PAUSED ? 'transport-btn--paused' : ''
    }`;
  const stopButtonClass = `top-toolbar__transport-btn transport-btn ${playbackState === PLAYBACK_STATES.STOPPED ? 'transport-btn--stopped' : ''
    }`;


  return (
    <header className="top-toolbar">
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
          onClick={() => {
            // ✅ Emit transport stop event to stop MIDI recording
            EventBus.emit('transport:stop', {});
            handleStop();
          }}
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
        <button
          title={`Follow Playhead: ${followPlayheadMode}\nClick to cycle: CONTINUOUS → PAGE → OFF`}
          onClick={cycleFollowPlayheadMode}
          className={`top-toolbar__transport-btn transport-btn ${followPlayheadMode !== 'OFF' ? 'transport-btn--active' : ''}`}
        >
          {followPlayheadMode === 'CONTINUOUS' && <Maximize2 size={18} />}
          {followPlayheadMode === 'PAGE' && <ChevronRight size={18} />}
          {followPlayheadMode === 'OFF' && <X size={18} />}
        </button>
        <button
          title={keyboardPianoMode ? "Disable Musical Typing (Keyboard Piano)" : "Enable Musical Typing (Keyboard Piano)"}
          onClick={() => setKeyboardPianoMode(!keyboardPianoMode)}
          className={`top-toolbar__transport-btn transport-btn ${keyboardPianoMode ? 'transport-btn--active' : ''}`}
          style={{
            color: keyboardPianoMode ? '#f59e0b' : undefined,
            borderColor: keyboardPianoMode ? '#f59e0b' : undefined,
            backgroundColor: keyboardPianoMode ? 'rgba(245, 158, 11, 0.1)' : undefined
          }}
        >
          <Keyboard size={18} />
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
          <BPMInput
            value={bpm}
            onChange={setBPM}
            showPresets={true}
            showTapTempo={true}
            showButtons={true}
            precision={1}
            className="top-toolbar__bpm-input-wrapper"
          />
          <div className="top-toolbar__transport-pos">
            {formatPosition(currentPosition || 0)}
          </div>
        </div>
      </div>

      <div className="toolbar__group" style={{ width: '280px', justifyContent: 'flex-end', gap: '12px' }}>
        <CPUMonitor />
        {onSaveClick && (
          <button
            title={
              saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'unsaved'
                  ? 'Unsaved changes (Ctrl/Cmd + S)'
                  : saveStatus === 'error'
                    ? 'Save failed - Click to retry'
                    : lastSavedAt
                      ? `Saved at ${new Date(lastSavedAt).toLocaleTimeString()} (Ctrl/Cmd + S)`
                      : 'Save Project (Ctrl/Cmd + S)'
            }
            onClick={() => {
              if (onSaveClick && saveStatus !== 'saving') {
                onSaveClick();
              }
            }}
            className={`top-toolbar__transport-btn transport-btn ${saveStatus === 'unsaved' ? 'top-toolbar__save-btn--unsaved' : ''
              } ${saveStatus === 'saving' ? 'top-toolbar__save-btn--saving' : ''} ${saveStatus === 'error' ? 'top-toolbar__save-btn--error' : ''
              }`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              gap: '4px'
            }}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? (
              <Loader2 size={18} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Save size={18} />
            )}
            {saveStatus === 'unsaved' && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 4px rgba(239, 68, 68, 0.8)'
              }} />
            )}
          </button>
        )}
        <button
          title="Export Audio (Ctrl/Cmd + E)"
          onClick={() => {
            console.log('🎵 Export button clicked');
            if (onExportClick) {
              onExportClick();
            } else {
              console.warn('⚠️ onExportClick not provided');
            }
          }}
          className="top-toolbar__transport-btn transport-btn"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Download size={18} />
        </button>
        <button
          title="Preset Library"
          onClick={() => {
            console.log('✨ Preset Library button clicked');
            setPresetLibraryOpen(true);
          }}
          className="top-toolbar__transport-btn transport-btn"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Sparkles size={18} />
        </button>
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

