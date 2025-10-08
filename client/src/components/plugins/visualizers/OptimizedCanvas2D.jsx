import React, { useEffect, useRef, useCallback } from 'react';

/**
 * OPTIMIZED CANVAS 2D WRAPPER
 *
 * Performance optimizations:
 * - Shared RAF loop with throttling
 * - OffscreenCanvas support
 * - Lazy rendering (only when visible)
 * - Resolution scaling
 * - Batch updates
 */

// Global RAF coordinator
class RAFCoordinator {
  constructor() {
    this.callbacks = new Map();
    this.rafId = null;
    this.lastTime = 0;
    this.targetFPS = 30; // Lower FPS for better performance
  }

  register(id, callback, fps = 30) {
    this.callbacks.set(id, { callback, fps, lastRun: 0 });
    if (!this.rafId) {
      this.start();
    }
  }

  unregister(id) {
    this.callbacks.delete(id);
    if (this.callbacks.size === 0) {
      this.stop();
    }
  }

  start() {
    const loop = (time) => {
      this.callbacks.forEach((entry, id) => {
        const interval = 1000 / entry.fps;
        if (time - entry.lastRun >= interval) {
          entry.callback(time);
          entry.lastRun = time;
        }
      });

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

const rafCoordinator = new RAFCoordinator();

/**
 * Optimized Canvas 2D Component
 */
export const OptimizedCanvas2D = ({
  draw,
  fps = 30,
  scale = 0.75, // Render at 75% resolution for performance
  className = '',
  onContextReady = null
}) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const observerRef = useRef(null);
  const isVisibleRef = useRef(true);
  const componentIdRef = useRef(`canvas-${Math.random().toString(36).substr(2, 9)}`);

  // Setup canvas and context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', {
      alpha: true,
      desynchronized: true, // For better performance
      willReadFrequently: false
    });

    contextRef.current = ctx;

    // Notify parent
    if (onContextReady) {
      onContextReady(ctx);
    }
  }, [onContextReady]);

  // Intersection Observer for visibility
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisibleRef.current = entry.isIntersecting;
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(canvas);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Register with RAF coordinator
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;

    if (!canvas || !ctx || !draw) return;

    const render = (time) => {
      // Skip if not visible
      if (!isVisibleRef.current) return;

      // Get display size
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;

      // Calculate render size (scaled for performance)
      const renderWidth = Math.floor(displayWidth * scale);
      const renderHeight = Math.floor(displayHeight * scale);

      // Resize if needed
      if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
        canvas.width = renderWidth;
        canvas.height = renderHeight;
      }

      // Clear
      ctx.clearRect(0, 0, renderWidth, renderHeight);

      // Apply scale for coordinate system
      ctx.save();
      ctx.scale(scale, scale);

      // Call user draw function
      draw(ctx, displayWidth, displayHeight, time);

      ctx.restore();
    };

    rafCoordinator.register(componentIdRef.current, render, fps);

    return () => {
      rafCoordinator.unregister(componentIdRef.current);
    };
  }, [draw, fps, scale]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        imageRendering: 'auto' // Smooth scaling
      }}
    />
  );
};

/**
 * Static Visualization (no animation needed)
 */
export const StaticCanvas2D = ({ draw, className = '', scale = 1.0 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !draw) return;

    const ctx = canvas.getContext('2d', { alpha: true });

    const render = () => {
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      const renderWidth = Math.floor(displayWidth * scale);
      const renderHeight = Math.floor(displayHeight * scale);

      canvas.width = renderWidth;
      canvas.height = renderHeight;

      ctx.clearRect(0, 0, renderWidth, renderHeight);
      ctx.save();
      ctx.scale(scale, scale);
      draw(ctx, displayWidth, displayHeight);
      ctx.restore();
    };

    render();

    // Re-render on resize
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [draw, scale]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  );
};

/**
 * Shared Analyser Node Hook
 * Creates and manages a single analyser for multiple visualizers
 */
export const useSharedAnalyser = (audioNode, options = {}) => {
  const analyserRef = useRef(null);

  useEffect(() => {
    if (!audioNode) return;

    const audioContext = audioNode.context;
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = options.fftSize || 512;
    analyser.smoothingTimeConstant = options.smoothing || 0.8;

    try {
      audioNode.connect(analyser);
      analyserRef.current = analyser;
    } catch (error) {
      console.warn('Failed to connect analyser:', error);
    }

    return () => {
      if (analyser) {
        try {
          analyser.disconnect();
        } catch (e) {}
      }
    };
  }, [audioNode, options.fftSize, options.smoothing]);

  return analyserRef.current;
};
