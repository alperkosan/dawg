// lib/core/TimelineControllerSingleton.js
import { BaseSingleton } from './singletons/BaseSingleton.js';
import { AudioEngineGlobal } from './AudioEngineGlobal.js';
import { TimelineController } from './TimelineController.js';

/**
 * TIMELINE CONTROLLER SINGLETON
 *
 * Global singleton instance for unified timeline control.
 * Used across all panels (Channel Rack, Piano Roll, Arrangement).
 *
 * @extends BaseSingleton
 * @example
 * const timeline = await TimelineControllerSingleton.getInstance();
 * timeline.jumpToStep(16);
 */
class TimelineControllerSingleton extends BaseSingleton {
  /**
   * Create TimelineController instance
   * @override
   * @private
   */
  static async _createInstance() {
    console.log('🎯 Creating TimelineController singleton...');

    // Wait slightly if engine is not ready (retry logic could be here, but for now we trust Global check)
    let audioEngine = AudioEngineGlobal.get();

    // Quick retry just in case it's in the process of being set
    if (!audioEngine && typeof window !== 'undefined') {
      audioEngine = window.audioEngine;
    }

    if (!audioEngine) {
      throw new Error('AudioEngine not available for TimelineController');
    }

    // Get initial BPM from store
    const initialBPM = await this._getInitialBPM();

    const controller = new TimelineController(audioEngine, initialBPM);
    console.log('🎯 TimelineController singleton created with BPM:', initialBPM);

    return controller;
  }

  /**
   * Get initial BPM from PlaybackStore
   * @private
   */
  static async _getInitialBPM() {
    try {
      const { usePlaybackStore } = await import('@/store/usePlaybackStore');
      const bpm = usePlaybackStore.getState().bpm;
      return bpm || 140; // Default to 140 if not set
    } catch (error) {
      console.warn('Could not get initial BPM from store, using default:', error);
      return 140; // Default BPM for Timeline
    }
  }
}

// Legacy function exports for backward compatibility
export function initializeTimelineController(audioEngine, initialBPM = 140) {
  console.warn('⚠️ initializeTimelineController() is deprecated, use TimelineControllerSingleton.getInstance() instead');
  return TimelineControllerSingleton.getInstance();
}

export function getTimelineController() {
  const instance = TimelineControllerSingleton.getInstanceSync();
  if (!instance) {
    throw new Error('TimelineController not initialized. Call TimelineControllerSingleton.getInstance() first.');
  }
  return instance;
}

export function destroyTimelineController() {
  console.warn('⚠️ destroyTimelineController() is deprecated, use TimelineControllerSingleton.reset() instead');
  TimelineControllerSingleton.reset();
}

export function isTimelineControllerInitialized() {
  return TimelineControllerSingleton.isReady();
}

export default TimelineControllerSingleton;
