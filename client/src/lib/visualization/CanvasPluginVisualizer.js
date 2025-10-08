/**
 * CANVAS PLUGIN VISUALIZER
 *
 * Base class for 2D canvas-based visualizers.
 * Provides common canvas utilities and helpers.
 */

import { BasePluginVisualizer } from './BasePluginVisualizer';

export class CanvasPluginVisualizer extends BasePluginVisualizer {
  constructor(config) {
    super({ ...config, renderMode: 'canvas' });

    // Canvas state
    this.canvasWidth = 0;
    this.canvasHeight = 0;
  }

  async onInit() {
    if (!this.ctx) {
      console.error(`[${this.id}] Canvas context not available`);
      return;
    }

    // Store canvas dimensions
    const rect = this.canvas.getBoundingClientRect();
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
  }

  onResize(width, height) {
    this.canvasWidth = width / (window.devicePixelRatio || 1);
    this.canvasHeight = height / (window.devicePixelRatio || 1);
  }

  /**
   * Clear canvas
   */
  clear(color = 'transparent') {
    if (!this.ctx) return;

    if (color === 'transparent') {
      this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    } else {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }
  }

  /**
   * Draw gradient background
   */
  drawGradientBackground(colorStops) {
    if (!this.ctx) return;

    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    colorStops.forEach(({ offset, color }) => {
      gradient.addColorStop(offset, color);
    });

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  /**
   * Draw grid
   */
  drawGrid(options = {}) {
    const {
      color = 'rgba(255, 255, 255, 0.1)',
      lineWidth = 1,
      cellSize = 50,
      majorLineEvery = 5,
      majorColor = 'rgba(255, 255, 255, 0.2)',
      majorLineWidth = 2
    } = options;

    if (!this.ctx) return;

    // Vertical lines
    for (let x = 0; x <= this.canvasWidth; x += cellSize) {
      const isMajor = (x / cellSize) % majorLineEvery === 0;
      this.ctx.strokeStyle = isMajor ? majorColor : color;
      this.ctx.lineWidth = isMajor ? majorLineWidth : lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvasHeight);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= this.canvasHeight; y += cellSize) {
      const isMajor = (y / cellSize) % majorLineEvery === 0;
      this.ctx.strokeStyle = isMajor ? majorColor : color;
      this.ctx.lineWidth = isMajor ? majorLineWidth : lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvasWidth, y);
      this.ctx.stroke();
    }
  }

  /**
   * Draw text with shadow
   */
  drawText(text, x, y, options = {}) {
    const {
      font = '14px Inter, system-ui',
      color = '#FFFFFF',
      align = 'left',
      baseline = 'top',
      shadowColor = 'rgba(0, 0, 0, 0.8)',
      shadowBlur = 4
    } = options;

    if (!this.ctx) return;

    this.ctx.font = font;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;

    if (shadowBlur > 0) {
      this.ctx.shadowColor = shadowColor;
      this.ctx.shadowBlur = shadowBlur;
    }

    this.ctx.fillText(text, x, y);
    this.ctx.shadowBlur = 0;
  }

  /**
   * Draw line
   */
  drawLine(x1, y1, x2, y2, options = {}) {
    const {
      color = '#FFFFFF',
      lineWidth = 2,
      lineDash = [],
      shadowColor = null,
      shadowBlur = 0
    } = options;

    if (!this.ctx) return;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.setLineDash(lineDash);

    if (shadowColor && shadowBlur > 0) {
      this.ctx.shadowColor = shadowColor;
      this.ctx.shadowBlur = shadowBlur;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    this.ctx.setLineDash([]);
    this.ctx.shadowBlur = 0;
  }

  /**
   * Draw circle
   */
  drawCircle(x, y, radius, options = {}) {
    const {
      fillColor = null,
      strokeColor = '#FFFFFF',
      lineWidth = 2,
      shadowColor = null,
      shadowBlur = 0
    } = options;

    if (!this.ctx) return;

    if (shadowColor && shadowBlur > 0) {
      this.ctx.shadowColor = shadowColor;
      this.ctx.shadowBlur = shadowBlur;
    }

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);

    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }

    this.ctx.shadowBlur = 0;
  }

  /**
   * Draw rounded rectangle
   */
  drawRoundedRect(x, y, width, height, radius, options = {}) {
    const {
      fillColor = null,
      strokeColor = '#FFFFFF',
      lineWidth = 2
    } = options;

    if (!this.ctx) return;

    this.ctx.beginPath();
    this.ctx.roundRect(x, y, width, height, radius);

    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }

  /**
   * Map value from one range to another
   */
  map(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  }

  /**
   * Clamp value between min and max
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Linear interpolation
   */
  lerp(start, end, t) {
    return start + (end - start) * t;
  }
}
