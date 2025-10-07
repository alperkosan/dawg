// lib/core/PlaybackControllerSingleton.js
import { AudioContextService } from '../services/AudioContextService.js';
import { PlaybackController } from './PlaybackController.js';

/**
 * ✅ UNIFIED SINGLETON PATTERN
 *
 * Tek kaynak doğruluk için PlaybackController singleton'ı
 * Race condition ve multiple instance sorunlarını önler
 */

class PlaybackControllerSingleton {
  static instance = null;
  static initPromise = null;
  static subscribers = new Set();

  /**
   * Singleton instance'ı al veya oluştur
   */
  static async getInstance() {
    // Eğer zaten yaratılmış bir instance varsa onu döndür
    if (this.instance) {
      return this.instance;
    }

    // Eğer initialization process devam ediyorsa onun bitmesini bekle
    if (this.initPromise) {
      return await this.initPromise;
    }

    // Yeni initialization başlat
    this.initPromise = this._createInstance();

    try {
      this.instance = await this.initPromise;
      this._notifySubscribers('initialized', this.instance);
      return this.instance;
    } catch (error) {
      this.initPromise = null; // Reset promise on error
      throw error;
    }
  }

  /**
   * Private: Instance yaratma
   */
  static async _createInstance() {
    console.log('🎵 Creating PlaybackController singleton...');

    const audioEngine = AudioContextService.getAudioEngine();
    if (!audioEngine) {
      throw new Error('AudioEngine not available for PlaybackController');
    }

    // ✅ Get initial BPM from store (will be 90 or user's saved value)
    const initialBPM = await this._getInitialBPM();

    const controller = new PlaybackController(audioEngine, initialBPM);
    console.log('🎵 PlaybackController singleton created with BPM:', initialBPM);

    return controller;
  }

  /**
   * Get initial BPM from PlaybackStore
   */
  static async _getInitialBPM() {
    try {
      const { usePlaybackStore } = await import('@/store/usePlaybackStoreV2');
      const bpm = usePlaybackStore.getState().bpm;
      console.log('🎵 Retrieved initial BPM from store:', bpm);
      return bpm || 90; // Default to 90 if not set
    } catch (error) {
      console.warn('Could not get initial BPM from store, using default:', error);
      return 90; // Default BPM
    }
  }

  /**
   * Controller initialization'ını dinle
   */
  static onInitialization(callback) {
    this.subscribers.add(callback);

    // Eğer zaten initialize olduysa hemen callback'i çağır
    if (this.instance) {
      callback('initialized', this.instance);
    }

    return () => this.subscribers.delete(callback);
  }

  /**
   * Subscribers'ları bilgilendir
   */
  static _notifySubscribers(event, data) {
    this.subscribers.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('PlaybackController subscriber error:', error);
      }
    });
  }

  /**
   * Force reset - sadece test/development için
   */
  static reset() {
    if (this.instance) {
      try {
        this.instance.destroy();
      } catch (error) {
        console.warn('Error destroying PlaybackController:', error);
      }
    }

    this.instance = null;
    this.initPromise = null;
    this.subscribers.clear();
    console.log('🎵 PlaybackController singleton reset');
  }

  /**
   * Check if controller is ready
   */
  static isReady() {
    return !!this.instance;
  }

  /**
   * Get instance sync (returns null if not ready)
   */
  static getInstanceSync() {
    return this.instance;
  }
}

export default PlaybackControllerSingleton;