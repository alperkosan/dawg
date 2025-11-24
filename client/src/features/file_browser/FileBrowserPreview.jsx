import React, { useEffect, useCallback, useState, useRef } from 'react';
import WaveformDisplay from '../sample_editor_v3/WaveformDisplay';
import { Loader2, Play, Pause, AlertTriangle, Plus } from 'lucide-react';
import { usePreviewPlayerStore } from '@/store/usePreviewPlayerStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useFileBrowserStore } from '@/store/useFileBrowserStore';

export function FileBrowserPreview({ fileNode }) {
  const { url, name, assetId } = fileNode || {};
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null); // ✅ FIX: Store blob URL for cleanup
  const [audioUrl, setAudioUrl] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState(null);

  const {
      isPlaying, playingUrl, loadingUrl, waveformBuffer,
      error, selectFileForPreview, playPreview
  } = usePreviewPlayerStore();

  // Full preview için state
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [useUrlPlayer, setUseUrlPlayer] = useState(false); // Toggle between URL player and buffer player

  const handleAddNewInstrument = useInstrumentsStore(state => state.handleAddNewInstrument);

  // ✅ NEW: Load audio URL with auth token (creates blob URL for HTML5 audio)
  useEffect(() => {
    if (fileNode?.type === 'file' && fileNode.url && useUrlPlayer) {
      const loadAudioUrl = async () => {
        try {
          const { apiClient } = await import('@/services/api.js');
          
          // Check if it's a system asset
          const isSystemAsset = fileNode.url.includes('dawg.b-cdn.net/system-assets') || 
                               fileNode.url.includes('system-assets/');
          
          // Construct proxy URL
          let proxyUrl;
          if (assetId) {
            proxyUrl = isSystemAsset 
              ? `${apiClient.baseURL}/assets/system/${assetId}/file`
              : `${apiClient.baseURL}/assets/${assetId}/file`;
          } else if (fileNode.url.startsWith('/api/') || fileNode.url.includes('/api/assets/')) {
            // Already a proxy URL
            proxyUrl = fileNode.url.startsWith('/api/') 
              ? `${apiClient.baseURL}${fileNode.url}`
              : fileNode.url;
          } else {
            // Try to extract assetId from URL or use original URL
            proxyUrl = fileNode.url;
          }

          // ✅ FIX: Fetch with auth token and create blob URL for HTML5 audio
          const { useAuthStore } = await import('@/store/useAuthStore.js');
          const token = useAuthStore.getState().accessToken;
          
          const headers = {};
          if (token && proxyUrl.includes('/api/assets/')) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(proxyUrl, { headers });
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status}`);
          }

          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          // ✅ FIX: Cleanup previous blob URL
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          
          blobUrlRef.current = blobUrl;
          setAudioUrl(blobUrl);
          setAudioError(null);
        } catch (err) {
          console.error('Failed to load audio URL:', err);
          setAudioError(err.message);
          setAudioUrl(null);
        }
      };

      loadAudioUrl();

      // ✅ FIX: Cleanup blob URL on unmount or when switching away
      return () => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    } else if (!useUrlPlayer) {
      // Cleanup blob URL when switching to buffer player
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setAudioUrl(null);
    }
  }, [fileNode, assetId, useUrlPlayer]);

  // ✅ NEW: HTML5 audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsAudioPlaying(true);
    const handlePause = () => setIsAudioPlaying(false);
    const handleEnded = () => setIsAudioPlaying(false);
    const handleError = (e) => {
      console.error('HTML5 Audio error:', e);
      setAudioError('Failed to load audio');
      setIsAudioPlaying(false);
    };
    const handleLoadedData = () => {
      setAudioError(null);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadeddata', handleLoadedData);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadeddata', handleLoadedData);
    };
  }, []);

  useEffect(() => {
    // Preview için normal yükleme (2 saniye) - sadece buffer player için
    if (!useUrlPlayer) {
      selectFileForPreview(fileNode?.type === 'file' ? fileNode.url : null, false);
      setIsFullPreview(false);
    }
  }, [fileNode, selectFileForPreview, useUrlPlayer]);

  const handleAddToChannelRack = useCallback(() => {
    if (fileNode?.type === 'file') {
      handleAddNewInstrument({ name: fileNode.name, url: fileNode.url });
    }
  }, [fileNode, handleAddNewInstrument]);

  const handlePlayToggle = useCallback((e) => {
    if (useUrlPlayer && audioRef.current) {
      // ✅ NEW: Use HTML5 audio player (no decode issues)
      if (isAudioPlaying) {
        audioRef.current.pause();
      } else {
        // Add auth token to audio element if needed
        if (audioUrl && audioUrl.includes('/api/assets/')) {
          const { useAuthStore } = require('@/store/useAuthStore.js');
          const token = useAuthStore.getState().accessToken;
          if (token && audioRef.current) {
            // Note: HTML5 audio doesn't support custom headers directly
            // We'll need to use fetch with credentials or pass token in URL
            // For now, rely on cookie-based auth or proxy handles it
          }
        }
        audioRef.current.play().catch(err => {
          console.error('Failed to play audio:', err);
          setAudioError('Failed to play audio');
        });
      }
    } else {
      // Original buffer-based player
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
    }
  }, [url, playPreview, selectFileForPreview, useUrlPlayer, audioUrl, isAudioPlaying]);
  
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

  const isCurrentlyPlaying = useUrlPlayer ? isAudioPlaying : (isPlaying && playingUrl === url);
  const isLoading = !useUrlPlayer && loadingUrl === url;
  const hasWaveform = !isLoading && !error && waveformBuffer && !useUrlPlayer;
  const showError = useUrlPlayer ? audioError : (error && !isLoading);

  return (
    <div className="preview">
      <p className="preview__info" title={name}>{name}</p>
      <div className="preview__content">
        {/* ✅ NEW: HTML5 Audio Element (hidden, controlled via ref) */}
        {useUrlPlayer && audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            crossOrigin="anonymous"
            style={{ display: 'none' }}
          />
        )}

        {/* Toggle Button (top-left) - Switch between URL and Buffer player */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Stop current playback
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            if (isPlaying && playingUrl === url) {
              // Stop buffer player if playing
              playPreview(url); // Toggle pause
            }
            setUseUrlPlayer(!useUrlPlayer);
            setAudioError(null);
            setIsAudioPlaying(false);
          }}
          className="preview__toggle-button"
          title={useUrlPlayer ? "Switch to Buffer Player" : "Switch to URL Player (no decode issues)"}
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            padding: '4px 8px',
            fontSize: '10px',
            background: useUrlPlayer ? '#4ade80' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          {useUrlPlayer ? 'URL' : 'BUF'}
        </button>

        {/* Loading State */}
        {isLoading && (
          <div className="preview__status">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}

        {/* Error State */}
        {showError && (
          <div className="preview__status preview__status--error" title={showError}>
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

        {/* ✅ NEW: URL Player Controls (when useUrlPlayer is true) */}
        {useUrlPlayer && !showError && (
          <>
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
                title={isCurrentlyPlaying ? "Pause" : "Play"}
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

