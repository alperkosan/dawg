/**
 * Enhanced Waveform Visualizer
 * 
 * Features:
 * - Peak + RMS waveform display
 * - Click to seek
 * - Hover preview with time tooltip
 * - Progress bar with time display
 * - Smooth animations
 * - Responsive design
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import './WaveformVisualizer.css';

// Pre-compute peaks from audio buffer for performance
function computePeaks(audioBuffer, numBars) {
  if (!audioBuffer) return null;
  
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const samplesPerBar = Math.floor(totalSamples / numBars);
  
  const peaks = [];
  const rms = [];
  
  for (let i = 0; i < numBars; i++) {
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, totalSamples);
    
    let peak = 0;
    let sum = 0;
    
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > peak) peak = abs;
      sum += channelData[j] * channelData[j];
    }
    
    peaks.push(peak);
    rms.push(Math.sqrt(sum / (end - start)));
  }
  
  return { peaks, rms };
}

// Format time in mm:ss format
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function WaveformVisualizer({
  audioBuffer,
  isPlaying,
  currentTime = 0,
  duration,
  onSeek,
  showTimeDisplay = true,
  showHoverPreview = true,
  barWidth = 3,
  barGap = 1,
  variant = 'default', // 'default' | 'compact' | 'minimal'
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoverPosition, setHoverPosition] = useState(null);
  const [hoverTime, setHoverTime] = useState(null);
  const animationFrameRef = useRef(null);
  const peaksDataRef = useRef(null);

  // Calculate duration from buffer if not provided
  const actualDuration = duration || audioBuffer?.duration || 0;
  const progress = actualDuration > 0 ? currentTime / actualDuration : 0;

  // Calculate number of bars based on dimensions
  const numBars = useMemo(() => {
    if (dimensions.width === 0) return 0;
    return Math.floor(dimensions.width / (barWidth + barGap));
  }, [dimensions.width, barWidth, barGap]);

  // Compute peaks when audioBuffer or numBars changes
  useEffect(() => {
    if (audioBuffer && numBars > 0) {
      peaksDataRef.current = computePeaks(audioBuffer, numBars);
    }
  }, [audioBuffer, numBars]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Get CSS variable
  const getCSSVar = useCallback((name, fallback) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name)?.trim() || fallback;
  }, []);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || !peaksDataRef.current) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const width = dimensions.width;
    const height = dimensions.height;
    const centerY = height / 2;
    const maxBarHeight = (height / 2) * 0.85;

    // Colors
    const bgColor = getCSSVar('--zenith-bg-tertiary', '#1a1a2e');
    const playedColor = getCSSVar('--zenith-accent-primary', '#6366f1');
    const unplayedColor = getCSSVar('--zenith-text-tertiary', '#4b5563');
    const rmsColor = getCSSVar('--zenith-accent-cool', '#22d3ee');
    const hoverColor = getCSSVar('--zenith-accent-warm', '#f59e0b');

    // Clear and fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Draw bars
    const { peaks, rms } = peaksDataRef.current;
    const progressBar = Math.floor(progress * numBars);

    for (let i = 0; i < numBars; i++) {
      const x = i * (barWidth + barGap);
      const peakHeight = peaks[i] * maxBarHeight;
      const rmsHeight = rms[i] * maxBarHeight * 0.7;
      
      const isPlayed = i <= progressBar;
      const isHovered = hoverPosition !== null && 
        x >= hoverPosition - (barWidth + barGap) * 2 && 
        x <= hoverPosition + (barWidth + barGap) * 2;

      // Draw peak bar (outer)
      if (isHovered) {
        ctx.fillStyle = hoverColor;
      } else if (isPlayed) {
        ctx.fillStyle = playedColor;
        } else {
        ctx.fillStyle = unplayedColor;
      }
      ctx.globalAlpha = isPlayed ? 1.0 : 0.4;
      
      // Top half
      ctx.fillRect(x, centerY - peakHeight, barWidth, peakHeight);
      // Bottom half (mirror)
      ctx.fillRect(x, centerY, barWidth, peakHeight);

      // Draw RMS bar (inner, brighter)
      if (variant !== 'minimal') {
        ctx.globalAlpha = isPlayed ? 0.8 : 0.3;
        ctx.fillStyle = isPlayed ? rmsColor : unplayedColor;
        ctx.fillRect(x, centerY - rmsHeight, barWidth, rmsHeight);
        ctx.fillRect(x, centerY, barWidth, rmsHeight);
      }
    }

      ctx.globalAlpha = 1.0;

    // Draw center line
    ctx.strokeStyle = getCSSVar('--zenith-border-subtle', '#374151');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw playhead
    if (progress > 0 || isPlaying) {
      const playheadX = progress * width;
      
      // Glow effect
      ctx.shadowColor = playedColor;
      ctx.shadowBlur = 8;
      
      ctx.strokeStyle = playedColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      
      ctx.shadowBlur = 0;

      // Playhead handle
      ctx.fillStyle = playedColor;
      ctx.beginPath();
      ctx.arc(playheadX, 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(playheadX, height - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw hover line
    if (hoverPosition !== null && showHoverPreview) {
      ctx.strokeStyle = hoverColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverPosition, 0);
      ctx.lineTo(hoverPosition, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [dimensions, progress, isPlaying, hoverPosition, numBars, barWidth, barGap, getCSSVar, variant, showHoverPreview]);

  // Render waveform
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Animate if playing
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        drawWaveform();
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, drawWaveform]);

  // Handle click to seek
  const handleClick = useCallback((e) => {
    if (!onSeek || !actualDuration) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const seekProgress = x / dimensions.width;
    const seekTime = seekProgress * actualDuration;
    
    onSeek(seekTime);
  }, [onSeek, actualDuration, dimensions.width]);

  // Handle mouse move for hover preview
  const handleMouseMove = useCallback((e) => {
    if (!showHoverPreview || !actualDuration) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    setHoverPosition(x);
    setHoverTime((x / dimensions.width) * actualDuration);
  }, [showHoverPreview, actualDuration, dimensions.width]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoverPosition(null);
    setHoverTime(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`waveform-visualizer waveform-visualizer--${variant}`}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="waveform-visualizer__canvas" />
      
      {/* Time display */}
      {showTimeDisplay && actualDuration > 0 && (
        <div className="waveform-visualizer__time">
          <span className="waveform-visualizer__time-current">
            {formatTime(currentTime)}
          </span>
          <span className="waveform-visualizer__time-separator">/</span>
          <span className="waveform-visualizer__time-duration">
            {formatTime(actualDuration)}
          </span>
        </div>
      )}
      
      {/* Hover tooltip */}
      {hoverPosition !== null && hoverTime !== null && showHoverPreview && (
        <div 
          className="waveform-visualizer__tooltip"
          style={{ left: hoverPosition }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
}
