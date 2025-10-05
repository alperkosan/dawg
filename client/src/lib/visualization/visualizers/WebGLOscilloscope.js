/**
 * WebGL OSCILLOSCOPE (XY Mode)
 *
 * GPU-accelerated Lissajous curve visualization
 * Features:
 * - Stereo XY plotting
 * - Phase correlation visualization
 * - Particle trail effects
 * - Glow and persistence
 */

import { WebGLVisualizer } from './WebGLVisualizer.js';

export class WebGLOscilloscope extends WebGLVisualizer {
  constructor(canvas, analyser, options = {}) {
    super(canvas, analyser, {
      mode: 'xy', // 'xy', 'polar'
      trailLength: 100,
      pointSize: 2,
      persistence: 0.95,
      glowIntensity: 0.7,
      color: [0, 1, 0.53, 1],
      ...options
    });

    // Audio data (stereo)
    this.leftData = new Float32Array(this.analyser.fftSize);
    this.rightData = new Float32Array(this.analyser.fftSize);

    // Trail buffer (for persistence effect)
    this.trailBuffer = [];
    this.maxTrails = this.options.trailLength;

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
      attribute float a_age;

      uniform vec2 u_resolution;
      uniform float u_pointSize;

      varying float v_age;

      void main() {
        vec2 pos = (a_position / u_resolution) * 2.0 - 1.0;
        pos.y = -pos.y;

        gl_Position = vec4(pos, 0.0, 1.0);
        gl_PointSize = u_pointSize * (1.0 - a_age * 0.5);
        v_age = a_age;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;

      uniform vec4 u_color;
      uniform float u_glowIntensity;

      varying float v_age;

      void main() {
        // Circular point shape
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        float r = dot(cxy, cxy);

        if (r > 1.0) discard;

        // Fade based on age
        float alpha = 1.0 - v_age;

        // Glow effect
        float glow = exp(-r * 3.0) * u_glowIntensity;

        vec4 color = u_color;
        color.rgb += vec3(glow);
        color.a *= alpha;

        gl_FragColor = color;
      }
    `;

    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
    this.gl.useProgram(this.program);

    // Get attribute locations
    this.attribs = {
      position: this.gl.getAttribLocation(this.program, 'a_position'),
      age: this.gl.getAttribLocation(this.program, 'a_age')
    };

    // Create buffers
    this.positionBuffer = this.gl.createBuffer();
    this.ageBuffer = this.gl.createBuffer();
  }

  /**
   * Update oscilloscope data
   */
  update() {
    if (!this.analyser) return;

    // Get time domain data
    this.analyser.getFloatTimeDomainData(this.leftData);

    // For stereo, we'd need two analysers
    // For now, create synthetic right channel from left
    for (let i = 0; i < this.leftData.length; i++) {
      // Simple phase shift for demo
      const phase = i / this.leftData.length * Math.PI * 2;
      this.rightData[i] = this.leftData[i] * Math.cos(phase * 0.5);
    }
  }

  /**
   * Render oscilloscope
   */
  render(timestamp) {
    if (!this.isRunning || !this.gl) return;

    const gl = this.gl;

    // Update data
    this.update();

    // Clear with persistence
    const bg = this.options.backgroundColor;
    const persist = this.options.persistence;
    gl.clearColor(bg[0], bg[1], bg[2], 1.0 - persist);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use program
    gl.useProgram(this.program);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) * 0.4;

    // Build XY positions from stereo data
    const positions = [];
    const ages = [];

    // Current frame points (newest)
    for (let i = 0; i < this.leftData.length; i += 4) { // Downsample for performance
      const x = centerX + this.leftData[i] * scale;
      const y = centerY + this.rightData[i] * scale;

      positions.push(x, y);
      ages.push(0); // New points have age 0
    }

    // Add trail (older points with increasing age)
    this.trailBuffer.forEach((trail, index) => {
      const age = index / this.trailBuffer.length;
      trail.forEach(point => {
        positions.push(point.x, point.y);
        ages.push(age);
      });
    });

    // Store current frame for trail
    const currentPoints = [];
    for (let i = 0; i < this.leftData.length; i += 4) {
      const x = centerX + this.leftData[i] * scale;
      const y = centerY + this.rightData[i] * scale;
      currentPoints.push({ x, y });
    }

    this.trailBuffer.unshift(currentPoints);
    if (this.trailBuffer.length > this.maxTrails) {
      this.trailBuffer.pop();
    }

    // Update buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.ageBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ages), gl.DYNAMIC_DRAW);

    // Set uniforms
    this.setUniform('u_resolution', [width, height], 'vec2');
    this.setUniform('u_color', this.options.color, 'vec4');
    this.setUniform('u_glowIntensity', this.options.glowIntensity, 'float');
    this.setUniform('u_pointSize', this.options.pointSize, 'float');

    // Enable attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.ageBuffer);
    gl.enableVertexAttribArray(this.attribs.age);
    gl.vertexAttribPointer(this.attribs.age, 1, gl.FLOAT, false, 0, 0);

    // Draw points
    gl.drawArrays(gl.POINTS, 0, positions.length / 2);

    // Draw center crosshair
    this.drawCrosshair(centerX, centerY);

    this.frameCount++;
  }

  /**
   * Draw center crosshair
   */
  drawCrosshair(x, y) {
    const gl = this.gl;
    const size = 10;

    const crosshairPositions = [
      x - size, y,
      x + size, y,
      x, y - size,
      x, y + size
    ];

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(crosshairPositions), gl.DYNAMIC_DRAW);

    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 2, gl.FLOAT, false, 0, 0);

    // Draw lines
    gl.lineWidth(1);
    gl.drawArrays(gl.LINES, 0, 4);
  }

  /**
   * Set persistence (trail length effect)
   */
  setPersistence(value) {
    this.options.persistence = Math.max(0, Math.min(1, value));
  }

  /**
   * Set trail length
   */
  setTrailLength(length) {
    this.maxTrails = length;
    this.options.trailLength = length;
  }
}
