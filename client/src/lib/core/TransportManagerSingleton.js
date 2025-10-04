// lib/core/TransportManagerSingleton.js
/**
 * 🎚️ TRANSPORT MANAGER SINGLETON
 *
 * Tüm uygulama boyunca tek instance - maximum coordination
 */

import { TransportManager } from './TransportManager.js';
import { AudioContextService } from '../services/AudioContextService.js';

class TransportManagerSingleton {
  constructor() {
    this.instance = null;
    this.initPromise = null;
  }

  async getInstance() {
    if (this.instance) {
      return this.instance;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._createInstance();
    return this.initPromise;
  }

  async _createInstance() {
    try {
      console.log('🎚️ Creating TransportManager singleton...');

      // Get audio engine
      const audioEngine = AudioContextService.getAudioEngine();
      if (!audioEngine) {
        console.warn('🎚️ Audio engine not available');
        return null;
      }

      // Create transport manager
      this.instance = new TransportManager(audioEngine);

      console.log('🎚️ TransportManager singleton created successfully');
      return this.instance;
    } catch (error) {
      console.error('🎚️ Failed to create TransportManager:', error);
      this.initPromise = null;
      return null;
    }
  }

  // ✅ MEMORY LEAK FIX: Comprehensive reset with cleanup
  reset() {
    if (this.instance) {
      this.instance.destroy();
    }
    this.instance = null;
    this.initPromise = null;
    console.log('🎚️ TransportManagerSingleton reset - memory cleaned');
  }

  // ✅ MEMORY LEAK FIX: Global cleanup for app shutdown
  cleanup() {
    this.reset();
    console.log('🎚️ TransportManagerSingleton cleanup completed');
  }
}

// Export singleton
export default new TransportManagerSingleton();