/**
 * Unit Tests for BaseAudioPlugin
 *
 * Tests the core audio plugin infrastructure
 *
 * @version 1.0.0
 * @date 2025-10-09
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseAudioPlugin } from '../BaseAudioPlugin';

// Mock AudioContext and related APIs
class MockAnalyserNode {
  constructor() {
    this.fftSize = 2048;
    this.frequencyBinCount = 1024;
    this.connect = vi.fn();
    this.disconnect = vi.fn();
    this.getFloatTimeDomainData = vi.fn((array) => {
      // Fill with mock data
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.sin(i / 10);
      }
    });
    this.getFloatFrequencyData = vi.fn((array) => {
      // Fill with mock data
      for (let i = 0; i < array.length; i++) {
        array[i] = -60 + Math.random() * 60;
      }
    });
  }
}

class MockAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.currentTime = 0;
    this.createAnalyser = vi.fn(() => new MockAnalyserNode());
  }
}

class MockWorkletNode {
  constructor() {
    this.context = new MockAudioContext();
    this.connect = vi.fn();
    this.disconnect = vi.fn();
  }
}

// Mock AudioContextService
vi.mock('@/lib/services/AudioContextService', () => ({
  AudioContextService: {
    getEffectAudioNode: vi.fn((trackId, effectId) => ({
      workletNode: new MockWorkletNode(),
      context: new MockAudioContext()
    })),
    getAudioContext: vi.fn(() => new MockAudioContext())
  }
}));

describe('BaseAudioPlugin', () => {
  let plugin;
  const trackId = 'track-1';
  const effectId = 'effect-1';

  beforeEach(() => {
    plugin = new BaseAudioPlugin(trackId, effectId);
  });

  afterEach(() => {
    plugin?.destroy();
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      expect(plugin).toBeInstanceOf(BaseAudioPlugin);
      expect(plugin.trackId).toBe(trackId);
      expect(plugin.effectId).toBe(effectId);
      expect(plugin.options.fftSize).toBe(2048);
      expect(plugin.options.updateMetrics).toBe(true);
    });

    it('should accept custom options', () => {
      const customPlugin = new BaseAudioPlugin(trackId, effectId, {
        fftSize: 4096,
        updateMetrics: false,
        rmsSmoothing: 0.5,
        peakSmoothing: 0.9
      });

      expect(customPlugin.options.fftSize).toBe(4096);
      expect(customPlugin.options.updateMetrics).toBe(false);
      expect(customPlugin.options.rmsSmoothing).toBe(0.5);
      expect(customPlugin.options.peakSmoothing).toBe(0.9);

      customPlugin.destroy();
    });

    it('should initialize with null audio node and analyser', () => {
      expect(plugin.audioNode).toBeNull();
      expect(plugin.analyser).toBeNull();
      expect(plugin.dataArray).toBeNull();
    });

    it('should initialize metrics to zero', () => {
      expect(plugin.metrics.rms).toBe(0);
      expect(plugin.metrics.peak).toBe(0);
      expect(plugin.metrics.peakHold).toBe(0);
      expect(plugin.metrics.clipping).toBe(false);
    });
  });

  describe('Audio Connection', () => {
    it('should connect to audio node', () => {
      const connection = plugin.connectAudioNode();

      expect(connection).toBeDefined();
      expect(connection.workletNode).toBeDefined();
      expect(connection.context).toBeDefined();
      expect(plugin.audioNode).toBe(connection);
    });

    it('should setup analyser when connected', () => {
      plugin.connectAudioNode();
      plugin.setupAnalyser();

      expect(plugin.analyser).toBeDefined();
      expect(plugin.analyser).toBeInstanceOf(MockAnalyserNode);
      expect(plugin.dataArray).toBeInstanceOf(Float32Array);
      expect(plugin.dataArray.length).toBe(plugin.options.fftSize);
    });

    it('should reconnect successfully', () => {
      plugin.connectAudioNode();
      plugin.setupAnalyser();

      const oldAnalyser = plugin.analyser;

      plugin.reconnect();

      expect(plugin.analyser).not.toBe(oldAnalyser);
      expect(plugin.analyser).toBeDefined();
    });
  });

  describe('Audio Data Retrieval', () => {
    beforeEach(() => {
      plugin.connectAudioNode();
      plugin.setupAnalyser();
    });

    it('should get time domain data', () => {
      const data = plugin.getTimeDomainData();

      expect(data).toBeInstanceOf(Float32Array);
      expect(data.length).toBe(plugin.options.fftSize);
      expect(plugin.analyser.getFloatTimeDomainData).toHaveBeenCalled();
    });

    it('should get frequency data', () => {
      const data = plugin.getFrequencyData();

      expect(data).toBeInstanceOf(Float32Array);
      expect(data.length).toBe(plugin.options.fftSize);
      expect(plugin.analyser.getFloatFrequencyData).toHaveBeenCalled();
    });

    it('should return null if analyser not setup', () => {
      const newPlugin = new BaseAudioPlugin('track-2', 'effect-2');

      expect(newPlugin.getTimeDomainData()).toBeNull();
      expect(newPlugin.getFrequencyData()).toBeNull();

      newPlugin.destroy();
    });

    it('should get analyser node', () => {
      const analyser = plugin.getAnalyser();

      expect(analyser).toBe(plugin.analyser);
      expect(analyser).toBeInstanceOf(MockAnalyserNode);
    });
  });

  describe('Metrics Calculation', () => {
    beforeEach(() => {
      plugin.connectAudioNode();
      plugin.setupAnalyser();
    });

    it('should calculate all metrics', () => {
      const metrics = plugin.calculateMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.rms).toBe('number');
      expect(typeof metrics.peak).toBe('number');
      expect(typeof metrics.peakHold).toBe('number');
      expect(typeof metrics.clipping).toBe('boolean');
    });

    it('should calculate only RMS when specified', () => {
      const metrics = plugin.calculateMetrics({
        calculateRms: true,
        calculatePeak: false,
        calculatePeakHold: false,
        detectClipping: false
      });

      expect(metrics.rms).toBeGreaterThan(0);
      // Peak/peakHold should be previous values (not recalculated)
    });

    it('should detect clipping', () => {
      // Mock data with clipping
      plugin.analyser.getFloatTimeDomainData = vi.fn((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = i === 0 ? 1.0 : 0; // First sample at max
        }
      });

      const metrics = plugin.calculateMetrics();

      expect(metrics.clipping).toBe(true);
      expect(metrics.peak).toBeGreaterThanOrEqual(0.99);
    });

    it('should smooth RMS values', () => {
      const smoothing = plugin.options.rmsSmoothing;

      // First calculation
      const metrics1 = plugin.calculateMetrics();
      const rms1 = metrics1.rms;

      // Second calculation (should be smoothed)
      const metrics2 = plugin.calculateMetrics();
      const rms2 = metrics2.rms;

      // With high smoothing, values should be very close
      expect(Math.abs(rms2 - rms1)).toBeLessThan(0.5);
    });

    it('should hold peak values', () => {
      // Set high peak
      plugin.analyser.getFloatTimeDomainData = vi.fn((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = 0.8;
        }
      });

      const metrics1 = plugin.calculateMetrics();
      const peakHold1 = metrics1.peakHold;

      // Lower peak
      plugin.analyser.getFloatTimeDomainData = vi.fn((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = 0.3;
        }
      });

      const metrics2 = plugin.calculateMetrics();
      const peakHold2 = metrics2.peakHold;

      // Peak hold should still be high
      expect(peakHold2).toBeGreaterThanOrEqual(peakHold1 * 0.9);
    });

    it('should get metrics', () => {
      plugin.calculateMetrics();
      const metrics = plugin.getMetrics();

      expect(metrics).toBe(plugin.metrics);
    });

    it('should get metrics in dB', () => {
      plugin.calculateMetrics();
      const metricsDb = plugin.getMetricsDb();

      expect(metricsDb.rmsDb).toBeLessThanOrEqual(0);
      expect(metricsDb.peakDb).toBeLessThanOrEqual(0);
      expect(metricsDb.peakHoldDb).toBeLessThanOrEqual(0);
      expect(typeof metricsDb.clipping).toBe('boolean');
    });
  });

  describe('Amplitude Conversion', () => {
    it('should convert amplitude to dB correctly', () => {
      expect(plugin.amplitudeToDb(1.0)).toBeCloseTo(0, 1);
      expect(plugin.amplitudeToDb(0.5)).toBeCloseTo(-6, 1);
      expect(plugin.amplitudeToDb(0.1)).toBeCloseTo(-20, 1);
      expect(plugin.amplitudeToDb(0.0)).toBe(-Infinity);
    });

    it('should handle negative values', () => {
      expect(plugin.amplitudeToDb(-0.5)).toBeCloseTo(-6, 1);
    });

    it('should handle edge cases', () => {
      expect(plugin.amplitudeToDb(0)).toBe(-Infinity);
      expect(plugin.amplitudeToDb(Infinity)).toBe(Infinity);
    });
  });

  describe('Cleanup', () => {
    it('should destroy cleanly', () => {
      plugin.connectAudioNode();
      plugin.setupAnalyser();

      plugin.destroy();

      expect(plugin.audioNode).toBeNull();
      expect(plugin.analyser).toBeNull();
      expect(plugin.dataArray).toBeNull();
    });

    it('should cancel animation frames on destroy', () => {
      plugin.connectAudioNode();
      plugin.setupAnalyser();

      // Start metrics update loop
      plugin.calculateMetrics();

      const spy = vi.spyOn(window, 'cancelAnimationFrame');

      plugin.destroy();

      // Animation frame should be cancelled (if it was running)
      if (plugin.options.updateMetrics) {
        expect(spy).toHaveBeenCalled();
      }
    });

    it('should handle multiple destroy calls', () => {
      plugin.connectAudioNode();
      plugin.setupAnalyser();

      plugin.destroy();
      plugin.destroy(); // Should not throw

      expect(plugin.audioNode).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should return null when getting data without setup', () => {
      const newPlugin = new BaseAudioPlugin('track-2', 'effect-2');

      expect(newPlugin.getTimeDomainData()).toBeNull();
      expect(newPlugin.getFrequencyData()).toBeNull();
      expect(newPlugin.getAnalyser()).toBeNull();

      newPlugin.destroy();
    });

    it('should handle missing audio node gracefully', () => {
      // Don't connect
      plugin.setupAnalyser();

      // Should handle gracefully (may log warning)
      expect(() => plugin.getTimeDomainData()).not.toThrow();
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      plugin.connectAudioNode();
      plugin.setupAnalyser();
    });

    it('should calculate metrics quickly', () => {
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        plugin.calculateMetrics();
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      // Should be very fast (< 0.5ms per call)
      expect(avgTime).toBeLessThan(0.5);
    });

    it('should get audio data quickly', () => {
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        plugin.getTimeDomainData();
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      // Should be very fast (< 0.1ms per call)
      expect(avgTime).toBeLessThan(0.1);
    });

    it('should not leak memory', () => {
      const iterations = 10000;
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      for (let i = 0; i < iterations; i++) {
        plugin.calculateMetrics();
        plugin.getTimeDomainData();
        plugin.getFrequencyData();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (< 1MB)
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(1024 * 1024);
      }
    });
  });
});
