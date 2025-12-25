/**
 * CORE SYSTEMS - Barrel Export
 *
 * Central export for all core systems
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
export { NativeAudioEngine } from './NativeAudioEngine.js';
export { NativeTransportSystem } from './NativeTransportSystem.js';

// ✅ NEW: Audio Engine Facade (recommended for new code)
export { NativeAudioEngineFacade, createAudioEngine } from './NativeAudioEngineFacade.js';

// ✅ NEW: Extracted Services
export {
  InstrumentService,
  MixerService,
  TransportService,
  WorkletService,
  EffectService,
  PerformanceService,
  PlaybackService,
  SchedulerService
} from './services/index.js';

// ✅ NEW: Command Pattern
export {
  Command,
  CommandManager,
  BatchCommand,
  globalCommandManager
} from './commands/index.js';

// ✅ NEW: Object Pool
export { AudioObjectPool, audioObjectPool } from './utils/AudioObjectPool.js';

// Nodes
export { NativeSamplerNode } from './nodes/NativeSamplerNode.js';
