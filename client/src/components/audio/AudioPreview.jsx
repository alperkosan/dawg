/**
 * AudioPreview Component
 * Premium audio preview player with waveform visualization
 * Supports direct CDN URL playback (no proxy needed)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react';
import './AudioPreview.css';

/**
 * AudioPreview Component
 * 
 * @param {Object} props
 * @param {string} props.url - Direct CDN URL for audio file
 * @param {string} props.title - Optional title/name for the audio
 * @param {Function} props.onAddToProject - Optional callback when "Add" button is clicked
 * @param {boolean} props.showAddButton - Show "Add to Project" button (default: false)
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Additional inline styles
 */
export function AudioPreview({
  url,
  title,
  onAddToProject,
  showAddButton = false,
  className = '',
  style = {},
  variant = 'default',
}) {
  const audioRef = useRef(null);
  const waveformAbortRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [waveformData, setWaveformData] = useState(null);
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);

  // Stop any playing audio when URL changes or component unmounts
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  // Load audio metadata
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;

    setIsLoading(true);
    setError(null);

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleError = (e) => {
      console.error('AudioPreview error:', e, audio.error);
      const audioError = audio.error;
      let errorMsg = 'Failed to load audio';
      
      if (audioError) {
        switch (audioError.code) {
          case audioError.MEDIA_ERR_ABORTED:
            errorMsg = 'Audio loading aborted';
            break;
          case audioError.MEDIA_ERR_NETWORK:
            errorMsg = 'Network error loading audio';
            break;
          case audioError.MEDIA_ERR_DECODE:
            errorMsg = 'Audio decode error';
            break;
          case audioError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = 'Audio format not supported';
            break;
        }
      }
      
      setError(errorMsg);
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);

    // Set src and load
    audio.src = url;
    audio.load();

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
    };
  }, [url]);

  // Generate waveform background based on audio data
  useEffect(() => {
    if (!url || typeof window === 'undefined' || !window.AudioContext && !window.webkitAudioContext) {
      setWaveformData(null);
      return;
    }

    setIsWaveformLoading(true);
    setWaveformData(null);

    const controller = new AbortController();
    waveformAbortRef.current = controller;

    const loadWaveform = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load waveform: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        const channelData = audioBuffer.getChannelData(0);
        const samples = 120;
        const blockSize = Math.max(1, Math.floor(channelData.length / samples));
        const data = new Array(samples).fill(0).map((_, index) => {
          const start = index * blockSize;
          let sum = 0;
          for (let i = 0; i < blockSize; i++) {
            sum += Math.abs(channelData[start + i] || 0);
          }
          return sum / blockSize;
        });
        setWaveformData(data);
        await audioCtx.close();
      } catch (waveError) {
        if (!controller.signal.aborted) {
          console.warn('AudioPreview: unable to generate waveform', waveError);
          setWaveformData(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsWaveformLoading(false);
        }
      }
    };

    loadWaveform();

    return () => {
      controller.abort();
    };
  }, [url]);

  // Update current time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Update volume
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.error('Failed to play audio:', err);
        setError('Failed to play audio');
      });
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  const formatTime = (seconds) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const variantClass = variant ? `audio-preview--${variant}` : '';
  const rootClassName = ['audio-preview', variantClass, isFullscreen ? 'audio-preview--fullscreen' : '', className]
    .filter(Boolean)
    .join(' ');

  if (!url) {
    return (
      <div className={rootClassName} style={style}>
        <div className="audio-preview__wave-bg" aria-hidden="true" />
        <div className="audio-preview__empty">
          <p>No audio URL provided</p>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName} style={style}>
      <div className="audio-preview__wave-bg" aria-hidden="true">
        {waveformData && waveformData.length ? (
          <div className="audio-preview__wave-bars">
            {waveformData.map((value, index) => (
              <span
                key={`${url}-wave-${index}`}
                style={{
                  height: `${Math.max(value, 0.02) * 100}%`,
                  left: `${(index / waveformData.length) * 100}%`,
                }}
              />
            ))}
          </div>
        ) : (
          !isWaveformLoading && <div className="audio-preview__wave-placeholder" />
        )}
      </div>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />

      {/* Header */}
      {title && (
        <div className="audio-preview__header">
          <h3 className="audio-preview__title" title={title}>{title}</h3>
          {showAddButton && onAddToProject && (
            <button
              className="audio-preview__add-btn"
              onClick={onAddToProject}
              title="Add to Project"
            >
              <span>+</span> Add
            </button>
          )}
        </div>
      )}

      {/* Main Player */}
      <div className="audio-preview__player">
        {/* Loading State */}
        {isLoading && (
          <div className="audio-preview__loading">
            <Loader2 className="animate-spin" size={24} />
            <span>Loading audio...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="audio-preview__error">
            <p>{error}</p>
          </div>
        )}

        {/* Player Controls */}
        {!isLoading && !error && (
          <div className="audio-preview__player-main">
            {/* Play/Pause Button */}
            <button
              className="audio-preview__play-btn"
              onClick={handlePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            <div className="audio-preview__player-body">
              {/* Progress Bar + Time */}
              <div className="audio-preview__progress-container">
                <div
                  className="audio-preview__progress-bar"
                  onClick={handleSeek}
                  role="progressbar"
                  aria-valuenow={progressPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                      e.preventDefault();
                      const audio = audioRef.current;
                      if (!audio || !duration) return;
                      const delta = e.key === 'ArrowLeft' ? -5 : 5;
                      const newTime = Math.max(0, Math.min(duration, currentTime + delta));
                      audio.currentTime = newTime;
                      setCurrentTime(newTime);
                    }
                  }}
                >
                  <div
                    className="audio-preview__progress-fill"
                    style={{ width: `${progressPercentage}%` }}
                  />
                  <div
                    className="audio-preview__progress-handle"
                    style={{ left: `${progressPercentage}%` }}
                  />
                </div>
                <div className="audio-preview__time">
                  <span>{formatTime(currentTime)}</span>
                  <span>/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Volume Control */}
              <div className="audio-preview__volume-row">
                <button
                  className="audio-preview__mute-btn"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="audio-preview__volume-slider"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

