/**
 * Waveform Visualizer - Displays audio waveform with playhead
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import './WaveformVisualizer.css';

export default function WaveformVisualizer({
  audioBuffer,
  analyser,
  isPlaying,
  currentTime,
  onSeek,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const animationFrameRef = useRef(null);

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

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const width = dimensions.width;
    const height = dimensions.height;
    const centerY = height / 2;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--zenith-bg-tertiary') || '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Get audio data
    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;
    const samplesPerPixel = Math.max(1, Math.floor(totalSamples / width));

    // Waveform color
    const waveColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--zenith-accent-primary') || '#3b82f6';
    const playedColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--zenith-accent-warm') || '#f59e0b';

    // Draw waveform
    ctx.lineWidth = 1;
    const progress = currentTime / audioBuffer.duration;
    const progressPixel = progress * width;

    // Draw played portion
    if (progress > 0) {
      ctx.strokeStyle = playedColor;
      ctx.beginPath();
      for (let x = 0; x < progressPixel; x++) {
        const sampleIndex = Math.floor(x * samplesPerPixel);
        if (sampleIndex >= totalSamples) break;

        let min = 1.0;
        let max = -1.0;
        const start = sampleIndex;
        const end = Math.min(start + samplesPerPixel, totalSamples);

        for (let i = start; i < end; i++) {
          const value = channelData[i];
          if (value < min) min = value;
          if (value > max) max = value;
        }

        const minY = centerY + min * (height * 0.4);
        const maxY = centerY + max * (height * 0.4);

        if (x === 0) {
          ctx.moveTo(x, minY);
        } else {
          ctx.lineTo(x, minY);
        }
        ctx.lineTo(x, maxY);
      }
      ctx.stroke();
    }

    // Draw unplayed portion
    if (progress < 1) {
      ctx.strokeStyle = waveColor;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (let x = progressPixel; x < width; x++) {
        const sampleIndex = Math.floor(x * samplesPerPixel);
        if (sampleIndex >= totalSamples) break;

        let min = 1.0;
        let max = -1.0;
        const start = sampleIndex;
        const end = Math.min(start + samplesPerPixel, totalSamples);

        for (let i = start; i < end; i++) {
          const value = channelData[i];
          if (value < min) min = value;
          if (value > max) max = value;
        }

        const minY = centerY + min * (height * 0.4);
        const maxY = centerY + max * (height * 0.4);

        if (x === progressPixel) {
          ctx.moveTo(x, minY);
        } else {
          ctx.lineTo(x, minY);
        }
        ctx.lineTo(x, maxY);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Draw center line
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--zenith-border-subtle') || '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw playhead
    if (isPlaying || progress > 0) {
      ctx.strokeStyle = playedColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressPixel, 0);
      ctx.lineTo(progressPixel, height);
      ctx.stroke();
    }
  }, [audioBuffer, dimensions, currentTime, isPlaying]);

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

  return (
    <div
      ref={containerRef}
      className="waveform-visualizer"
      onClick={onSeek}
      style={{ cursor: 'pointer' }}
    >
      <canvas ref={canvasRef} className="waveform-visualizer__canvas" />
    </div>
  );
}

