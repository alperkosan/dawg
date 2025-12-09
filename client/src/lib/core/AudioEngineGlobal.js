/**
 * AudioEngineGlobal
 * 
 * A minimal global accessor for the Audio Engine instance.
 * Replaces the monolithic AudioContextService.getInstance().
 */

let engineInstance = null;

export const AudioEngineGlobal = {
    /**
     * Set the global audio engine instance
     * @param {Object} engine - The NativeAudioEngine instance
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
     * @returns {Object|null} The NativeAudioEngine instance
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
