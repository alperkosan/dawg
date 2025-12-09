/**
 * BASE VISUALIZER
 *
 * Abstract base class for all visualizers
 * Provides common functionality and interface
 */

export class BaseVisualizer {
  constructor(canvas, analyser, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.analyser = analyser;
    this.options = {
      backgroundColor: '#000000',
      foregroundColor: '#00ff00',
      lineWidth: 2,
      ...options
    };

    this.isRunning = false;
    this.animationId = null;

    // High DPI support
    this.setupHighDPI();
  }

  /**
   * Setup high DPI rendering
   */
  setupHighDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.ctx.scale(dpr, dpr);

    // Store logical size
    this.width = rect.width;
    this.height = rect.height;
  }

  /**
   * Lifecycle: Initialize
   */
  init() {
    // Override in subclass
  }

  /**
   * Lifecycle: Start rendering
   */
  start() {
    this.isRunning = true;
  }

  /**
   * Lifecycle: Stop rendering
   */
  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Lifecycle: Cleanup
   */
  destroy() {
    this.stop();
    this.canvas = null;
    this.ctx = null;
    this.analyser = null;
  }

  /**
   * Update with audio data
   * Called before render
   */
  update(audioData) {
    // Override in subclass
  }

  /**
   * Render to canvas
   * Called on each frame
   */
  render(timestamp) {
    // Override in subclass
  }

  /**
   * Set rendering priority
   */
  setPriority(level) {
    this.priority = level;
  }

  /**
   * Set rendering quality
   */
  setQuality(level) {
    this.quality = level;
  }

  /**
   * Resize canvas
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.setupHighDPI();
  }

  /**
   * Update theme colors
   */
  setTheme(colors) {
    Object.assign(this.options, colors);
  }

  /**
   * Clear canvas
   */
  clear() {
    this.ctx.fillStyle = this.options.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw grid (utility)
   */
  drawGrid(divisions = 8) {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let i = 0; i <= divisions; i++) {
      const x = (i / divisions) * this.width;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let i = 0; i <= divisions; i++) {
      const y = (i / divisions) * this.height;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
  }
}
