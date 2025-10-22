/**
 * Audio Backends Module
 *
 * Provides abstraction layer for audio processing with multiple backend implementations:
 * - JavaScript: Baseline (1x performance)
 * - WebAssembly: 4-5x performance
 * - Native Extension: 10-20x performance
 *
 * Usage:
 *
 * ```javascript
 * import { AudioProcessorFactory } from './audio-backends';
 *
 * // Auto-select best backend
 * const backend = await AudioProcessorFactory.createBackend(null, 48000);
 *
 * // Process audio
 * backend.processBuffer(inputL, inputR, outputL, outputR, params);
 *
 * // Get capabilities
 * const caps = backend.getCapabilities();
 * console.log(`Using ${caps.type} backend (${caps.cpuEfficiency}x efficiency)`);
 *
 * // Cleanup
 * backend.cleanup();
 * ```
 */

export { AudioProcessorBackend, BackendType, ProcessingMode } from './AudioProcessorBackend.js';
export { JavaScriptBackend } from './JavaScriptBackend.js';
export { WasmBackend } from './WasmBackend.js';
export { AudioProcessorFactory } from './AudioProcessorFactory.js';

// Re-export factory as default
export { AudioProcessorFactory as default } from './AudioProcessorFactory.js';
