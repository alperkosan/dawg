/**
 * useAudioPlugin - React Hook for Audio Plugin Integration
 *
 * Provides standardized access to audio analysis and metrics
 * for all plugin UIs.
 *
 * @version 1.0.0
 * @date 2025-10-09
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { BaseAudioPlugin } from '@/lib/audio/BaseAudioPlugin';
import { usePlaybackStore } from '@/store/usePlaybackStore';

/**
 * Main hook for audio plugin functionality
 *
 * @param {string} trackId - Track identifier
 * @param {string} effectId - Effect identifier
 * @param {Object} options - Configuration options
 * @returns {Object} Plugin interface
 *
 * @example
 * const {
 *   plugin,
 *   isPlaying,
 *   metrics,
 *   metricsDb,
 *   getTimeDomainData,
 *   getFrequencyData
 * } = useAudioPlugin(trackId, effectId, {
 *   fftSize: 2048,
 *   updateMetrics: true
 * });
 */
export function useAudioPlugin(trackId, effectId, options = {}) {
  const pluginRef = useRef(null);
  const [metrics, setMetrics] = useState({
    rms: 0,
    peak: 0,
    peakHold: 0,
    clipping: false
  });
  const [metricsDb, setMetricsDb] = useState({
    rmsDb: -Infinity,
    peakDb: -Infinity,
    peakHoldDb: -Infinity,
    clipping: false
  });

  // Get playback state
  const isPlaying = usePlaybackStore((state) => state.isPlaying);

  // Initialize plugin
  useEffect(() => {
    if (!trackId || !effectId) {
      console.warn('⚠️ useAudioPlugin: Missing trackId or effectId');
      return;
    }

    // Create plugin instance
    pluginRef.current = new BaseAudioPlugin(trackId, effectId, {
      fftSize: options.fftSize || 2048,
      smoothingTimeConstant: options.smoothingTimeConstant || 0.8,
      metricsUpdateInterval: options.metricsUpdateInterval || 33
    });

    console.log(`🎛️ useAudioPlugin: Plugin created for ${effectId}`);

    return () => {
      if (pluginRef.current) {
        pluginRef.current.destroy();
        pluginRef.current = null;
      }
    };
  }, [trackId, effectId, options.fftSize, options.smoothingTimeConstant, options.metricsUpdateInterval]);

  // Update metrics periodically (only when playing)
  useEffect(() => {
    if (!options.updateMetrics || !isPlaying || !pluginRef.current) {
      return;
    }

    let animationFrameId;

    const updateMetrics = () => {
      if (pluginRef.current && !pluginRef.current.isDestroyed) {
        const newMetrics = pluginRef.current.calculateMetrics({
          rmsSmoothing: options.rmsSmoothing || 0.3,
          peakSmoothing: options.peakSmoothing || 0.2
        });

        const newMetricsDb = pluginRef.current.getMetricsDb();

        setMetrics(newMetrics);
        setMetricsDb(newMetricsDb);
      }

      animationFrameId = requestAnimationFrame(updateMetrics);
    };

    animationFrameId = requestAnimationFrame(updateMetrics);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, options.updateMetrics, options.rmsSmoothing, options.peakSmoothing]);

  // Get time domain data
  const getTimeDomainData = useCallback(() => {
    return pluginRef.current?.getTimeDomainData() || null;
  }, []);

  // Get frequency data
  const getFrequencyData = useCallback(() => {
    return pluginRef.current?.getFrequencyData() || null;
  }, []);

  // Get analyser node (for custom visualizations)
  const getAnalyser = useCallback(() => {
    return pluginRef.current?.analyser || null;
  }, []);

  // Reconnect (useful for debugging or audio context changes)
  const reconnect = useCallback(() => {
    if (pluginRef.current) {
      pluginRef.current.reconnect();
    }
  }, []);

  return {
    plugin: pluginRef.current,
    isPlaying,
    metrics,
    metricsDb,
    getTimeDomainData,
    getFrequencyData,
    getAnalyser,
    reconnect
  };
}

/**
 * Hook for ghost value tracking (visual feedback)
 * Used for showing previous parameter values
 *
 * @param {*} value - Current value
 * @param {number} delay - Delay in ms before updating ghost value
 * @returns {*} Ghost value
 */
export function useGhostValue(value, delay = 400) {
  const [ghostValue, setGhostValue] = useState(value);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setGhostValue(value);
    }, delay);
    return () => clearTimeout(timeoutRef.current);
  }, [value, delay]);

  return ghostValue;
}

/**
 * Hook for canvas-based visualizations
 * Handles resize, DPI, and animation loop
 *
 * @param {Function} drawCallback - Draw function(ctx, width, height)
 * @param {Array} dependencies - Effect dependencies
 * @param {Object} options - Configuration
 * @returns {Object} Canvas refs
 */
export function useCanvasVisualization(drawCallback, dependencies = [], options = {}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    drawCallback(ctx, rect.width, rect.height);

    if (!options.noLoop) {
      animationRef.current = requestAnimationFrame(draw);
    }
  }, [drawCallback, options.noLoop]);

  // Setup canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const newWidth = Math.floor(rect.width * dpr);
      const newHeight = Math.floor(rect.height * dpr);

      // Only update if size changed
      if (canvas.width === newWidth && canvas.height === newHeight) {
        return;
      }

      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      console.log('📐 Canvas resized:', {
        width: rect.width,
        height: rect.height,
        dpr
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateSize);
    });

    resizeObserver.observe(container);

    // Start animation loop
    if (!options.noLoop) {
      animationRef.current = requestAnimationFrame(draw);
    }

    return () => {
      resizeObserver.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw, options.noLoop]);

  // Redraw on dependencies change
  useEffect(() => {
    if (options.noLoop && canvasRef.current) {
      draw();
    }
  }, [...dependencies, draw, options.noLoop]);

  return {
    containerRef,
    canvasRef
  };
}
