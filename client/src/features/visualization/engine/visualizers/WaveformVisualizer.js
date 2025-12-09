/**
 * WAVEFORM VISUALIZER
 *
 * Real-time waveform display with optimization
 * Features:
 * - Ring buffer for smooth scrolling
 * - Adaptive downsampling based on quality
 * - Multiple rendering modes (line, filled, mirror)
 */

import { BaseVisualizer } from './BaseVisualizer.js';

export class WaveformVisualizer extends BaseVisualizer {
  constructor(canvas, analyser, options = {}) {
    super(canvas, analyser, {
      mode: 'line', // 'line', 'filled', 'mirror'
      color: '#00ff88',
      backgroundColor: '#0a0a0a',
      showGrid: false,
      smoothing: 0.8,
      ...options
    });

    // Audio data buffer
    this.bufferLength = this.analyser.fftSize;
    this.dataArray = new Float32Array(this.bufferLength);

    // Ring buffer for history (optional)
    this.historySize = 256;
    this.history = new Float32Array(this.historySize);
    this.historyIndex = 0;
  }

  /**
   * Update with latest audio data
   */
  update() {
    if (!this.analyser) return;

    // Get time domain data
    this.analyser.getFloatTimeDomainData(this.dataArray);

    // Store in history (for scrolling waveform)
    const avgSample = this.dataArray.reduce((a, b) => a + Math.abs(b), 0) / this.dataArray.length;
    this.history[this.historyIndex] = avgSample;
    this.historyIndex = (this.historyIndex + 1) % this.historySize;
  }

  /**
   * Render waveform
   */
  render(timestamp) {
    if (!this.isRunning || !this.ctx) return;

    // Update data
    this.update();

    // Clear
    this.clear();

    // Draw grid (optional)
    if (this.options.showGrid) {
      this.drawGrid();
    }

    // Render based on mode
    switch(this.options.mode) {
      case 'filled':
        this.renderFilled();
        break;
      case 'mirror':
        this.renderMirror();
        break;
      case 'line':
      default:
        this.renderLine();
    }
  }

  /**
   * Render line waveform
   */
  renderLine() {
    const { ctx, width, height, dataArray, bufferLength } = this;

    ctx.lineWidth = 2;
    ctx.strokeStyle = this.options.color;
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i];
      const y = ((v + 1) / 2) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();
  }

  /**
   * Render filled waveform
   */
  renderFilled() {
    const { ctx, width, height, dataArray, bufferLength } = this;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, this.options.color + '88');
    gradient.addColorStop(0.5, this.options.color);
    gradient.addColorStop(1, this.options.color + '88');

    ctx.fillStyle = gradient;
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    // Top half
    ctx.moveTo(0, height / 2);
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i];
      const y = ((v + 1) / 2) * height;
      ctx.lineTo(x, y);
      x += sliceWidth;
    }

    // Bottom (mirror)
    x = width;
    for (let i = bufferLength - 1; i >= 0; i--) {
      ctx.lineTo(x, height / 2);
      x -= sliceWidth;
    }

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Render mirror waveform (top/bottom symmetry)
   */
  renderMirror() {
    const { ctx, width, height, dataArray, bufferLength } = this;

    ctx.lineWidth = 2;
    ctx.strokeStyle = this.options.color;

    const sliceWidth = width / bufferLength;
    const centerY = height / 2;
    let x = 0;

    // Top waveform
    ctx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i];
      const y = centerY - (v * centerY);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }
    ctx.stroke();

    // Bottom waveform (mirrored)
    x = 0;
    ctx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i];
      const y = centerY + (v * centerY);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }
    ctx.stroke();

    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  /**
   * Set waveform rendering mode
   */
  setMode(mode) {
    if (['line', 'filled', 'mirror'].includes(mode)) {
      this.options.mode = mode;
    }
  }
}
