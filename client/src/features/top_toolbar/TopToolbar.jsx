import React from 'react';
import { Play, Pause, Square, Wind } from 'lucide-react';
import VolumeKnob from '../../ui/VolumeKnob';
import { usePlaybackStore } from '../../store/usePlaybackStore';

function TopToolbar({ audioEngineRef }) {
  const playbackState = usePlaybackStore(state => state.playbackState);
  const bpm = usePlaybackStore(state => state.bpm);
  const transportPosition = usePlaybackStore(state => state.transportPosition);
  const masterVolume = usePlaybackStore(state => state.masterVolume);

  const {
    handlePlay,
    handlePause,
    handleStop,
    handleBpmChange,
    handleMasterVolumeChange,
  } = usePlaybackStore.getState();

  return (
    <header className="bg-gray-900 p-2 flex items-center justify-between border-b border-gray-700 h-16 shrink-0">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1 text-cyan-400">
          <Wind size={24} />
          <h1 className="font-bold text-lg">SoundForge</h1>
        </div>
        <div className="flex items-center space-x-2">
          <div className="mr-2">
            <VolumeKnob
              label="Master"
              size={36}
              value={masterVolume}
              // --- DÜZELTME: .current ile doğru motor örneğini gönder ---
              onChange={(val) => handleMasterVolumeChange(val, audioEngineRef.current)}
              defaultValue={0}
              min={-60}
              max={6}
            />
          </div>
          {/* --- DÜZELTME: Tüm onClick eylemlerinde .current ile doğru motor örneğini gönder --- */}
          {(playbackState === 'stopped' || playbackState === 'paused') && (
            <button title="Play" onClick={() => handlePlay(audioEngineRef.current)} className="bg-gray-700 p-2 rounded hover:bg-cyan-500 transition-colors">
              <Play size={20} />
            </button>
          )}
          {playbackState === 'playing' && (
            <button title="Pause" onClick={() => handlePause(audioEngineRef.current)} className="bg-gray-700 p-2 rounded hover:bg-cyan-500 transition-colors">
              <Pause size={20} />
            </button>
          )}
          {(playbackState === 'playing' || playbackState === 'paused') && (
            <button title="Stop" onClick={() => handleStop(audioEngineRef.current)} className="bg-gray-700 p-2 rounded hover:bg-red-500 transition-colors">
              <Square size={20} />
            </button>
          )}
        </div>
        <div className="flex items-center bg-gray-800 rounded">
          <div className="flex items-center">
            <input
              type="number"
              value={bpm}
              // --- DÜZELTME: .current ile doğru motor örneğini gönder ---
              onChange={(e) => handleBpmChange(Number(e.target.value), audioEngineRef.current)}
              className="bg-transparent w-16 text-center focus:outline-none p-1"
            />
            <span className="bg-gray-700 text-xs font-bold p-2">BPM</span>
          </div>
          <div className="p-[5px] text-lg font-mono tracking-wider w-32 text-center text-cyan-400">
            {transportPosition}
          </div>
        </div>
      </div>
      <div className="flex items-center text-xs font-bold">
        <span>CPU:</span>
        <span className="ml-1 font-mono text-green-500">0%</span>
      </div>
    </header>
  );
}

export default TopToolbar;
