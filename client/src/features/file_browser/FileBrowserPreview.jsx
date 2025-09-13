import React from 'react';
import WaveformDisplay from '../sample_editor/WaveformDisplay';
import { Loader2, Play, Pause } from 'lucide-react';
import { usePreviewPlayerStore } from '../../store/usePreviewPlayerStore';

export function FileBrowserPreview({ fileNode }) {
  const { url, name } = fileNode || {};
  
  const isPlaying = usePreviewPlayerStore(state => state.isPlaying);
  const playingUrl = usePreviewPlayerStore(state => state.playingUrl);
  const loadingUrl = usePreviewPlayerStore(state => state.loadingUrl);
  const waveformBuffer = usePreviewPlayerStore(state => state.waveformBuffer);
  const error = usePreviewPlayerStore(state => state.error);
  const { playPreview } = usePreviewPlayerStore.getState();

  if (!fileNode || fileNode.type !== 'file') {
    return null;
  }

  const isCurrentlyPlaying = isPlaying && playingUrl === url;
  const isLoading = loadingUrl === url;

  // Dinamik stiller
  const containerStyle = {
    height: '7rem', // 112px
    backgroundColor: 'var(--color-surface)', // surface2'den surface'e değiştirildi
    borderRadius: 'var(--border-radius)',
    padding: 'var(--padding-controls)',
    // **** İSTEĞİNİZ BURADA EKLENDİ ****
    border: '1px solid var(--color-border)', 
  };

  const playButtonStyle = {
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    borderRadius: '9999px',
    padding: 'var(--padding-controls)',
  };
  
  const textStyle = {
    fontSize: 'var(--font-size-label)',
    color: 'var(--color-muted)',
    marginTop: 'var(--gap-controls)',
  };
  
  const errorStyle = {
      ...textStyle,
      color: 'var(--color-accent)'
  };

  return (
    <div className="w-full shrink-0 relative flex flex-col justify-center items-center" style={containerStyle}>
      {!isLoading && !error && (
        <button
          onClick={() => playPreview(url)}
          className="absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors duration-200 hover:bg-[var(--color-primary)]"
          style={playButtonStyle}
          title={isCurrentlyPlaying ? "Durdur" : "Çal"}
        >
          {isCurrentlyPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
      )}

      <div className="w-full h-full relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ color: 'var(--color-muted)'}}>
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center" style={errorStyle}>
            {error}
          </div>
        )}
        {waveformBuffer && (
          <WaveformDisplay
            buffer={waveformBuffer}
            className="w-full h-full opacity-50"
          />
        )}
      </div>
      <p className="truncate w-full text-center" style={textStyle}>{name}</p>
    </div>
  );
}