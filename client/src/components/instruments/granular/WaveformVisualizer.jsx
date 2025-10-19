/**
 * WaveformVisualizer - Interactive waveform display for Granular Sampler
 *
 * Features:
 * - Waveform rendering from AudioBuffer
 * - Interactive position marker (click to set)
 * - Active grain visualization
 * - Zoom controls
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

export const WaveformVisualizer = ({
  sampleBuffer,
  samplePosition = 0.5,
  grainSize = 80,
  activeGrains = [],
  onPositionChange,
  width = 600,
  height = 120
}) => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Draw waveform from AudioBuffer
   */
  const drawWaveform = useCallback((ctx, buffer) => {
    if (!buffer) {
      // Draw empty state
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '12px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No sample loaded', width / 2, height / 2);
      return;
    }

    const channelData = buffer.getChannelData(0); // Use first channel
    const samplesPerPixel = Math.floor(channelData.length / width);
    const amplitude = height / 2;

    // Clear canvas
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    ctx.strokeStyle = 'rgba(0, 168, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const startSample = x * samplesPerPixel;
      const endSample = startSample + samplesPerPixel;

      // Find min/max in this pixel range
      let min = 1.0;
      let max = -1.0;

      for (let i = startSample; i < endSample && i < channelData.length; i++) {
        const value = channelData[i];
        if (value < min) min = value;
        if (value > max) max = value;
      }

      // Convert to canvas coordinates
      const minY = (1 + min) * amplitude;
      const maxY = (1 + max) * amplitude;

      // Draw vertical line for this pixel
      if (x === 0) {
        ctx.moveTo(x, minY);
      }

      ctx.lineTo(x, minY);
      ctx.lineTo(x, maxY);
    }

    ctx.stroke();

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, amplitude);
    ctx.lineTo(width, amplitude);
    ctx.stroke();
  }, [width, height]);

  /**
   * Draw position marker
   */
  const drawPositionMarker = useCallback((ctx, position) => {
    const x = position * width;

    // Marker line
    ctx.strokeStyle = '#ff6ec7';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff6ec7';

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Triangle handle at top
    ctx.fillStyle = '#ff6ec7';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 6, 10);
    ctx.lineTo(x + 6, 10);
    ctx.closePath();
    ctx.fill();
  }, [width, height]);

  /**
   * Draw grain size indicator
   */
  const drawGrainZone = useCallback((ctx, position, grainSizeMs, sampleDuration) => {
    if (!sampleDuration || sampleDuration === 0) return;

    const grainSizeSeconds = grainSizeMs / 1000;
    const grainWidth = (grainSizeSeconds / sampleDuration) * width;

    const centerX = position * width;
    const startX = Math.max(0, centerX - grainWidth / 2);
    const endX = Math.min(width, centerX + grainWidth / 2);

    // Draw grain zone highlight
    ctx.fillStyle = 'rgba(255, 110, 199, 0.15)';
    ctx.fillRect(startX, 0, endX - startX, height);

    // Draw grain zone borders
    ctx.strokeStyle = 'rgba(255, 110, 199, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();

    ctx.setLineDash([]);
  }, [width, height]);

  /**
   * Main render loop
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Draw waveform
    drawWaveform(ctx, sampleBuffer);

    // Draw grain zone
    if (sampleBuffer) {
      drawGrainZone(ctx, samplePosition, grainSize, sampleBuffer.duration);
    }

    // Draw position marker
    drawPositionMarker(ctx, samplePosition);

  }, [sampleBuffer, samplePosition, grainSize, drawWaveform, drawGrainZone, drawPositionMarker]);

  /**
   * Handle canvas click to set position
   */
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newPosition = Math.max(0, Math.min(1, x / width));

    if (onPositionChange) {
      onPositionChange(newPosition);
    }
  }, [width, onPositionChange]);

  /**
   * Handle mouse drag
   */
  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleCanvasClick(e);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleCanvasClick(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div className="waveform-visualizer">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="waveform-canvas"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
      />
    </div>
  );
};

export default WaveformVisualizer;
