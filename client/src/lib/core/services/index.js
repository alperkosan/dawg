/**
 * Core Services - Barrel Export
 * 
 * These services are extracted from NativeAudioEngine to reduce class size
 * and improve testability. Each service handles a specific domain.
 * 
 * Service Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                  NativeAudioEngineFacade                     │
 * │                     (Thin Orchestrator)                      │
 * │  ┌──────────────┬──────────────┬──────────────┬───────────┐ │
 * │  │ Instrument   │    Mixer     │   Transport  │  Worklet  │ │
 * │  │   Service    │   Service    │   Service    │  Service  │ │
 * │  └──────────────┴──────────────┴──────────────┴───────────┘ │
 * │  ┌──────────────┬──────────────┬──────────────┬───────────┐ │
 * │  │   Effect     │ Performance  │   Playback   │ Scheduler │ │
 * │  │   Service    │   Service    │   Service    │  Service  │ │
 * │  └──────────────┴──────────────┴──────────────┴───────────┘ │
 * │  ┌──────────────┐                                           │
 * │  │    WASM      │                                           │
 * │  │   Service    │                                           │
 * │  └──────────────┘                                           │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * @module lib/core/services
 */

export { InstrumentService } from './InstrumentService.js';
export { MixerService } from './MixerService.js';
export { TransportService } from './TransportService.js';
export { WorkletService } from './WorkletService.js';
export { EffectService } from './EffectService.js';
export { PerformanceService } from './PerformanceService.js';
export { PlaybackService } from './PlaybackService.js';
export { SchedulerService, ScheduledEventType } from './SchedulerService.js';
export { WasmService } from './WasmService.js';
