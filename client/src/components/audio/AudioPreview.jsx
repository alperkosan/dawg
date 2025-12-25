/**
 * AudioPreview Component
 * Premium audio preview player with waveform visualization
 * Supports direct CDN URL playback (no proxy needed)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { getMediaPlayer } from '@/lib/media/MediaPlayer';
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
  const mediaPlayerRef = useRef(null);
  const unsubscribeRef = useRef(null);
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

  // Initialize MediaPlayer and subscribe to events
  useEffect(() => {
    const mediaPlayer = getMediaPlayer();
    mediaPlayerRef.current = mediaPlayer;

    // Subscribe to player events for this URL
    const unsubscribe = mediaPlayer.subscribe(url, (event, data) => {
      switch (event) {
        case 'play':
          setIsPlaying(true);
          break;
        case 'pause':
          setIsPlaying(false);
          break;
        case 'ended':
          setIsPlaying(false);
          setCurrentTime(0);
          break;
        case 'timeupdate':
          setCurrentTime(mediaPlayer.currentTime);
          break;
        case 'loadedmetadata':
          setDuration(mediaPlayer.duration);
          setIsLoading(false);
          setError(null);
          break;
        case 'loadstart':
          setIsLoading(true);
          setError(null);
          break;
        case 'error':
          setError(data.error);
          setIsLoading(false);
          setIsPlaying(false);
          break;
        case 'volumechange':
          setVolume(mediaPlayer.volume);
          setIsMuted(mediaPlayer.isMuted);
          break;
      }
    });

    unsubscribeRef.current = unsubscribe;

    // Load URL if provided
    if (url) {
      mediaPlayer.load(url);
      const state = mediaPlayer.getState();
      setIsPlaying(state.isPlaying);
      setIsLoading(state.isLoading);
      setDuration(state.duration);
      setCurrentTime(state.currentTime);
      setVolume(state.volume);
      setIsMuted(state.isMuted);
      if (state.error) {
        setError(state.error);
      }
    }

    return () => {
      unsubscribe();
      // Stop playback if this component was controlling it
      if (mediaPlayer.currentUrl === url && mediaPlayer.isPlaying) {
        mediaPlayer.stop();
      }
    };
  }, [url]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Keep hidden audio element for waveform generation (not for playback)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;

    // Only use for waveform generation, not playback
    audio.src = url;
    audio.load();
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

  // Time updates are handled by MediaPlayer subscription

  // Update volume via MediaPlayer
  useEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer) return;
    
    mediaPlayer.setVolume(volume);
    mediaPlayer.setMuted(isMuted);
  }, [volume, isMuted]);

  const handlePlayPause = useCallback(async () => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !url) return;

    try {
      await mediaPlayer.toggle(url);
    } catch (err) {
      console.error('Failed to play audio:', err);
      setError(err.message || 'Failed to play audio');
    }
  }, [url, isPlaying]);

  const handleSeek = useCallback((e) => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;

    mediaPlayer.seek(newTime);
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
                      const mediaPlayer = mediaPlayerRef.current;
                      if (!mediaPlayer || !duration) return;
                      const delta = e.key === 'ArrowLeft' ? -5 : 5;
                      const newTime = Math.max(0, Math.min(duration, currentTime + delta));
                      mediaPlayer.seek(newTime);
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

