/**
 * WEBGL SPECTRUM ANALYZER v2.0
 *
 * Shared, high-performance spectrum visualization service
 * Uses WebGL for smooth 60fps rendering even with large FFT sizes
 *
 * Features:
 * - Multiple visualization modes (bars, line, filled)
 * - Configurable FFT size (512 - 8192)
 * - Frequency range selection
 * - Peak hold with decay
 * - Smooth interpolation
 * - Color gradients (category-based)
 * - Auto-scaling (dB range)
 * - Grid overlay
 * - Frequency labels
 *
 * Problem Solved:
 * Before: Each plugin implemented its own spectrum analyzer (duplicated code, performance issues)
 * After: Single shared service, WebGL-accelerated, consistent across all plugins
 *
 * Usage:
 *   const analyzer = new WebGLSpectrumAnalyzer(canvas, audioContext);
 *   analyzer.connectSource(audioNode);
 *   analyzer.setMode('bars');
 *   analyzer.setColorGradient(['#00A8E8', '#003D5C']);
 *   analyzer.start();
 */

import { renderManager } from './CanvasRenderManager.js';

/**
 * WEBGL SHADER SOURCES
 */
const VERTEX_SHADER = `
  attribute vec2 position;
  attribute vec4 color;
  varying vec4 vColor;

  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    vColor = color;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec4 vColor;

  void main() {
    gl_FragColor = vColor;
  }
`;

/**
 * FREQUENCY SCALE UTILITIES
 */
class FrequencyScale {
  /**
   * Convert frequency to X position (linear scale)
   */
  static linearFreqToX(freq, minFreq, maxFreq) {
    return (freq - minFreq) / (maxFreq - minFreq);
  }

  /**
   * Convert frequency to X position (logarithmic scale)
   */
  static logFreqToX(freq, minFreq, maxFreq) {
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = Math.log10(freq);
    return (logFreq - logMin) / (logMax - logMin);
  }

  /**
   * Get frequency for FFT bin index
   */
  static binToFreq(bin, fftSize, sampleRate) {
    return (bin * sampleRate) / fftSize;
  }

  /**
   * Find FFT bin index for frequency
   */
  static freqToBin(freq, fftSize, sampleRate) {
    return Math.round((freq * fftSize) / sampleRate);
  }

  /**
   * Generate nice frequency labels (20, 50, 100, 200, 500, 1k, 2k, etc.)
   */
  static generateLabels(minFreq, maxFreq) {
    const labels = [];
    const niceFreqs = [
      20, 30, 40, 50, 60, 70, 80, 90,
      100, 200, 300, 400, 500, 600, 700, 800, 900,
      1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
      10000, 12000, 14000, 16000, 18000, 20000
    ];

    for (const freq of niceFreqs) {
      if (freq >= minFreq && freq <= maxFreq) {
        labels.push({
          freq,
          label: freq >= 1000 ? `${freq / 1000}k` : `${freq}`
        });
      }
    }

    return labels;
  }
}

/**
 * COLOR GRADIENT BUILDER
 */
class ColorGradient {
  constructor(stops = ['#00A8E8', '#003D5C']) {
    this.stops = stops.map(hex => this.hexToRgb(hex));
  }

  /**
   * Convert hex to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0.66, b: 0.91 };
  }

  /**
   * Get color at position (0-1)
   */
  getColorAt(t) {
    t = Math.max(0, Math.min(1, t));

    if (this.stops.length === 1) {
      return { ...this.stops[0], a: 1.0 };
    }

    const segmentCount = this.stops.length - 1;
    const segment = Math.floor(t * segmentCount);
    const segmentT = (t * segmentCount) - segment;

    const start = this.stops[Math.min(segment, segmentCount - 1)];
    const end = this.stops[Math.min(segment + 1, segmentCount)];

    return {
      r: start.r + (end.r - start.r) * segmentT,
      g: start.g + (end.g - start.g) * segmentT,
      b: start.b + (end.b - start.b) * segmentT,
      a: 1.0
    };
  }
}

/**
 * WEBGL SPECTRUM ANALYZER
 */
export class WebGLSpectrumAnalyzer {
  constructor(canvas, audioContext, options = {}) {
    this.canvas = canvas;
    this.audioContext = audioContext;

    // WebGL context
    this.gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: false,
      premultipliedAlpha: false
    });

    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    // Configuration
    this.config = {
      fftSize: options.fftSize || 2048,
      smoothing: options.smoothing || 0.75,
      minDecibels: options.minDecibels || -90,
      maxDecibels: options.maxDecibels || -10,
      minFreq: options.minFreq || 20,
      maxFreq: options.maxFreq || 20000,
      mode: options.mode || 'bars', // 'bars' | 'line' | 'filled'
      scale: options.scale || 'log', // 'log' | 'linear'
      peakHold: options.peakHold || true,
      peakDecay: options.peakDecay || 0.92,
      showGrid: options.showGrid || true,
      showLabels: options.showLabels || true,
      barSpacing: options.barSpacing || 0.1,
    };

    // Audio analysis
    this.analyser = null;
    this.sourceNode = null;
    this.freqData = null;
    this.peakData = null;
    this.smoothedData = null;

    // WebGL resources
    this.program = null;
    this.buffers = {
      position: null,
      color: null,
    };

    // Color gradient
    this.gradient = new ColorGradient(options.colors || ['#00A8E8', '#003D5C']);

    // Rendering
    this.rendererId = null;
    this.running = false;

    // Initialize
    this._initWebGL();
    this._initAnalyser();
  }

  /**
   * INITIALIZATION
   */

  /**
   * Initialize WebGL shaders and buffers
   */
  _initWebGL() {
    const gl = this.gl;

    // Compile shaders
    const vertexShader = this._compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    // Link program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('WebGL program link failed: ' + gl.getProgramInfoLog(this.program));
    }

    gl.useProgram(this.program);

    // Get attribute locations
    this.attribLocations = {
      position: gl.getAttribLocation(this.program, 'position'),
      color: gl.getAttribLocation(this.program, 'color'),
    };

    // Create buffers
    this.buffers.position = gl.createBuffer();
    this.buffers.color = gl.createBuffer();

    // Set clear color (dark background)
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /**
   * Compile shader
   */
  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compilation failed: ' + info);
    }

    return shader;
  }

  /**
   * Initialize audio analyser
   */
  _initAnalyser() {
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = this.config.smoothing;
    this.analyser.minDecibels = this.config.minDecibels;
    this.analyser.maxDecibels = this.config.maxDecibels;

    const bufferLength = this.analyser.frequencyBinCount;
    this.freqData = new Uint8Array(bufferLength);
    this.peakData = new Float32Array(bufferLength);
    this.smoothedData = new Float32Array(bufferLength);
  }

  /**
   * Connect audio source
   */
  connectSource(sourceNode) {
    // ✅ FIX: Only disconnect if connecting a DIFFERENT source
    // This prevents breaking the audio chain when UI reopens with same source
    if (this.sourceNode && this.sourceNode !== sourceNode) {
      try {
        this.sourceNode.disconnect(this.analyser);
      } catch (error) {
        // Already disconnected - this is fine, ignore the error
        console.log('ℹ️ Old source node already disconnected');
      }
    }

    // ✅ FIX: Only connect if not already connected to this source
    if (this.sourceNode !== sourceNode) {
      this.sourceNode = sourceNode;
      try {
        this.sourceNode.connect(this.analyser);
        console.log('🎨 WebGL Spectrum: Connected audio source');
      } catch (error) {
        console.warn('⚠️ Failed to connect spectrum analyzer:', error);
      }
    } else {
      console.log('ℹ️ Source already connected, skipping reconnection');
    }
  }

  /**
   * Disconnect audio source
   */
  disconnectSource() {
    if (this.sourceNode) {
      try {
        // ✅ FIX: Try to disconnect, but don't throw if already disconnected
        // This can happen when effects are reordered and the chain is rebuilt
        this.sourceNode.disconnect(this.analyser);
      } catch (error) {
        // Already disconnected - this is fine, ignore the error
        console.log('ℹ️ Source node already disconnected (likely due to effect reordering)');
      }
      this.sourceNode = null;
    }
  }

  /**
   * CONFIGURATION
   */

  /**
   * Set visualization mode
   */
  setMode(mode) {
    this.config.mode = mode;
  }

  /**
   * Set color gradient
   */
  setColorGradient(colors) {
    this.gradient = new ColorGradient(colors);
  }

  /**
   * Set frequency range
   */
  setFrequencyRange(minFreq, maxFreq) {
    this.config.minFreq = minFreq;
    this.config.maxFreq = maxFreq;
  }

  /**
   * Set FFT size
   */
  setFFTSize(size) {
    this.config.fftSize = size;
    this.analyser.fftSize = size;

    const bufferLength = this.analyser.frequencyBinCount;
    this.freqData = new Uint8Array(bufferLength);
    this.peakData = new Float32Array(bufferLength);
    this.smoothedData = new Float32Array(bufferLength);
  }

  /**
   * Set dB range
   */
  setDecibelRange(min, max) {
    this.config.minDecibels = min;
    this.config.maxDecibels = max;
    this.analyser.minDecibels = min;
    this.analyser.maxDecibels = max;
  }

  /**
   * RENDERING
   */

  /**
   * Start rendering
   */
  start() {
    if (this.running) return;

    this.running = true;
    this.rendererId = renderManager.register(
      `spectrum_${Math.random().toString(36).substr(2, 9)}`,
      () => this._render(),
      5, // High priority (visualizations)
      16, // 60fps
      true // ✅ Continuous rendering (always active)
    );

    console.log('▶️ WebGL Spectrum Analyzer started');
  }

  /**
   * Stop rendering
   */
  stop() {
    if (!this.running) return;

    this.running = false;
    if (this.rendererId) {
      renderManager.unregister(this.rendererId);
      this.rendererId = null;
    }

    console.log('⏸️ WebGL Spectrum Analyzer stopped');
  }

  /**
   * Main render loop
   */
  _render() {
    if (!this.analyser) return;

    // Set viewport to match canvas dimensions (handles DPR and resize)
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Get frequency data
    this.analyser.getByteFrequencyData(this.freqData);

    // Update smoothed data and peaks
    this._updateData();

    // Render based on mode
    switch (this.config.mode) {
      case 'bars':
        this._renderBars();
        break;
      case 'line':
        this._renderLine();
        break;
      case 'filled':
        this._renderFilled();
        break;
    }

    // Overlay grid if enabled
    if (this.config.showGrid) {
      this._renderGrid();
    }
  }

  /**
   * Update smoothed data and peak hold
   */
  _updateData() {
    const { minFreq, maxFreq, scale } = this.config;
    const sampleRate = this.audioContext.sampleRate;
    const binCount = this.freqData.length;

    for (let i = 0; i < binCount; i++) {
      const freq = FrequencyScale.binToFreq(i, this.config.fftSize, sampleRate);

      // Skip bins outside frequency range
      if (freq < minFreq || freq > maxFreq) continue;

      // Normalize to 0-1
      const value = this.freqData[i] / 255;

      // Smooth
      this.smoothedData[i] = this.smoothedData[i] * 0.7 + value * 0.3;

      // Peak hold
      if (this.config.peakHold) {
        if (value > this.peakData[i]) {
          this.peakData[i] = value;
        } else {
          this.peakData[i] *= this.config.peakDecay;
        }
      }
    }
  }

  /**
   * Render bars mode
   */
  _renderBars() {
    const gl = this.gl;
    const { minFreq, maxFreq, scale, barSpacing } = this.config;
    const sampleRate = this.audioContext.sampleRate;

    gl.clear(gl.COLOR_BUFFER_BIT);

    // Calculate visible bins
    const minBin = FrequencyScale.freqToBin(minFreq, this.config.fftSize, sampleRate);
    const maxBin = FrequencyScale.freqToBin(maxFreq, this.config.fftSize, sampleRate);
    const binCount = maxBin - minBin;

    if (binCount <= 0) return;

    // Build vertex data
    const vertices = [];
    const colors = [];

    for (let i = minBin; i < maxBin; i++) {
      const freq = FrequencyScale.binToFreq(i, this.config.fftSize, sampleRate);

      // X position (0 to 1)
      let x;
      if (scale === 'log') {
        x = FrequencyScale.logFreqToX(freq, minFreq, maxFreq);
      } else {
        x = FrequencyScale.linearFreqToX(freq, minFreq, maxFreq);
      }

      // Convert to clip space (-1 to 1)
      const x1 = x * 2 - 1;
      const x2 = ((i - minBin + 1) / binCount) * 2 - 1;
      const barWidth = (x2 - x1) * (1 - barSpacing);

      // Height (0 to 1)
      const height = this.smoothedData[i];
      const y = (height * 2) - 1; // -1 to 1

      // Color (gradient based on frequency)
      const color = this.gradient.getColorAt(x);

      // Two triangles per bar
      // Triangle 1
      vertices.push(x1, -1);           // Bottom left
      vertices.push(x1 + barWidth, -1); // Bottom right
      vertices.push(x1, y);             // Top left

      // Triangle 2
      vertices.push(x1 + barWidth, -1); // Bottom right
      vertices.push(x1 + barWidth, y);  // Top right
      vertices.push(x1, y);             // Top left

      // Colors (6 vertices)
      for (let j = 0; j < 6; j++) {
        colors.push(color.r, color.g, color.b, color.a);
      }
    }

    // Upload to GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribLocations.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.attribLocations.color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribLocations.color);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
  }

  /**
   * Render line mode
   */
  _renderLine() {
    const gl = this.gl;
    const { minFreq, maxFreq, scale } = this.config;
    const sampleRate = this.audioContext.sampleRate;

    gl.clear(gl.COLOR_BUFFER_BIT);

    const minBin = FrequencyScale.freqToBin(minFreq, this.config.fftSize, sampleRate);
    const maxBin = FrequencyScale.freqToBin(maxFreq, this.config.fftSize, sampleRate);

    const vertices = [];
    const colors = [];

    for (let i = minBin; i < maxBin; i++) {
      const freq = FrequencyScale.binToFreq(i, this.config.fftSize, sampleRate);

      let x;
      if (scale === 'log') {
        x = FrequencyScale.logFreqToX(freq, minFreq, maxFreq);
      } else {
        x = FrequencyScale.linearFreqToX(freq, minFreq, maxFreq);
      }

      const height = this.smoothedData[i];
      const y = (height * 2) - 1;

      vertices.push(x * 2 - 1, y);

      const color = this.gradient.getColorAt(x);
      colors.push(color.r, color.g, color.b, color.a);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribLocations.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.attribLocations.color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribLocations.color);

    gl.lineWidth(2);
    gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 2);
  }

  /**
   * Render filled mode (area under curve)
   */
  _renderFilled() {
    const gl = this.gl;
    const { minFreq, maxFreq, scale } = this.config;
    const sampleRate = this.audioContext.sampleRate;

    gl.clear(gl.COLOR_BUFFER_BIT);

    const minBin = FrequencyScale.freqToBin(minFreq, this.config.fftSize, sampleRate);
    const maxBin = FrequencyScale.freqToBin(maxFreq, this.config.fftSize, sampleRate);

    const vertices = [];
    const colors = [];

    // Build triangle strip
    for (let i = minBin; i < maxBin; i++) {
      const freq = FrequencyScale.binToFreq(i, this.config.fftSize, sampleRate);

      let x;
      if (scale === 'log') {
        x = FrequencyScale.logFreqToX(freq, minFreq, maxFreq);
      } else {
        x = FrequencyScale.linearFreqToX(freq, minFreq, maxFreq);
      }

      const height = this.smoothedData[i];
      const y = (height * 2) - 1;

      const xClip = x * 2 - 1;

      // Top vertex
      vertices.push(xClip, y);
      const colorTop = this.gradient.getColorAt(x);
      colors.push(colorTop.r, colorTop.g, colorTop.b, 0.8);

      // Bottom vertex
      vertices.push(xClip, -1);
      const colorBottom = this.gradient.getColorAt(x);
      colors.push(colorBottom.r, colorBottom.g, colorBottom.b, 0.2);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribLocations.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.attribLocations.color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribLocations.color);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertices.length / 2);
  }

  /**
   * Render frequency grid overlay
   */
  _renderGrid() {
    // TODO: Implement grid rendering (frequency lines, dB lines)
    // This would use a separate shader pass with dashed lines
  }

  /**
   * CLEANUP
   */

  /**
   * Cleanup resources
   */
  dispose() {
    this.stop();
    this.disconnectSource();

    const gl = this.gl;
    if (gl) {
      gl.deleteBuffer(this.buffers.position);
      gl.deleteBuffer(this.buffers.color);
      gl.deleteProgram(this.program);
    }

    console.log('🧹 WebGL Spectrum Analyzer disposed');
  }

  /**
   * Resize canvas
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }
}

/**
 * REACT HOOK
 */
import { useEffect, useRef } from 'react';

export const useWebGLSpectrum = (audioNode, audioContext, options = {}) => {
  const canvasRef = useRef(null);
  const analyzerRef = useRef(null);
  const audioNodeRef = useRef(null); // ✅ FIX: Track audio node to detect changes
  const mountCountRef = useRef(0); // ✅ FIX: Track mount count for Strict Mode

  useEffect(() => {
    mountCountRef.current += 1;
    const currentMountCount = mountCountRef.current;

    if (!canvasRef.current || !audioContext || !audioNode) {
      console.log('[useWebGLSpectrum] Waiting for dependencies:', {
        hasCanvas: !!canvasRef.current,
        hasContext: !!audioContext,
        hasNode: !!audioNode
      });
      return;
    }

    // ✅ FIX: If analyzer exists and audio node hasn't changed, skip re-initialization
    if (analyzerRef.current && audioNodeRef.current === audioNode) {
      console.log('[useWebGLSpectrum] Analyzer already initialized with same audio node, skipping');
      return;
    }

    // ✅ FIX: If audio node changed, update the connection without recreating analyzer
    if (analyzerRef.current && audioNodeRef.current !== audioNode) {
      console.log('[useWebGLSpectrum] Audio node changed, updating connection');
      analyzerRef.current.connectSource(audioNode);
      audioNodeRef.current = audioNode;
      return;
    }

    console.log('[useWebGLSpectrum] Initializing analyzer');

    // Create analyzer (only on first mount)
    const analyzer = new WebGLSpectrumAnalyzer(canvasRef.current, audioContext, options);
    analyzer.connectSource(audioNode);
    analyzer.start();
    analyzerRef.current = analyzer;
    audioNodeRef.current = audioNode;

    console.log('[useWebGLSpectrum] Analyzer started');

    // ✅ FIX: Only cleanup if this is the LAST mount (not React Strict Mode remount)
    return () => {
      // Wait a tick to see if component remounts (Strict Mode behavior)
      setTimeout(() => {
        // If mount count increased, this was a Strict Mode unmount, don't cleanup
        if (mountCountRef.current > currentMountCount) {
          console.log('[useWebGLSpectrum] Skipping cleanup - React Strict Mode remount detected');
          return;
        }

        console.log('[useWebGLSpectrum] Component unmounting, cleaning up analyzer');
        if (analyzerRef.current) {
          analyzerRef.current.dispose();
          analyzerRef.current = null;
        }
        audioNodeRef.current = null;
      }, 0);
    };
  }, [audioContext, audioNode]); // ✅ FIX: Removed 'options' from dependencies to prevent re-initialization

  // Update options dynamically without recreating analyzer
  useEffect(() => {
    if (!analyzerRef.current) return;

    if (options.mode) analyzerRef.current.setMode(options.mode);
    if (options.colors) analyzerRef.current.setColorGradient(options.colors);
    if (options.minFreq || options.maxFreq) {
      analyzerRef.current.setFrequencyRange(
        options.minFreq || 20,
        options.maxFreq || 20000
      );
    }
  }, [options.mode, options.colors, options.minFreq, options.maxFreq]);

  return { canvasRef, analyzer: analyzerRef.current };
};

export default WebGLSpectrumAnalyzer;

