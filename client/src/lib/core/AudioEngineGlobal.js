/**
 * AudioEngineGlobal
 * 
 * A minimal global accessor for the Audio Engine instance.
 * 
 * ✅ UPDATED: Now works with NativeAudioEngineFacade (modular architecture)
 * 
 * Usage:
 * ```javascript
 * import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
 * import { NativeAudioEngineFacade } from '@/lib/core/NativeAudioEngineFacade';
 * 
 * const engine = new NativeAudioEngineFacade();
 * await engine.initialize();
 * AudioEngineGlobal.set(engine);
 * 
 * // Later, from anywhere:
 * const engine = AudioEngineGlobal.get();
 * engine.play();
 * ```
 */

let engineInstance = null;

export const AudioEngineGlobal = {
    /**
     * Set the global audio engine instance
     * @param {NativeAudioEngineFacade} engine - The audio engine facade instance
     */
    set: (engine) => {
        engineInstance = engine;
        // Also expose to window for debugging
        if (typeof window !== 'undefined') {
            window.audioEngine = engine;
        }
    },

    /**
     * Get the global audio engine instance
     * @returns {NativeAudioEngineFacade|null} The audio engine facade instance
     */
    get: () => engineInstance,

    /**
     * Check if audio context is ready/running
     * @returns {boolean}
     */
    isReady: () => {
        return engineInstance?.audioContext?.state === 'running';
    }
};

/**
 * Convenience function to get the global audio engine instance
 * @returns {NativeAudioEngineFacade|null} The audio engine facade instance
 */
export function getGlobalAudioEngine() {
    return engineInstance;
}
