import React, { useEffect } from 'react';
import WaveformDisplay from '../sample_editor_v3/WaveformDisplay';
import { Loader2, Play, Pause, AlertTriangle, Plus } from 'lucide-react';
import { usePreviewPlayerStore } from '../../store/usePreviewPlayerStore';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';

export function FileBrowserPreview({ fileNode }) {
  const { url, name } = fileNode || {};
  
  const {
      isPlaying, playingUrl, loadingUrl, waveformBuffer,
      error, selectFileForPreview, playPreview
  } = usePreviewPlayerStore();

  const handleAddNewInstrument = useInstrumentsStore(state => state.handleAddNewInstrument);

  useEffect(() => {
    selectFileForPreview(fileNode?.type === 'file' ? fileNode.url : null);
  }, [fileNode, selectFileForPreview]);

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

  const handleAddToChannelRack = () => {
    if (fileNode && fileNode.type === 'file') {
      handleAddNewInstrument({ name: fileNode.name, url: fileNode.url });
    }
  };

  return (
    <div className="preview">
      <p className="preview__info" title={name}>{name}</p>
      <div className="preview__content">
        {isLoading && (
          <div className="preview__status">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}
        {error && !isLoading && (
          <div className="preview__status preview__status--error" title={error}>
            <AlertTriangle size={20} />
          </div>
        )}
        {waveformBuffer && (
          <>
            <WaveformDisplay buffer={waveformBuffer} className="preview__waveform" />
            <div className="preview__controls">
              <button
                onClick={() => playPreview(url)}
                className="preview__play-button"
                title={isCurrentlyPlaying ? "Stop" : "Play"}
              >
                {isCurrentlyPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button
                onClick={handleAddToChannelRack}
                className="preview__add-button"
                title="Add to Channel Rack"
              >
                <Plus size={16} />
                Add
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

