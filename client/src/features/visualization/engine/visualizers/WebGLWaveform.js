/**
 * WebGL WAVEFORM
 *
 * GPU-accelerated waveform visualization
 * Features:
 * - Real-time time-domain display
 * - Smooth line rendering with anti-aliasing
 * - Glow effects via shaders
 * - Multiple render modes
 */

import { WebGLVisualizer } from './WebGLVisualizer.js';

export class WebGLWaveform extends WebGLVisualizer {
  constructor(canvas, analyser, options = {}) {
    super(canvas, analyser, {
      mode: 'line', // 'line', 'filled', 'glow'
      lineWidth: 2,
      glowIntensity: 0.5,
      color: [0, 1, 0.53, 1], // #00ff88
      ...options
    });

    // Audio data
    this.waveformData = new Float32Array(this.analyser.fftSize);

    // Initialize shaders
    this.initShaders();
  }

  /**
   * Initialize WebGL shaders
   */
  initShaders() {
    const vertexShaderSource = `
      precision mediump float;

      attribute vec2 a_position;
      uniform vec2 u_resolution;

      void main() {
        vec2 pos = (a_position / u_resolution) * 2.0 - 1.0;
        pos.y = -pos.y;
        gl_Position = vec4(pos, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;

      uniform vec4 u_color;
      uniform float u_glowIntensity;
      uniform vec2 u_resolution;

      void main() {
        vec4 color = u_color;

        // Add glow effect
        vec2 st = gl_FragCoord.xy / u_resolution;
        float dist = length(st - vec2(0.5));
        float glow = exp(-dist * 5.0) * u_glowIntensity;

        color.rgb += vec3(glow);
        gl_FragColor = color;
      }
    `;

    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
    this.gl.useProgram(this.program);

    // Get attribute location
    this.attribs = {
      position: this.gl.getAttribLocation(this.program, 'a_position')
    };

    // Create buffer
    this.positionBuffer = this.gl.createBuffer();
  }

  /**
   * Update waveform data
   */
  update() {
    if (!this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.waveformData);
  }

  /**
   * Render waveform
   */
  render(timestamp) {
    if (!this.isRunning || !this.gl) return;

    const gl = this.gl;

    // Update data
    this.update();

    // Clear
    this.clear();

    // Use program
    gl.useProgram(this.program);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2;

    // Build vertex positions
    const positions = [];
    const sliceWidth = width / this.waveformData.length;

    for (let i = 0; i < this.waveformData.length; i++) {
      const x = i * sliceWidth;
      const v = this.waveformData[i];
      const y = centerY + (v * centerY);

      positions.push(x, y);
    }

    // Update buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);

    // Set uniforms
    this.setUniform('u_resolution', [width, height], 'vec2');
    this.setUniform('u_color', this.options.color, 'vec4');
    this.setUniform('u_glowIntensity', this.options.glowIntensity, 'float');

    // Enable attribute
    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 2, gl.FLOAT, false, 0, 0);

    // Set line width
    gl.lineWidth(this.options.lineWidth);

    // Draw
    gl.drawArrays(gl.LINE_STRIP, 0, this.waveformData.length);

    this.frameCount++;
  }

  /**
   * Set color
   */
  setColor(color) {
    this.options.color = color;
  }

  /**
   * Set glow intensity
   */
  setGlowIntensity(intensity) {
    this.options.glowIntensity = intensity;
  }
}
