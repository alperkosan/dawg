/**
 * FREQUENCY GRAPH
 *
 * Interactive frequency response graph for EQ
 *
 * Features:
 * - Visual frequency response curve
 * - Draggable EQ points
 * - Logarithmic frequency scale
 * - dB scale
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { useControlTheme } from '../useControlTheme';

export const FrequencyGraph = ({
  bands = [], // [{ freq, gain, q, type }]
  onBandChange, // (index, { freq, gain, q }) => void
  width = 400,
  height = 200,
  minFreq = 20,
  maxFreq = 20000,
  minGain = -24,
  maxGain = 24,
  variant = 'default',
  disabled = false,
  showGrid = true,
  className = '',
}) => {
  const { colors } = useControlTheme(variant);

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const dragBandRef = useRef(null);
  const latestPosRef = useRef({ x: 0, y: 0 });
  const onBandChangeRef = useRef(onBandChange);

  useEffect(() => {
    onBandChangeRef.current = onBandChange;
  }, [onBandChange]);

  // Frequency to X position (logarithmic)
  const freqToX = useCallback((freq) => {
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = Math.log10(freq);
    return ((logFreq - logMin) / (logMax - logMin)) * width;
  }, [minFreq, maxFreq, width]);

  // X position to frequency
  const xToFreq = useCallback((x) => {
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = logMin + ((x / width) * (logMax - logMin));
    return Math.pow(10, logFreq);
  }, [minFreq, maxFreq, width]);

  // Gain to Y position
  const gainToY = useCallback((gain) => {
    return height - (((gain - minGain) / (maxGain - minGain)) * height);
  }, [minGain, maxGain, height]);

  // Y position to gain
  const yToGain = useCallback((y) => {
    return minGain + ((height - y) / height) * (maxGain - minGain);
  }, [minGain, maxGain, height]);

  // Draw graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Clear
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    if (showGrid) {
      // Frequency grid (log scale)
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;

      [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach(freq => {
        if (freq >= minFreq && freq <= maxFreq) {
          const x = freqToX(freq);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();

          // Label
          ctx.fillStyle = colors.textMuted;
          ctx.font = '10px monospace';
          const label = freq >= 1000 ? `${freq / 1000}k` : freq;
          ctx.fillText(label, x - 15, height - 5);
        }
      });

      // Gain grid
      [-24, -12, 0, 12, 24].forEach(gain => {
        if (gain >= minGain && gain <= maxGain) {
          const y = gainToY(gain);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();

          // Label
          ctx.fillStyle = colors.textMuted;
          ctx.fillText(`${gain > 0 ? '+' : ''}${gain}dB`, 5, y - 5);
        }
      });

      // Zero line (emphasized)
      const zeroY = gainToY(0);
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }

    // Draw frequency response curve
    if (bands.length > 0) {
      ctx.strokeStyle = colors.fill;
      ctx.lineWidth = 3;
      ctx.beginPath();

      for (let x = 0; x <= width; x += 2) {
        const freq = xToFreq(x);
        let totalGain = 0;

        // Sum gain from all bands
        bands.forEach(band => {
          const { freq: bandFreq, gain, q = 1, type = 'peak' } = band;

          if (type === 'peak' || type === 'lowshelf' || type === 'highshelf') {
            // Simple bell curve approximation
            const freqRatio = freq / bandFreq;
            const logRatio = Math.log2(freqRatio);
            const bellWidth = 1 / q;
            const response = gain / (1 + Math.pow(logRatio / bellWidth, 2));
            totalGain += response;
          }
        });

        const y = gainToY(totalGain);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      // Glow effect
      ctx.shadowColor = colors.fillGlow;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw band control points
    bands.forEach((band, index) => {
      const x = freqToX(band.freq);
      const y = gainToY(band.gain);

      // Point
      ctx.fillStyle = colors.indicator;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = dragBandRef.current === index ? '#fff' : colors.border;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = colors.text;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${index + 1}`, x - 3, y + 4);
    });
  }, [bands, width, height, minFreq, maxFreq, minGain, maxGain, showGrid, colors, freqToX, gainToY, xToFreq]);

  const getHitTest = useCallback((x, y) => {
    const hitRadius = 15;

    for (let i = 0; i < bands.length; i++) {
      const bandX = freqToX(bands[i].freq);
      const bandY = gainToY(bands[i].gain);

      if (Math.abs(x - bandX) < hitRadius && Math.abs(y - bandY) < hitRadius) {
        return i;
      }
    }

    return null;
  }, [bands, freqToX, gainToY]);

  const handleMouseMove = useCallback((e) => {
    if (disabled || dragBandRef.current === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    latestPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      const { x, y } = latestPosRef.current;
      const bandIndex = dragBandRef.current;

      const newFreq = Math.max(minFreq, Math.min(maxFreq, xToFreq(x)));
      const newGain = Math.max(minGain, Math.min(maxGain, yToGain(y)));

      onBandChangeRef.current?.(bandIndex, {
        freq: newFreq,
        gain: newGain,
        q: bands[bandIndex].q,
        type: bands[bandIndex].type,
      });

      rafRef.current = null;
    });
  }, [disabled, bands, minFreq, maxFreq, minGain, maxGain, xToFreq, yToGain]);

  const handleMouseUp = useCallback(() => {
    dragBandRef.current = null;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hitBand = getHitTest(x, y);
    if (hitBand !== null) {
      e.preventDefault();
      dragBandRef.current = hitBand;
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  }, [disabled, getHitTest, handleMouseMove, handleMouseUp]);

  return (
    <div className={`inline-flex flex-col gap-2 ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        className={`rounded-lg border ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          borderColor: colors.border,
        }}
      />
    </div>
  );
};
