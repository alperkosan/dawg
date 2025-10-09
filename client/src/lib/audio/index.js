/**
 * AUDIO SYSTEMS - Barrel Export
 *
 * Central export for all audio processing systems
 */

// Audio Processing
export { AudioRenderer } from './AudioRenderer.js';
export { RenderEngine } from './RenderEngine.js';
export { AudioProcessor } from './AudioProcessor.js';
export { AudioExportManager } from './AudioExportManager.js';
export { FileManager } from './FileManager.js';

// Worklet Management
export { ImprovedWorkletManager } from './ImprovedWorkletManager.js';

// Effects
export { EffectRegistry } from './EffectRegistry.js';
export * from './effects';

// Asset Management
export { audioAssetManager } from './AudioAssetManager.js';

// Configuration
export * from './audioRenderConfig.js';

// Utilities
export * from './EQCalculations.js';

// Plugin System (v2.0 - Standardized Architecture)
export { BaseAudioPlugin } from './BaseAudioPlugin.js';
export { PresetManager, createPresetManager } from './PresetManager.js';
