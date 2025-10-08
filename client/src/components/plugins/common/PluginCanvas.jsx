import React, { useRef, useEffect } from 'react';
import { PluginVisualizerAPI } from '@/lib/visualization/PluginVisualizerAPI';

/**
 * PLUGIN CANVAS WRAPPER
 * - Registers visualizer with VisualizationEngine
 * - Handles lifecycle (mount/unmount)
 * - Deep comparison for param updates
 */
export const PluginCanvas = React.memo(({ pluginId, visualizerClass, params, priority = 'normal' }) => {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);

  // Register visualizer on mount
  useEffect(() => {
    if (!canvasRef.current) return;

    console.log('[PluginCanvas] Registering visualizer...', pluginId);

    const visualizer = PluginVisualizerAPI.register(pluginId, {
      canvas: canvasRef.current,
      visualizer: visualizerClass,
      priority,
      params
    });

    visualizerRef.current = visualizer;

    console.log('[PluginCanvas] Registered!', visualizer);

    // Cleanup on unmount
    return () => {
      console.log('[PluginCanvas] Cleanup - Unregistering...', pluginId);
      PluginVisualizerAPI.unregister(pluginId);
      visualizerRef.current = null;
    };
  }, [pluginId, visualizerClass, priority]);

  // Update params when values change
  const prevParamsRef = useRef(params);

  useEffect(() => {
    if (!visualizerRef.current || !registeredRef.current) return;

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
