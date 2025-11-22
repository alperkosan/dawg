import React, { useEffect, useCallback, useState } from 'react';
import WaveformDisplay from '../sample_editor_v3/WaveformDisplay';
import { Loader2, Play, Pause, AlertTriangle, Plus } from 'lucide-react';
import { usePreviewPlayerStore } from '@/store/usePreviewPlayerStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';

export function FileBrowserPreview({ fileNode }) {
  const { url, name } = fileNode || {};

  const {
      isPlaying, playingUrl, loadingUrl, waveformBuffer,
      error, selectFileForPreview, playPreview
  } = usePreviewPlayerStore();

  // Full preview için state
  const [isFullPreview, setIsFullPreview] = useState(false);

  const handleAddNewInstrument = useInstrumentsStore(state => state.handleAddNewInstrument);

  useEffect(() => {
    // Preview için normal yükleme (2 saniye)
    selectFileForPreview(fileNode?.type === 'file' ? fileNode.url : null, false);
    setIsFullPreview(false);
  }, [fileNode, selectFileForPreview]);

  const handleAddToChannelRack = useCallback(() => {
    if (fileNode?.type === 'file') {
      handleAddNewInstrument({ name: fileNode.name, url: fileNode.url });
    }
  }, [fileNode, handleAddNewInstrument]);

  const handlePlayToggle = useCallback((e) => {
    if (url) {
      // Shift veya Ctrl/Cmd tuşu basılıysa full preview
      const fullLoad = e.shiftKey || e.ctrlKey || e.metaKey;
      if (fullLoad) {
        // Full buffer yükle ve çal
        setIsFullPreview(true);
        selectFileForPreview(url, true);
        // Buffer yüklendikten sonra otomatik çalacak (useEffect ile)
      } else {
        // Normal preview (2 saniye)
        setIsFullPreview(false);
        playPreview(url);
      }
    }
  }, [url, playPreview, selectFileForPreview]);
  
  // Full preview yüklendikten sonra otomatik çal
  useEffect(() => {
    if (isFullPreview && waveformBuffer && !isPlaying && loadingUrl !== url) {
      // Full buffer yüklendi, otomatik çal
      playPreview(url);
    }
  }, [isFullPreview, waveformBuffer, isPlaying, loadingUrl, url, playPreview]);

  // Empty state
  if (!fileNode || fileNode.type !== 'file') {
    return (
      <div className="preview">
        <div className="preview__info">Select a file to preview</div>
        <div className="preview__content">
            <div className="preview__status"></div>
        </div>
      </div>
    );
  }

  const isCurrentlyPlaying = isPlaying && playingUrl === url;
  const isLoading = loadingUrl === url;
  const hasWaveform = !isLoading && !error && waveformBuffer;

  return (
    <div className="preview">
      <p className="preview__info" title={name}>{name}</p>
      <div className="preview__content">
        {/* Loading State */}
        {isLoading && (
          <div className="preview__status">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="preview__status preview__status--error" title={error}>
            <AlertTriangle size={20} />
            <span className="ml-2 text-xs">Failed to load</span>
          </div>
        )}

        {/* Waveform + Controls */}
        {hasWaveform && (
          <>
            <WaveformDisplay buffer={waveformBuffer} className="preview__waveform" />

            {/* Add Button (top-right) */}
            <button
              onClick={handleAddToChannelRack}
              className="preview__add-button"
              title="Add to Channel Rack"
            >
              <Plus size={16} />
              Add
            </button>

            {/* Play Button (center) */}
            <div className="preview__controls">
              <button
                onClick={handlePlayToggle}
                className="preview__play-button"
                title={isCurrentlyPlaying ? "Pause" : "Play (Shift/Ctrl+Click for full preview)"}
              >
                {isCurrentlyPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

