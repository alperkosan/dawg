import React from 'react';
import { Play, Pause, Square, Wind } from 'lucide-react';
import VolumeKnob from '../../ui/VolumeKnob';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useArrangementStore } from '../../store/useArrangementStore';

const ModeButton = ({ label, mode, activeMode, onClick }) => {
    const isActive = activeMode === mode;
    return (
        <button
            onClick={() => onClick(mode)}
            className={`px-4 py-1.5 text-sm font-bold transition-all duration-150 rounded-md ${isActive ? 'bg-amber-500 text-gray-900 shadow-inner' : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface2)]'}`}
        >
            {label}
        </button>
    );
};

function TopToolbar({ audioEngineRef }) {
  // State'leri reaktif olarak al
  const { playbackState, bpm, transportPosition, masterVolume, playbackMode } = usePlaybackStore();
  // Eylemleri getState() ile al
  const { handlePlay, handlePause, handleResume, handleStop, handleBpmChange, handleMasterVolumeChange, setPlaybackMode } = usePlaybackStore.getState();
  const activePatternId = useArrangementStore(state => state.activePatternId);

  const handleModeChange = (newMode) => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    setPlaybackMode(newMode, engine);
  };
  
  // ONARIM: Çalma/Duraklatma/Devam etme mantığını yöneten tek bir fonksiyon
  const handlePlayPauseClick = () => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    if (playbackState === 'playing') {
      handlePause(engine);
    } else if (playbackState === 'paused') {
      handleResume(engine);
    } else {
      handlePlay(engine);
    }
  };


  return (
    <header 
      className="p-2 flex items-center justify-between h-16 shrink-0"
      style={{
        backgroundColor: 'var(--color-background)',
        borderBottom: '1px solid var(--color-border)'
      }}
    >
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1" style={{ color: 'var(--color-primary)' }}>
          <Wind size={24} />
          <h1 className="font-bold" style={{ fontSize: 'var(--font-size-header)' }}>SoundForge</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <VolumeKnob
            label="Master"
            size={36}
            value={masterVolume}
            onChange={(val) => handleMasterVolumeChange(val, audioEngineRef.current)}
            defaultValue={0} min={-60} max={6}
          />
          {/* ONARIM: Oynat/Duraklat Düğmesi */}
          <button 
            title={playbackState === 'playing' ? 'Pause' : 'Play'} 
            onClick={handlePlayPauseClick} 
            className="p-2 rounded hover:bg-[var(--color-primary)] transition-colors" 
            style={{ backgroundColor: 'var(--color-surface2)'}}
          >
            {playbackState === 'playing' ? <Pause size={20} /> : <Play size={20} />}
          </button>
          {/* ONARIM: Durdurma Düğmesi */}
          {(playbackState === 'playing' || playbackState === 'paused') && (
            <button title="Stop" onClick={() => handleStop(audioEngineRef.current)} className="p-2 rounded hover:bg-[var(--color-accent)] transition-colors" style={{ backgroundColor: 'var(--color-surface2)'}}>
              <Square size={20} />
            </button>
          )}
        </div>

        <div className="flex items-center p-1 rounded-lg gap-x-1" style={{backgroundColor: 'var(--color-background)'}}>
            <ModeButton label="PAT" mode="pattern" activeMode={playbackMode} onClick={handleModeChange} />
            <ModeButton label="SONG" mode="song" activeMode={playbackMode} onClick={handleModeChange} />
        </div>

        <div className="flex items-center rounded" style={{ backgroundColor: 'var(--color-surface)' }}>
          <input
            type="number"
            value={Math.round(bpm)}
            onChange={(e) => handleBpmChange(Number(e.target.value), audioEngineRef.current)}
            className="bg-transparent w-16 text-center focus:outline-none p-1"
            style={{ fontSize: 'var(--font-size-body)' }}
          />
          <span className="text-xs font-bold p-2" style={{ backgroundColor: 'var(--color-surface2)' }}>BPM</span>
          <div className="p-[5px] font-mono tracking-wider w-32 text-center" style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-header)' }}>
            {transportPosition}
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopToolbar;
