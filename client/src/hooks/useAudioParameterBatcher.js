/**
 * useAudioParameterBatcher - React hook for batched audio parameter updates
 * 
 * Usage:
 * ```jsx
 * function VolumeSlider({ instrumentId }) {
 *   const { updateParameter } = useAudioParameterBatcher();
 *   
 *   const handleChange = (newValue) => {
 *     updateParameter(instrumentId, 'volume', newValue);
 *   };
 *   
 *   return <Slider onChange={handleChange} />;
 * }
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { audioParameterBatcher } from '../lib/audio/AudioParameterBatcher.js';
import { AudioEngineGlobal } from '../lib/core/AudioEngineGlobal.js';

export function useAudioParameterBatcher() {
    const batcherRef = useRef(audioParameterBatcher);

    // Initialize batcher with audio engine
    useEffect(() => {
        const engine = AudioEngineGlobal.get();
        if (engine) {
            batcherRef.current.setEngine(engine);
        }

        // Cleanup on unmount
        return () => {
            // Don't dispose the global batcher, just flush pending updates
            batcherRef.current.flush();
        };
    }, []);

    /**
     * Update a single parameter (batched)
     */
    const updateParameter = useCallback((instrumentId, param, value) => {
        batcherRef.current.update(instrumentId, param, value);
    }, []);

    /**
     * Update multiple parameters at once (batched)
     */
    const updateParameters = useCallback((instrumentId, params) => {
        batcherRef.current.updateBatch(instrumentId, params);
    }, []);

    /**
     * Force immediate flush of pending updates
     */
    const flush = useCallback(() => {
        batcherRef.current.flush();
    }, []);

    /**
     * Get batcher statistics
     */
    const getStats = useCallback(() => {
        return batcherRef.current.getStats();
    }, []);

    return {
        updateParameter,
        updateParameters,
        flush,
        getStats
    };
}

export default useAudioParameterBatcher;
