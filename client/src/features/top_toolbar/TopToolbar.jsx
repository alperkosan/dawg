import React from 'react';
import { Play, Pause, Square, Wind } from 'lucide-react';
import VolumeKnob from '../../ui/VolumeKnob';
import { usePlaybackStore } from '../../store/usePlaybackStore';

function TopToolbar({ audioEngineRef }) {
  const { playbackState, bpm, transportPosition, masterVolume } = usePlaybackStore();
  const { handlePlay, handlePause, handleStop, handleBpmChange, handleMasterVolumeChange } = usePlaybackStore.getState();

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
          {(playbackState === 'stopped' || playbackState === 'paused') && (
            <button title="Play" onClick={() => handlePlay(audioEngineRef.current)} className="p-2 rounded hover:bg-[var(--color-primary)] transition-colors" style={{ backgroundColor: 'var(--color-surface2)'}}>
              <Play size={20} />
            </button>
          )}
          {playbackState === 'playing' && (
            <button title="Pause" onClick={() => handlePause(audioEngineRef.current)} className="p-2 rounded hover:bg-[var(--color-primary)] transition-colors" style={{ backgroundColor: 'var(--color-surface2)'}}>
              <Pause size={20} />
            </button>
          )}
          {(playbackState === 'playing' || playbackState === 'paused') && (
            <button title="Stop" onClick={() => handleStop(audioEngineRef.current)} className="p-2 rounded hover:bg-[var(--color-accent)] transition-colors" style={{ backgroundColor: 'var(--color-surface2)'}}>
              <Square size={20} />
            </button>
          )}
        </div>

        <div className="flex items-center rounded" style={{ backgroundColor: 'var(--color-surface)' }}>
          <input
            type="number"
            value={bpm}
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