import React, { useEffect, useRef } from 'react';
import './SaturatorVisualizer.css';

/**
 * Saturator Visualizer
 *
 * Shows transfer curve (input vs output) and harmonic content
 * More CPU-friendly - uses Canvas 2D instead of WebGL
 */
export const SaturatorVisualizer = ({ effectNode, distortion, wet }) => {
  const transferCanvasRef = useRef(null);
  const spectrumCanvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);

  // Initialize analyser (lightweight, only one for spectrum)
  useEffect(() => {
    if (!effectNode) return;

    const audioContext = effectNode.context;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512; // Small FFT for performance
    analyser.smoothingTimeConstant = 0.9; // Heavy smoothing

    try {
      effectNode.connect(analyser);
      analyserRef.current = analyser;
    } catch (error) {
      console.warn('Failed to connect analyser:', error);
    }

    return () => {
      if (analyser) {
        try {
          analyser.disconnect();
        } catch (e) {}
      }
    };
  }, [effectNode]);

  // Draw transfer curve (static, updates with distortion)
  useEffect(() => {
    const canvas = transferCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Transfer curve
    const color = getColorForDistortion(distortion);
    ctx.strokeStyle = `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, 1)`;
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const input = (x / width) * 2 - 1; // -1 to 1
      const output = saturate(input, distortion);
      const y = height / 2 - (output * height / 2);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px monospace';
    ctx.fillText('Input →', 10, height - 10);
    ctx.fillText('↑ Output', 10, 20);

  }, [distortion]);

  // Animate spectrum (lightweight)
  useEffect(() => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas || !analyserRef.current) return;

    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      // Clear
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, width, height);

      // Draw bars (only first 32 bins for performance)
      const barCount = 32;
      const barWidth = width / barCount;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] / 255;
        const barHeight = value * height;

        // Color based on frequency and intensity
        const hue = 30 - (value * 30); // Orange to red
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;

        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [effectNode]);

  return (
    <div className="saturator-visualizer">
      <div className="saturator-viz-section">
        <div className="saturator-viz-label">Transfer Curve</div>
        <canvas
          ref={transferCanvasRef}
          className="saturator-viz-canvas"
          width={600}
          height={120}
        />
      </div>

      <div className="saturator-viz-section">
        <div className="saturator-viz-label">Harmonics (0-4kHz)</div>
        <canvas
          ref={spectrumCanvasRef}
          className="saturator-viz-canvas"
          width={600}
          height={120}
        />
      </div>

      <div className="saturator-viz-stats">
        <div className="saturator-stat">
          <span>Drive:</span>
          <span className="saturator-stat-value">
            {(distortion * 100).toFixed(0)}%
          </span>
        </div>
        <div className="saturator-stat">
          <span>Mix:</span>
          <span className="saturator-stat-value">
            {(wet * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Saturation transfer function (tanh-based waveshaping)
 */
function saturate(input, amount) {
  if (amount === 0) return input;

  const x = input * (1 + amount * 10);
  return Math.tanh(x);
}

/**
 * Get color based on distortion amount
 * Clean (green) → Warm (orange) → Hot (red)
 */
function getColorForDistortion(distortion) {
  if (distortion < 0.3) {
    // Green → Yellow
    const t = distortion / 0.3;
    return [
      t,
      1,
      0.53 * (1 - t),
      1
    ];
  } else if (distortion < 0.7) {
    // Yellow → Orange
    const t = (distortion - 0.3) / 0.4;
    return [
      1,
      1 - t * 0.45,
      0,
      1
    ];
  } else {
    // Orange → Red
    const t = (distortion - 0.7) / 0.8;
    return [
      1,
      0.55 * (1 - t) + 0.3 * t,
      0.24 * t,
      1
    ];
  }
}
