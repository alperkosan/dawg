/**
 * WebGL SPECTRUM ANALYZER
 *
 * GPU-accelerated frequency spectrum visualization
 * Features:
 * - Real-time FFT display
 * - Gradient bars with glow effect
 * - Logarithmic frequency scaling
 * - Peak hold indicators
 * - Smooth interpolation via shaders
 */

import { WebGLVisualizer } from './WebGLVisualizer.js';

export class WebGLSpectrumAnalyzer extends WebGLVisualizer {
  constructor(canvas, analyser, options = {}) {
    super(canvas, analyser, {
      barCount: 64,
      peakHold: true,
      peakDecay: 0.95,
      smoothing: 0.8,
      logScale: true,
      gradientStart: [0, 1, 0.53, 1], // #00ff88
      gradientEnd: [0.91, 0.3, 0.24, 1], // #e74c3c
      ...options
    });

    // Audio data
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.peakValues = new Float32Array(this.options.barCount).fill(0);

    // Initialize shaders
    this.initShaders();
    this.initBuffers();
  }

  /**
   * Initialize WebGL shaders
   */
  initShaders() {
    const vertexShaderSource = `
      precision mediump float;

      attribute vec2 a_position;
      attribute float a_magnitude;
      attribute float a_peak;

      uniform vec2 u_resolution;
      uniform float u_barWidth;

      varying float v_magnitude;
      varying float v_peak;
      varying vec2 v_position;

      void main() {
        // Normalize coordinates to -1 to 1
        vec2 pos = (a_position / u_resolution) * 2.0 - 1.0;
        pos.y = -pos.y; // Flip Y

        gl_Position = vec4(pos, 0.0, 1.0);
        v_magnitude = a_magnitude;
        v_peak = a_peak;
        v_position = a_position / u_resolution;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;

      uniform vec4 u_gradientStart;
      uniform vec4 u_gradientEnd;
      uniform float u_time;

      varying float v_magnitude;
      varying float v_peak;
      varying vec2 v_position;

      void main() {
        // Gradient based on height
        float t = v_position.y;
        vec4 color = mix(u_gradientStart, u_gradientEnd, t);

        // Add glow effect
        float glow = smoothstep(0.0, 0.1, v_magnitude) * 0.3;
        color.rgb += vec3(glow);

        // Peak indicator (white line)
        float peakDist = abs(v_position.y - (1.0 - v_peak));
        if (peakDist < 0.01) {
          color = vec4(1.0, 1.0, 1.0, 1.0);
        }

        // Fade out based on magnitude
        color.a *= step(0.01, v_magnitude);

        gl_FragColor = color;
      }
    `;

    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
    this.gl.useProgram(this.program);

    // Get attribute locations
    this.attribs = {
      position: this.gl.getAttribLocation(this.program, 'a_position'),
      magnitude: this.gl.getAttribLocation(this.program, 'a_magnitude'),
      peak: this.gl.getAttribLocation(this.program, 'a_peak')
    };
  }

  /**
   * Initialize buffers
   */
  initBuffers() {
    const gl = this.gl;
    const { barCount } = this.options;

    // Create buffers for each bar (6 vertices per bar = 2 triangles)
    this.positionBuffer = gl.createBuffer();
    this.magnitudeBuffer = gl.createBuffer();
    this.peakBuffer = gl.createBuffer();

    // Index buffer for triangle drawing
    const indices = [];
    for (let i = 0; i < barCount; i++) {
      const base = i * 4;
      indices.push(base, base + 1, base + 2);
      indices.push(base, base + 2, base + 3);
    }

    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  /**
   * Update visualization
   */
  update() {
    if (!this.analyser) return;

    // Get frequency data
    this.analyser.getByteFrequencyData(this.frequencyData);

    // Process bars
    const { barCount, logScale, peakHold, peakDecay } = this.options;
    const barValues = new Float32Array(barCount);

    for (let i = 0; i < barCount; i++) {
      // Map bar index to frequency bin (logarithmic or linear)
      const binIndex = logScale
        ? Math.floor(Math.pow(i / barCount, 2) * this.frequencyData.length)
        : Math.floor((i / barCount) * this.frequencyData.length);

      // Get magnitude (0-1 range)
      const magnitude = this.frequencyData[binIndex] / 255;
      barValues[i] = magnitude;

      // Update peak
      if (peakHold) {
        if (magnitude > this.peakValues[i]) {
          this.peakValues[i] = magnitude;
        } else {
          this.peakValues[i] *= peakDecay;
        }
      }
    }

    return barValues;
  }

  /**
   * Render spectrum
   */
  render(timestamp) {
    if (!this.isRunning || !this.gl) return;

    const gl = this.gl;
    const barValues = this.update();

    if (!barValues) return;

    // Clear
    this.clear();

    // Use program
    gl.useProgram(this.program);

    const { barCount } = this.options;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const barWidth = width / barCount;
    const gap = barWidth * 0.1;

    // Build vertex data
    const positions = [];
    const magnitudes = [];
    const peaks = [];

    for (let i = 0; i < barCount; i++) {
      const x = i * barWidth;
      const barHeight = barValues[i] * height;
      const peakHeight = this.peakValues[i] * height;

      // Quad vertices (2 triangles)
      positions.push(
        x + gap, height,           // Bottom-left
        x + barWidth - gap, height, // Bottom-right
        x + barWidth - gap, height - barHeight, // Top-right
        x + gap, height - barHeight  // Top-left
      );

      // Magnitude for each vertex
      const mag = barValues[i];
      magnitudes.push(mag, mag, mag, mag);

      // Peak for each vertex
      const peak = this.peakValues[i];
      peaks.push(peak, peak, peak, peak);
    }

    // Update buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.magnitudeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(magnitudes), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.peakBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(peaks), gl.DYNAMIC_DRAW);

    // Set uniforms
    this.setUniform('u_resolution', [width, height], 'vec2');
    this.setUniform('u_barWidth', barWidth, 'float');
    this.setUniform('u_time', timestamp / 1000, 'float');
    this.setUniform('u_gradientStart', this.options.gradientStart, 'vec4');
    this.setUniform('u_gradientEnd', this.options.gradientEnd, 'vec4');

    // Enable attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.magnitudeBuffer);
    gl.enableVertexAttribArray(this.attribs.magnitude);
    gl.vertexAttribPointer(this.attribs.magnitude, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.peakBuffer);
    gl.enableVertexAttribArray(this.attribs.peak);
    gl.vertexAttribPointer(this.attribs.peak, 1, gl.FLOAT, false, 0, 0);

    // Draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.TRIANGLES, barCount * 6, gl.UNSIGNED_SHORT, 0);

    this.frameCount++;
  }

  /**
   * Set gradient colors
   */
  setGradient(startColor, endColor) {
    this.options.gradientStart = startColor;
    this.options.gradientEnd = endColor;
  }

  /**
   * Set bar count
   */
  setBarCount(count) {
    this.options.barCount = count;
    this.peakValues = new Float32Array(count).fill(0);
    this.initBuffers();
  }
}
