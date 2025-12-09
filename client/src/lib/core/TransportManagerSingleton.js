// lib/core/TransportManagerSingleton.js
import { BaseSingleton } from './singletons/BaseSingleton.js';
import { AudioEngineGlobal } from './AudioEngineGlobal.js';
import { TransportManager } from './TransportManager.js';

/**
 * TRANSPORT MANAGER SINGLETON
 *
 * Global singleton for transport coordination across the application.
 * Maximum coordination with unified instance management.
 *
 * @extends BaseSingleton
 * @example
 * const transport = await TransportManagerSingleton.getInstance();
 * transport.startTransport();
 */
class TransportManagerSingleton extends BaseSingleton {
  /**
   * Create TransportManager instance
   * @override
   * @private
   */
  static async _createInstance() {
    console.log('🎚️ Creating TransportManager singleton...');

    // Get audio engine
    let audioEngine = AudioEngineGlobal.get();

    if (!audioEngine && typeof window !== 'undefined') {
      audioEngine = window.audioEngine;
    }

    if (!audioEngine) {
      throw new Error('AudioEngine not available for TransportManager');
    }

    // Create transport manager
    const manager = new TransportManager(audioEngine);

    console.log('🎚️ TransportManager singleton created successfully');
    return manager;
  }

  /**
   * @deprecated Use reset() instead
   */
  static cleanup() {
    console.warn('⚠️ TransportManagerSingleton.cleanup() is deprecated, use reset() instead');
    this.reset();
  }
}

// Export as static class (new pattern)
export default TransportManagerSingleton;

/**
 * Convenience function to get TransportManager instance
 * @returns {Promise<TransportManager>} TransportManager instance
 */
export async function getTransportManager() {
  return await TransportManagerSingleton.getInstance();
}

/**
 * Synchronous getter - returns null if not initialized
 * Use this only if you're sure the instance exists
 * @returns {TransportManager|null}
 */
export function getTransportManagerSync() {
  return TransportManagerSingleton._instance;
}
