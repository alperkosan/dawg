/**
 * useAudioEngine - React Hook for Audio Engine Access
 * 
 * Provides a convenient hook for accessing the audio engine in React components.
 * Uses the new NativeAudioEngineFacade by default, with optional legacy mode.
 * 
 * Usage:
 * ```jsx
 * import { useAudioEngine } from '@/hooks/useAudioEngine';
 * 
 * function MyComponent() {
 *   const engine = useAudioEngine();
 *   
 *   const handlePlay = () => engine?.play();
 *   const handleStop = () => engine?.stop();
 * }
 * ```
 * 
 * @module hooks/useAudioEngine
 */

import { useEffect, useState, useCallback } from 'react';
import { getGlobalAudioEngine as getEngine } from '@/lib/core/AudioEngineGlobal.js';

/**
 * Hook to access the global audio engine instance
 * @returns {Object|null} Audio engine instance
 */
export function useAudioEngine() {
    const [engine, setEngine] = useState(() => getEngine());

    useEffect(() => {
        // Re-check if engine is available
        const currentEngine = getEngine();
        if (currentEngine !== engine) {
            setEngine(currentEngine);
        }
    }, [engine]);

    return engine;
}

/**
 * Hook to access specific audio engine services
 * @returns {Object} Object with service accessors
 */
export function useAudioServices() {
    const engine = useAudioEngine();

    return {
        instrumentService: engine?.instrumentService || null,
        mixerService: engine?.mixerService || null,
        transportService: engine?.transportService || null,
        effectService: engine?.effectService || null,
        playbackService: engine?.playbackService || null,
        performanceService: engine?.performanceService || null
    };
}

/**
 * Hook for playback control
 * @returns {Object} Playback control methods
 */
export function usePlaybackControl() {
    const engine = useAudioEngine();

    const play = useCallback((startStep = 0) => {
        engine?.play(startStep);
    }, [engine]);

    const stop = useCallback(() => {
        engine?.stop();
    }, [engine]);

    const pause = useCallback(() => {
        engine?.pause();
    }, [engine]);

    const resume = useCallback(() => {
        engine?.resume();
    }, [engine]);

    const setBPM = useCallback((bpm) => {
        engine?.setBPM(bpm);
    }, [engine]);

    const setLoopPoints = useCallback((start, end) => {
        engine?.setLoopPoints(start, end);
    }, [engine]);

    return {
        play,
        stop,
        pause,
        resume,
        setBPM,
        setLoopPoints,
        isInitialized: engine?.isInitialized || false
    };
}

/**
 * Hook for mixer control
 * @returns {Object} Mixer control methods
 */
export function useMixerControl() {
    const engine = useAudioEngine();

    const setVolume = useCallback((trackId, volume) => {
        engine?.setChannelVolume(trackId, volume);
    }, [engine]);

    const setPan = useCallback((trackId, pan) => {
        engine?.setChannelPan(trackId, pan);
    }, [engine]);

    const setMute = useCallback((trackId, muted) => {
        engine?.setChannelMute(trackId, muted);
    }, [engine]);

    const setMasterVolume = useCallback((volume) => {
        engine?.setMasterVolume(volume);
    }, [engine]);

    return {
        setVolume,
        setPan,
        setMute,
        setMasterVolume
    };
}

/**
 * Hook for instrument control
 * @returns {Object} Instrument control methods
 */
export function useInstrumentControl() {
    const engine = useAudioEngine();

    const createInstrument = useCallback(async (data) => {
        return engine?.createInstrument(data);
    }, [engine]);

    const removeInstrument = useCallback((instrumentId) => {
        engine?.removeInstrument(instrumentId);
    }, [engine]);

    const setMute = useCallback((instrumentId, muted) => {
        engine?.setInstrumentMute(instrumentId, muted);
    }, [engine]);

    const auditionNote = useCallback((instrumentId, pitch, velocity = 0.8) => {
        engine?.auditionNoteOn(instrumentId, pitch, velocity);
    }, [engine]);

    const releaseNote = useCallback((instrumentId, pitch) => {
        engine?.auditionNoteOff(instrumentId, pitch);
    }, [engine]);

    return {
        createInstrument,
        removeInstrument,
        setMute,
        auditionNote,
        releaseNote
    };
}

/**
 * Hook for effect control
 * @returns {Object} Effect control methods
 */
export function useEffectControl() {
    const engine = useAudioEngine();

    const addEffect = useCallback((trackId, effectType, settings = {}) => {
        return engine?.addEffectToInsert(trackId, effectType, settings);
    }, [engine]);

    const removeEffect = useCallback((trackId, effectId) => {
        engine?.removeEffectFromInsert(trackId, effectId);
    }, [engine]);

    const updateEffect = useCallback((trackId, effectId, param, value) => {
        engine?.updateEffectParameter(trackId, effectId, param, value);
    }, [engine]);

    const toggleEffect = useCallback((trackId, effectId) => {
        engine?.toggleEffectOnInsert(trackId, effectId);
    }, [engine]);

    return {
        addEffect,
        removeEffect,
        updateEffect,
        toggleEffect
    };
}

export default useAudioEngine;
