// lib/core/PlaybackControllerSingleton.js
import { BaseSingleton } from './singletons/BaseSingleton.js';
import { AudioEngineGlobal } from './AudioEngineGlobal.js';
import { PlaybackController } from './PlaybackController.js';

/**
 * PLAYBACK CONTROLLER SINGLETON
 *
 * Unified singleton pattern for PlaybackController using BaseSingleton.
 * Prevents race conditions and multiple instance issues.
 *
 * @extends BaseSingleton
 * @example
 * const controller = await PlaybackControllerSingleton.getInstance();
 * controller.play();
 */
class PlaybackControllerSingleton extends BaseSingleton {
  /**
   * Create PlaybackController instance
   * @override
   * @private
   */
  static async _createInstance() {
    console.log('🎵 Creating PlaybackController singleton...');

    let audioEngine = AudioEngineGlobal.get();

    if (!audioEngine && typeof window !== 'undefined') {
      audioEngine = window.audioEngine;
    }

    if (!audioEngine) {
      throw new Error('AudioEngine not available for PlaybackController');
    }

    // Get initial BPM from store (will be 90 or user's saved value)
    const initialBPM = await this._getInitialBPM();

    const controller = new PlaybackController(audioEngine, initialBPM);
    console.log('🎵 PlaybackController singleton created with BPM:', initialBPM);

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
      console.log('🎵 Retrieved initial BPM from store:', bpm);
      return bpm || 90; // Default to 90 if not set
    } catch (error) {
      console.warn('Could not get initial BPM from store, using default:', error);
      return 90; // Default BPM
    }
  }

  /**
   * @deprecated Use onLifecycle() instead
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  static onInitialization(callback) {
    console.warn('PlaybackControllerSingleton.onInitialization() is deprecated, use onLifecycle() instead');
    return this.onLifecycle(callback);
  }
}

export default PlaybackControllerSingleton;
