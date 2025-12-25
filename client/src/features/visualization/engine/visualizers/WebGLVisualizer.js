/**
 * WebGL VISUALIZER BASE CLASS
 *
 * GPU-accelerated audio visualization
 * Features:
 * - Hardware acceleration via WebGL
 * - Shader-based rendering
 * - Minimal CPU overhead
 * - High frame rate (120fps+ capable)
 */

export class WebGLVisualizer {
  constructor(canvas, analyser, options = {}) {
    this.canvas = canvas;
    this.analyser = analyser;
    this.options = {
      backgroundColor: [0, 0, 0, 1],
      foregroundColor: [0, 1, 0.53, 1], // #00ff88
      ...options
    };

    // WebGL context
    this.gl = null;
    this.program = null;
    this.isRunning = false;

    // Buffers
    this.vertexBuffer = null;
    this.audioTexture = null;

    // Uniforms
    this.uniforms = {};

    // Performance
    this.frameCount = 0;
    this.lastTime = 0;

    // Initialize WebGL
    this.initWebGL();
  }

  /**
   * Initialize WebGL context
   */
  initWebGL() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance'
    }) || this.canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance'
    });

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    this.gl = gl;

    // Set viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    console.log('✅ WebGL context initialized');
  }

  /**
   * Compile shader
   */
  compileShader(source, type) {
    const gl = this.gl;
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Create shader program
   */
  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;

    const vertexShader = this.compileShader(vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentSource, gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  }

  /**
   * Create vertex buffer
   */
  createVertexBuffer(vertices) {
    const gl = this.gl;
    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    return buffer;
  }

  /**
   * Create texture for audio data
   */
  createAudioTexture(size) {
    const gl = this.gl;
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Initialize with empty data
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      size,
      1,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      null
    );

    return texture;
  }

  /**
   * Update audio texture with new data
   */
  updateAudioTexture(dataArray) {
    const gl = this.gl;

    // Convert Float32Array to Uint8Array (0-255 range)
    const uint8Data = new Uint8Array(dataArray.length);
    for (let i = 0; i < dataArray.length; i++) {
      uint8Data[i] = ((dataArray[i] + 1) / 2) * 255;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.audioTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      dataArray.length,
      1,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      uint8Data
    );
  }

  /**
   * Get uniform location
   */
  getUniform(name) {
    if (!this.uniforms[name]) {
      this.uniforms[name] = this.gl.getUniformLocation(this.program, name);
    }
    return this.uniforms[name];
  }

  /**
   * Set uniform value
   */
  setUniform(name, value, type = 'float') {
    const gl = this.gl;
    const location = this.getUniform(name);

    if (!location) return;

    switch (type) {
      case 'float':
        gl.uniform1f(location, value);
        break;
      case 'vec2':
        gl.uniform2fv(location, value);
        break;
      case 'vec3':
        gl.uniform3fv(location, value);
        break;
      case 'vec4':
        gl.uniform4fv(location, value);
        break;
      case 'int':
        gl.uniform1i(location, value);
        break;
    }
  }

  /**
   * Clear canvas
   */
  clear() {
    const gl = this.gl;
    const bg = this.options.backgroundColor;

    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * Resize canvas
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  /**
   * Lifecycle: Start
   */
  start() {
    this.isRunning = true;
  }

  /**
   * Lifecycle: Stop
   */
  stop() {
    this.isRunning = false;
  }

  /**
   * Lifecycle: Render (override in subclass)
   */
  render(timestamp) {
    // Override in subclass
  }

  /**
   * Lifecycle: Destroy
   */
  destroy() {
    this.stop();

    const gl = this.gl;

    // Guard: check if WebGL context exists
    if (!gl) {
      this.canvas = null;
      this.analyser = null;
      return;
    }

    if (this.vertexBuffer) {
      gl.deleteBuffer(this.vertexBuffer);
    }

    if (this.audioTexture) {
      gl.deleteTexture(this.audioTexture);
    }

    if (this.program) {
      gl.deleteProgram(this.program);
    }

    this.gl = null;
    this.canvas = null;
    this.analyser = null;
  }

  /**
   * Get performance stats
   */
  getStats() {
    return {
      frameCount: this.frameCount,
      fps: this.calculateFPS()
    };
  }

  /**
   * Calculate FPS
   */
  calculateFPS() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    return delta > 0 ? 1000 / delta : 0;
  }
}
