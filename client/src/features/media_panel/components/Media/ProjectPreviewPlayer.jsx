/**
 * Project Preview Player - Audio player for project previews in media panel
 * ✅ NEW: Uses AudioPreview component with direct CDN URL
 */

import React from 'react';
import { AudioPreview } from '@/components/audio/AudioPreview';

export default function ProjectPreviewPlayer({ 
  audioUrl, 
  duration, 
  onPlayStateChange,
  className = '',
  title
}) {
  // ✅ NEW: Use AudioPreview component with direct CDN URL
  // CDN URL should be stored in audioUrl (full CDN URL from previewAudioUrl)
  return (
    <AudioPreview
      url={audioUrl}
      title={title || 'Project Preview'}
      showAddButton={false}
      className={className}
    />
  );
  // ✅ FIX: Use store state instead of local state for isPlaying
  const { isPlaying: storeIsPlaying, playingProjectId } = useMediaPlayerStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const isSyncingRef = useRef(false); // Prevent infinite loops

  // ✅ FIX: Sync with store's isPlaying state
  useEffect(() => {
    // Only sync if this project is the one playing and we're not already syncing
    if (isSyncingRef.current) return;
    if (!audioBuffer) return; // Wait for audio to load
    
    const shouldPlay = storeIsPlaying && !isPlaying;
    const shouldPause = !storeIsPlaying && isPlaying;
    
    if (shouldPlay || shouldPause) {
      isSyncingRef.current = true;
      handlePlayPause().finally(() => {
        isSyncingRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeIsPlaying, audioBuffer, isPlaying]);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Load audio buffer when URL changes
  useEffect(() => {
    if (!audioUrl) {
      console.warn('ProjectPreviewPlayer: No audioUrl provided');
      setAudioBuffer(null);
      return;
    }

    console.log('ProjectPreviewPlayer: Loading audio from URL:', audioUrl);

    const loadAudio = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const context = audioContextRef.current;
        if (context.state === 'suspended') {
          await context.resume();
        }

        // ✅ FIX: Normalize URL to use backend proxy for CDN URLs (avoids CORS)
        let normalizedUrl = audioUrl;
        
        // If it's a CDN URL (user-assets), convert to proxy endpoint
        if (audioUrl.includes('dawg.b-cdn.net/user-assets') || audioUrl.includes('user-assets/')) {
          // Extract assetId from URL pattern: .../user-assets/{userId}/{year-month}/{assetId}/{filename}
          const match = audioUrl.match(/user-assets\/[^/]+\/[^/]+\/([a-f0-9-]{36})\//);
          if (match && match[1]) {
            const assetId = match[1];
            // Dynamically import apiClient to avoid circular dependencies
            const { apiClient } = await import('@/services/api.js');
            normalizedUrl = `${apiClient.baseURL}/assets/${assetId}/file`;
            console.log('ProjectPreviewPlayer: Using proxy endpoint:', normalizedUrl);
          }
        }

        // Fetch and decode audio
        console.log('ProjectPreviewPlayer: Fetching audio...');
        const headers = {};
        if (normalizedUrl.includes('/api/assets/')) {
          // Add auth token for authenticated endpoints
          const { useAuthStore } = await import('@/store/useAuthStore.js');
          const token = useAuthStore.getState().accessToken;
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }
        
        const response = await fetch(normalizedUrl, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log('ProjectPreviewPlayer: Decoding audio buffer...');
        const buffer = await context.decodeAudioData(arrayBuffer);
        
        console.log('ProjectPreviewPlayer: Audio loaded successfully', {
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          numberOfChannels: buffer.numberOfChannels
        });
        setAudioBuffer(buffer);

        // Create analyser for waveform visualization
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        // Create gain node for volume control
        const gainNode = context.createGain();
        gainNode.gain.value = isMuted ? 0 : volume;
        gainNodeRef.current = gainNode;

      } catch (err) {
        console.error('Failed to load audio:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadAudio();
  }, [audioUrl]);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Play/pause handler
  const handlePlayPause = useCallback(async () => {
    if (!audioBuffer || !audioContextRef.current) {
      console.warn('ProjectPreviewPlayer: Cannot play - audioBuffer or context not ready');
      return;
    }

    const context = audioContextRef.current;

    if (context.state === 'suspended') {
      await context.resume();
    }

    if (isPlaying) {
      // Pause
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      // Play
      try {
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect: source -> gain -> analyser -> destination
        source.connect(gainNodeRef.current);
        gainNodeRef.current.connect(analyserRef.current);
        analyserRef.current.connect(context.destination);

        const startTime = context.currentTime;
        const startOffset = currentTime;
        
        // Start from current position
        if (startOffset > 0 && startOffset < audioBuffer.duration) {
          source.start(startTime, startOffset);
        } else {
          source.start(startTime);
        }
        
        // Handle end
        source.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
          sourceNodeRef.current = null;
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          onPlayStateChange?.(false);
        };

        sourceNodeRef.current = source;
        setIsPlaying(true);
        onPlayStateChange?.(true);

        // Update progress
        const updateProgress = () => {
          const elapsed = context.currentTime - startTime + startOffset;
          if (elapsed >= audioBuffer.duration) {
            setCurrentTime(audioBuffer.duration);
            setIsPlaying(false);
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            onPlayStateChange?.(false);
          } else {
            setCurrentTime(elapsed);
          }
        };

        progressIntervalRef.current = setInterval(updateProgress, 100);
      } catch (err) {
        console.error('Failed to play audio:', err);
        setError(err.message);
        setIsPlaying(false);
      }
    }
  }, [audioBuffer, isPlaying, currentTime, onPlayStateChange]);

  // Seek handler
  const handleSeek = useCallback((e) => {
    if (!audioBuffer) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percent * audioBuffer.duration;

    setCurrentTime(newTime);

    // If playing, restart from new position
    if (isPlaying && sourceNodeRef.current) {
      const wasPlaying = true;
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // Restart playback from new position
      setTimeout(() => {
        if (wasPlaying) {
          handlePlayPause();
        }
      }, 10);
    }
  }, [audioBuffer, isPlaying, handlePlayPause]);

  // Format time
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  if (!audioUrl) {
    return (
      <div className={`project-preview-player ${className}`}>
        <div className="project-preview-player__empty">
          <p>No preview available</p>
        </div>
      </div>
    );
  }

  const progress = audioBuffer ? (currentTime / audioBuffer.duration) * 100 : 0;
  const displayDuration = duration || audioBuffer?.duration || 0;

  return (
    <div className={`project-preview-player ${className}`}>
      {error && (
        <div className="project-preview-player__error">
          <p>Failed to load audio: {error}</p>
        </div>
      )}

      {/* Waveform Visualization */}
      {audioBuffer && (
        <div className="project-preview-player__waveform">
          <WaveformVisualizer
            audioBuffer={audioBuffer}
            analyser={analyserRef.current}
            isPlaying={isPlaying}
            currentTime={currentTime}
            onSeek={handleSeek}
          />
        </div>
      )}

      {/* Controls */}
      <div className="project-preview-player__controls">
        <button
          className="project-preview-player__play-btn"
          onClick={handlePlayPause}
          disabled={!audioBuffer || isLoading}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={20} />
          ) : (
            <Play size={20} />
          )}
        </button>

        {/* Progress Bar */}
        <div className="project-preview-player__progress-container">
          <div
            className="project-preview-player__progress-bar"
            onClick={handleSeek}
          >
            <div
              className="project-preview-player__progress-fill"
              style={{ width: `${progress}%` }}
            />
            {isPlaying && (
              <div
                className="project-preview-player__progress-handle"
                style={{ left: `${progress}%` }}
              />
            )}
          </div>
          <div className="project-preview-player__time">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(displayDuration)}</span>
          </div>
        </div>

        {/* Volume Control */}
        <div className="project-preview-player__volume">
          <button
            className="project-preview-player__mute-btn"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="project-preview-player__volume-slider"
            title="Volume"
          />
        </div>
      </div>
    </div>
  );
}

