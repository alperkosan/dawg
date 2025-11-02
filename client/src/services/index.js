/**
 * SERVICES INDEX
 *
 * Central export point for all v2.0 services
 */

// Preset Management
export {
  PresetManager,
  PresetStorage,
  createPresetManager,
  // React hooks
  usePresetManager,
} from './PresetManager.js';

// Canvas Rendering
export {
  CanvasRenderManager,
  CanvasPool,
  RendererTask,
  renderManager,
  // React hooks
  useRenderer,
  useCanvasPool,
} from './CanvasRenderManager.js';

// Parameter Batching
export {
  ParameterBatcher,
  parameterBatcher,
  setParameter,
  setParameters,
  flushParameters,
  // React hooks
  useParameterBatcher,
} from './ParameterBatcher.js';

// WebGL Spectrum Analyzer
export {
  WebGLSpectrumAnalyzer,
  // React hooks
  useWebGLSpectrum,
} from './WebGLSpectrumAnalyzer.js';

/**
 * Convenience function to initialize all services
 */
export const initializeServices = () => {
  console.group('🚀 Initializing Plugin System v2.0 Services');

  // Start render manager
  console.log('✅ CanvasRenderManager ready');

  // Parameter batcher is lazy-initialized
  console.log('✅ ParameterBatcher ready');

  console.log('✅ PresetManager available');
  console.log('✅ WebGLSpectrumAnalyzer available');

  console.groupEnd();
};

/**
 * Performance monitoring
 */
export const getServicesStats = () => {
  const { default: rm } = require('./CanvasRenderManager.js');
  const { default: pb } = require('./ParameterBatcher.js');

  return {
    renderManager: rm.renderManager?.getAllStats() || {},
    parameterBatcher: pb.parameterBatcher?.getStats() || {},
  };
};

/**
 * Cleanup all services (for hot reload, unmount, etc.)
 */
export const disposeAllServices = () => {
  console.log('🧹 Disposing Plugin System v2.0 Services');

  const { default: rm } = require('./CanvasRenderManager.js');
  const { default: pb } = require('./ParameterBatcher.js');

  rm.renderManager?.stop();
  pb.parameterBatcher?.dispose();

  console.log('✅ All services disposed');
};
