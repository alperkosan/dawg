/**
 * TUBE GLOW VISUALIZER
 *
 * Animated tube saturation visualizer for Saturator plugin.
 * Shows glowing vacuum tube with intensity-based effects.
 *
 * Features:
 * - Animated filament flicker
 * - Intensity-based glow
 * - Multiple glow layers
 * - Smooth transitions
 */

import { AnimatedPluginVisualizer } from '../AnimatedPluginVisualizer';

export class TubeGlowVisualizer extends AnimatedPluginVisualizer {
  constructor(config) {
    super({
      ...config,
      targetFPS: 60,
      priority: 'normal'
    });

    // Tube dimensions (relative to canvas size)
    this.tubeWidthRatio = 0.6;
    this.tubeHeightRatio = 0.8;
    this.filamentCount = 3;
    this.glowLayers = 5;

    // Audio analysis
    this.analyser = null; // Will be set by PluginVisualizerAPI
    this.audioBuffer = null;
  }

  /**
   * Get real-time audio level from analyser
   */
  getAudioLevel() {
    if (!this.analyser) return -60;

    if (!this.audioBuffer) {
      this.audioBuffer = new Float32Array(this.analyser.fftSize);
    }

    this.analyser.getFloatTimeDomainData(this.audioBuffer);

    // Calculate RMS (Root Mean Square) for audio level
    let sum = 0;
    for (let i = 0; i < this.audioBuffer.length; i++) {
      sum += this.audioBuffer[i] * this.audioBuffer[i];
    }
    const rms = Math.sqrt(sum / this.audioBuffer.length);

    // Convert to dB scale (-60 to 0)
    const db = 20 * Math.log10(Math.max(rms, 0.00001));
    return Math.max(-60, Math.min(0, db));
  }

  /**
   * Main animated render function
   */
  onRenderAnimated(ctx, timestamp, deltaTime, params) {
    const { drive = 50, mix = 1, tone = 0.5 } = params;

    // Clear canvas
    this.clear('rgba(10, 14, 26, 0.95)');

    // Validate canvas dimensions
    if (!isFinite(this.canvasWidth) || !isFinite(this.canvasHeight) ||
        this.canvasWidth <= 0 || this.canvasHeight <= 0) {
      return;
    }

    // 🎵 Get real-time audio level from analyser
    const realInputLevel = this.getAudioLevel();

    // Calculate intensity from audio input
    const distortion = Math.max(0, Math.min(1.5, drive / 100));
    const normalizedInput = Math.max(0, Math.min(1, (realInputLevel + 60) / 60));

    // Combine input level with drive for visual intensity
    // Use drive as minimum base + input level for dynamics
    const baseIntensity = Math.max(distortion * 0.3, normalizedInput);
    const intensity = Math.max(0, Math.min(1, baseIntensity * distortion * mix));

    // Canvas center
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;

    // Tube dimensions
    const tubeWidth = this.canvasWidth * this.tubeWidthRatio;
    const tubeHeight = this.canvasHeight * this.tubeHeightRatio;
    const tubeX = centerX - tubeWidth / 2;
    const tubeY = centerY - tubeHeight / 2;

    // Validate tube dimensions
    if (!isFinite(tubeWidth) || !isFinite(tubeHeight) || tubeWidth <= 0 || tubeHeight <= 0) {
      return;
    }

    // Draw tube outline
    this.drawRoundedRect(tubeX, tubeY, tubeWidth, tubeHeight, 20, {
      strokeColor: 'rgba(255, 140, 0, 0.8)',
      lineWidth: 3
    });

    // Draw multiple glow layers
    const glowIntensity = Math.max(0, Math.min(1, 0.3 + intensity * 0.7));
    const glowRadius = tubeHeight * 0.3 * glowIntensity;

    // Validate glow radius before creating gradients
    if (isFinite(glowRadius) && glowRadius > 0) {
      for (let i = 0; i < this.glowLayers; i++) {
        const radius = glowRadius * (1 + i * 0.3);
        const alpha = Math.max(0, Math.min(1, (0.4 - i * 0.06) * intensity));
        const hue = Math.max(0, Math.min(360, 20 + intensity * 30));

        // Additional safety check for radius
        if (isFinite(radius) && radius > 0) {
          const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, radius
          );

          gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, ${alpha})`);
          gradient.addColorStop(1, `hsla(${hue}, 60%, 40%, 0)`);

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        }
      }
    }

    // Draw animated filaments
    for (let i = 0; i < this.filamentCount; i++) {
      const x = centerX + (i - 1) * (tubeWidth * 0.15);
      const flickerOffset = this.getSineWave(0.05, i * Math.PI / 3) * 2;
      const filamentIntensity = Math.max(0, Math.min(1, 0.8 + intensity * 0.2));
      const hue = Math.max(0, Math.min(360, 40 + intensity * 20));

      ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${filamentIntensity})`;
      ctx.lineWidth = Math.max(1, 2 + intensity * 3);
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10 + intensity * 20;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(x, centerY - tubeHeight * 0.3);
      ctx.lineTo(x + flickerOffset, centerY + tubeHeight * 0.3);
      ctx.stroke();

      ctx.shadowBlur = 0;
    }

    // Draw tone indicator (subtle bottom bar)
    const toneBarY = this.canvasHeight - 20;
    const toneBarWidth = this.canvasWidth * 0.8;
    const toneBarX = (this.canvasWidth - toneBarWidth) / 2;

    ctx.fillStyle = 'rgba(100, 200, 255, 0.2)';
    ctx.fillRect(toneBarX, toneBarY, toneBarWidth, 4);

    ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
    ctx.fillRect(toneBarX, toneBarY, toneBarWidth * tone, 4);
  }
}
