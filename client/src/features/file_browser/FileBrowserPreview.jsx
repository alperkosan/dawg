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
  const [isLoadingAudioUrl, setIsLoadingAudioUrl] = useState(false);

  const {
      isPlaying, playingUrl, loadingUrl, waveformBuffer,
      error, selectFileForPreview, playPreview
  } = usePreviewPlayerStore();

  // Full preview için state
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [useUrlPlayer, setUseUrlPlayer] = useState(true); // ✅ FIX: Default to URL player (no decode issues)

  const handleAddNewInstrument = useInstrumentsStore(state => state.handleAddNewInstrument);

  // ✅ NEW: Load audio URL with auth token (creates blob URL for HTML5 audio)
  useEffect(() => {
    if (fileNode?.type === 'file' && fileNode.url && useUrlPlayer) {
      const loadAudioUrl = async () => {
        setIsLoadingAudioUrl(true);
        setAudioError(null);
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

          console.log('📥 [URL Player] Fetching audio from:', proxyUrl);
          const response = await fetch(proxyUrl, { headers });
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
          }

          // ✅ FIX: Get MIME type from response header and clean it
          let contentType = response.headers.get('content-type') || 'audio/wav';
          
          // ✅ FIX: Remove charset parameter from audio MIME types (audio files don't have charset)
          if (contentType.includes(';')) {
            contentType = contentType.split(';')[0].trim();
          }
          
          // ✅ FIX: Determine MIME type from filename if header is generic
          let mimeType = contentType;
          if (contentType === 'application/octet-stream' || !contentType.startsWith('audio/')) {
            const filename = fileNode.name || '';
            if (filename.endsWith('.wav')) {
              mimeType = 'audio/wav';
            } else if (filename.endsWith('.mp3')) {
              mimeType = 'audio/mpeg';
            } else if (filename.endsWith('.ogg')) {
              mimeType = 'audio/ogg';
            } else if (filename.endsWith('.m4a')) {
              mimeType = 'audio/mp4';
            } else {
              mimeType = 'audio/wav'; // Default
            }
          }
          
          // ✅ FIX: Ensure mimeType doesn't have charset
          if (mimeType.includes(';')) {
            mimeType = mimeType.split(';')[0].trim();
          }
          
          console.log('🔧 [URL Player] MIME type cleaned:', {
            original: response.headers.get('content-type'),
            cleaned: mimeType
          });

          // ✅ FIX: Read as arrayBuffer first to validate, then create blob
          const arrayBuffer = await response.arrayBuffer();
          
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error('Received empty response from server');
          }
          
          console.log('📦 [URL Player] ArrayBuffer received:', {
            size: arrayBuffer.byteLength,
            contentType,
            mimeType
          });
          
          // ✅ FIX: Validate WAV header if it's a WAV file
          if (mimeType === 'audio/wav' && arrayBuffer.byteLength >= 4) {
            const view = new Uint8Array(arrayBuffer);
            const isWav = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46; // "RIFF"
            if (!isWav) {
              console.warn('⚠️ [URL Player] File does not start with WAV header (RIFF)');
            } else {
              console.log('✅ [URL Player] Valid WAV header detected');
            }
          }
          
          // ✅ FIX: Create blob with correct MIME type
          const finalBlob = new Blob([arrayBuffer], { type: mimeType });
          
          // ✅ FIX: Validate final blob
          if (!finalBlob || finalBlob.size === 0) {
            throw new Error('Failed to create valid blob');
          }
          
          const blobUrl = URL.createObjectURL(finalBlob);
          
          // ✅ FIX: Cleanup previous blob URL
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          
          blobUrlRef.current = blobUrl;
          setAudioUrl(blobUrl);
          setAudioError(null);
          
          console.log('✅ [URL Player] Audio URL loaded:', {
            blobUrl,
            mimeType: finalBlob.type,
            size: finalBlob.size,
            blobUrlValid: blobUrl.startsWith('blob:'),
            blobType: finalBlob.type
          });
        } catch (err) {
          console.error('Failed to load audio URL:', err);
          setAudioError(err.message);
          setAudioUrl(null);
        } finally {
          setIsLoadingAudioUrl(false);
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

  // ✅ NEW: Update audio src when audioUrl changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !useUrlPlayer) return;

    if (audioUrl && audioUrl.startsWith('blob:')) {
      console.log('🔧 [URL Player] Setting audio src:', audioUrl);
      // Clear any existing error
      setAudioError(null);
      // Set src and load
      audio.src = audioUrl;
      audio.load(); // Reload the audio element with new src
      
      // Verify src was set
      setTimeout(() => {
        if (audio.src !== audioUrl) {
          console.error('❌ [URL Player] Audio src mismatch:', {
            expected: audioUrl,
            actual: audio.src
          });
          setAudioError('Failed to set audio source');
        } else {
          console.log('✅ [URL Player] Audio src verified:', audio.src);
        }
      }, 100);
    } else if (audioUrl) {
      console.warn('⚠️ [URL Player] Invalid audioUrl (not a blob URL):', audioUrl);
      setAudioError('Invalid audio URL');
    } else {
      audio.src = '';
    }
  }, [audioUrl, useUrlPlayer]);

  // ✅ NEW: HTML5 audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !useUrlPlayer) return;

    const handlePlay = () => {
      console.log('▶️ [URL Player] Audio playing');
      setIsAudioPlaying(true);
    };
    const handlePause = () => {
      console.log('⏸️ [URL Player] Audio paused');
      setIsAudioPlaying(false);
    };
    const handleEnded = () => {
      console.log('⏹️ [URL Player] Audio ended');
      setIsAudioPlaying(false);
    };
    const handleError = (e) => {
      const error = audio.error;
      console.error('❌ [URL Player] Audio error:', {
        error,
        code: error?.code,
        message: error?.message,
        src: audio.src,
        networkState: audio.networkState,
        readyState: audio.readyState
      });
      
      let errorMsg = 'Failed to load audio';
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            errorMsg = 'Audio loading aborted';
            break;
          case error.MEDIA_ERR_NETWORK:
            errorMsg = 'Network error loading audio';
            break;
          case error.MEDIA_ERR_DECODE:
            errorMsg = 'Audio decode error';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = 'Audio format not supported or invalid source';
            break;
        }
      }
      setAudioError(errorMsg);
      setIsAudioPlaying(false);
    };
    const handleLoadedData = () => {
      console.log('✅ [URL Player] Audio data loaded:', {
        duration: audio.duration,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
      setAudioError(null);
    };
    const handleCanPlay = () => {
      console.log('✅ [URL Player] Audio can play');
      setAudioError(null);
    };
    const handleLoadedMetadata = () => {
      console.log('✅ [URL Player] Audio metadata loaded:', {
        duration: audio.duration,
        src: audio.src
      });
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [useUrlPlayer]);

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

  const handlePlayToggle = useCallback(async (e) => {
    if (useUrlPlayer && audioRef.current) {
      // ✅ NEW: Use HTML5 audio player (no decode issues)
      if (isAudioPlaying) {
        audioRef.current.pause();
      } else {
        // ✅ FIX: Wait for audio to be ready before playing
        const audio = audioRef.current;
        
        if (!audioUrl) {
          setAudioError('Audio URL not loaded yet');
          return;
        }

        // Check if audio has a valid source
        if (!audio.src || audio.src === '') {
          setAudioError('Audio source not set');
          return;
        }

        // Wait for audio to be ready
        if (audio.readyState < 2) { // HAVE_CURRENT_DATA
          try {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Audio load timeout'));
              }, 10000); // 10 second timeout

              const handleCanPlay = () => {
                clearTimeout(timeout);
                audio.removeEventListener('canplay', handleCanPlay);
                audio.removeEventListener('error', handleError);
                resolve(null);
              };

              const handleError = (e) => {
                clearTimeout(timeout);
                audio.removeEventListener('canplay', handleCanPlay);
                audio.removeEventListener('error', handleError);
                reject(new Error(`Audio load error: ${audio.error?.message || 'Unknown error'}`));
              };

              audio.addEventListener('canplay', handleCanPlay, { once: true });
              audio.addEventListener('error', handleError, { once: true });
              
              // If already ready, resolve immediately
              if (audio.readyState >= 2) {
                clearTimeout(timeout);
                audio.removeEventListener('canplay', handleCanPlay);
                audio.removeEventListener('error', handleError);
                resolve(null);
              } else {
                // Trigger load if not already loading
                audio.load();
              }
            });
          } catch (err) {
            console.error('Failed to load audio:', err);
            setAudioError(err.message || 'Failed to load audio');
            return;
          }
        }

        // Now play
        audio.play().catch(err => {
          console.error('Failed to play audio:', err);
          setAudioError(`Failed to play: ${err.message || 'Unknown error'}`);
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
  const isLoading = useUrlPlayer ? isLoadingAudioUrl : (loadingUrl === url);
  const hasWaveform = !isLoading && !error && waveformBuffer && !useUrlPlayer;
  const showError = useUrlPlayer ? audioError : (error && !isLoading);

  return (
    <div className="preview">
      <p className="preview__info" title={name}>{name}</p>
      <div className="preview__content">
        {/* ✅ NEW: HTML5 Audio Element (hidden, controlled via ref) */}
        {useUrlPlayer && (
          <audio
            ref={audioRef}
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

