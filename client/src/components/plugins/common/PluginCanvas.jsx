import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { PluginVisualizerAPI } from '@/lib/visualization/PluginVisualizerAPI';

/**
 * PLUGIN CANVAS WRAPPER
 * - Registers visualizer with VisualizationEngine
 * - Handles lifecycle (mount/unmount)
 * - Deep comparison for param updates
 * - Tracks canvas ref changes (StrictMode compatible)
 * - Connects to real audio nodes for live visualization
 */
export const PluginCanvas = React.memo(({ pluginId, visualizerClass, params, priority = 'normal', audioNode = null }) => {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);

  // Track canvas reference changes with useLayoutEffect (synchronous, before paint)
  useLayoutEffect(() => {
    if (!canvasRef.current) return;

    // If visualizer already exists but canvas changed, update it
    if (visualizerRef.current && visualizerRef.current.canvas !== canvasRef.current) {
      console.log('[PluginCanvas] Canvas ref changed, updating visualizer...', pluginId);
      visualizerRef.current.updateCanvas(canvasRef.current);
    }
  });

  // Register visualizer on mount
  useEffect(() => {
    if (!canvasRef.current) return;

    console.log('[PluginCanvas] Registering visualizer...', pluginId);

    const visualizer = PluginVisualizerAPI.register(pluginId, {
      canvas: canvasRef.current,
      visualizer: visualizerClass,
      priority,
      params,
      audioNode // ← Pass audioNode for real-time audio connection
    });

    visualizerRef.current = visualizer;

    console.log('[PluginCanvas] Registered!', visualizer);

    // Cleanup on unmount
    return () => {
      console.log('[PluginCanvas] Cleanup - Unregistering...', pluginId);
      PluginVisualizerAPI.unregister(pluginId);
      visualizerRef.current = null;
    };
  }, [pluginId, visualizerClass, priority, audioNode]);

  // Update params when values change
  const prevParamsRef = useRef(params);

  useEffect(() => {
    if (!visualizerRef.current) return;

    // Deep compare: only update if values actually changed
    const paramsChanged = Object.keys(params).some(
      key => params[key] !== prevParamsRef.current[key]
    );

    if (paramsChanged) {
      PluginVisualizerAPI.updateParams(pluginId, params);
      prevParamsRef.current = params;
    }
  }, [pluginId, params]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
});

PluginCanvas.displayName = 'PluginCanvas';
