/**
 * RENDERING SYSTEMS - Barrel Export
 *
 * Production-grade waveform rendering for arrangement workspace
 *
 * Architecture:
 * - Core: Base rendering with 3-tier LOD system
 * - Cache: Smart caching with width tolerance & debouncing
 * - Utils: Audio processing utilities
 *
 * Phase Progress:
 * - Phase 0: Foundation (PerformanceMonitor, RenderQueue, WaveformRenderer) ✅
 * - Phase 1: Core Rendering (AudioUtils, LOD implementations) ✅
 * - Phase 2: Smart Caching (SmartWaveformCache) ✅
 * - Phase 3: Production Features (in progress)
 * - Phase 4: Integration & Testing (pending)
 */

// Core Rendering
export { WaveformRenderer } from './core/WaveformRenderer.js';
export { PerformanceMonitor } from './core/PerformanceMonitor.js';
export { RenderQueue } from './core/RenderQueue.js';
export { ProgressiveAudioLoader, getProgressiveAudioLoader } from './core/ProgressiveAudioLoader.js';

// Smart Caching
export { SmartWaveformCache, getSmartWaveformCache } from './cache/SmartWaveformCache.js';

// Audio Utilities
export * from './utils/AudioUtils.js';
