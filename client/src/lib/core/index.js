/**
 * CORE SYSTEMS - Barrel Export
 *
 * Central export for all core systems
 * 
 * MIGRATION NOTICE:
 * - NativeAudioEngine is DEPRECATED - use NativeAudioEngineFacade instead
 * - See /docs/AUDIO_ENGINE_MIGRATION.md for migration guide
 */

// Singletons Base
export { BaseSingleton } from './singletons/BaseSingleton.js';

// Core Controllers & Managers
export { PlaybackController } from './PlaybackController.js';
export { PlaybackManager } from './PlaybackManager.js';
export { TimelineController } from './TimelineController.js';
export { TransportManager } from './TransportManager.js';

// Singleton Wrappers
export { default as PlaybackControllerSingleton } from './PlaybackControllerSingleton.js';
export { default as TimelineControllerSingleton } from './TimelineControllerSingleton.js';
export { default as TransportManagerSingleton } from './TransportManagerSingleton.js';

// Services
export {
  UIUpdateManager,
  uiUpdateManager,
  UPDATE_PRIORITIES,
  UPDATE_FREQUENCIES
} from './UIUpdateManager.js';

export { EventBus } from './EventBus.js';
export { MeteringService } from './MeteringService.js';

// Other Core Systems
export { PlaybackEngine } from './PlaybackEngine.js';
export { PlayheadRenderer } from './PlayheadRenderer.js';
export { PositionTracker } from './PositionTracker.js';
export { NativeTransportSystem } from './NativeTransportSystem.js';

// =================== AUDIO ENGINE ===================

// ✅ RECOMMENDED: Audio Engine Facade (use this for all new code)
export { NativeAudioEngineFacade, createAudioEngine } from './NativeAudioEngineFacade.js';

// ⚠️ DEPRECATED: Old NativeAudioEngine - use NativeAudioEngineFacade instead
// Kept for backward compatibility only
export { NativeAudioEngine } from './NativeAudioEngine.js';

// WASM Audio Engine
export { wasmAudioEngine, WasmAudioEngine } from './WasmAudioEngine.js';

// =================== EXTRACTED SERVICES ===================

export {
  InstrumentService,
  MixerService,
  TransportService,
  WorkletService,
  EffectService,
  PerformanceService,
  PlaybackService,
  SchedulerService,
  WasmService
} from './services/index.js';

// =================== COMMAND PATTERN ===================

export {
  Command,
  CommandManager,
  BatchCommand,
  globalCommandManager
} from './commands/index.js';

// =================== UTILITIES ===================

export { AudioObjectPool, audioObjectPool } from './utils/AudioObjectPool.js';

// =================== NODES ===================

export { NativeSamplerNode } from './nodes/NativeSamplerNode.js';
