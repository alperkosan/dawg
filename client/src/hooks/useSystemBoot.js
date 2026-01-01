import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { AudioEngineGlobal } from '../lib/core/AudioEngineGlobal';
import { EngineStateSyncService } from '../lib/services/EngineStateSyncService';
import { AudioContextService } from '../lib/services/AudioContextService';
import { NativeAudioEngineFacade } from '../lib/core/NativeAudioEngineFacade';
import { EffectFactory } from '../lib/audio/effects/EffectFactory';
import { visualizationEngine } from '@/features/visualization/engine/VisualizationEngine';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { useMixerStore } from '../store/useMixerStore';
import { useAuthStore } from '../store/useAuthStore';
import { InterfaceService } from '../lib/services/InterfaceService';
import { IdleOptimizationManager } from '../lib/audio/IdleOptimizationManager';
import { WasmModuleCache } from '../lib/core/WasmModuleCache.js';

export const useSystemBoot = () => {
    // ✅ Initialize ref with existing engine (HMR support)
    const audioEngineRef = useRef(AudioEngineGlobal.get());

    const [engineStatus, setEngineStatus] = useState(() => {
        // Check active engine presence (HMR/Navigation)
        const existingEngine = audioEngineRef.current;
        if (existingEngine?.audioContext && existingEngine.audioContext.state !== 'closed') {
            return 'ready';
        }

        // Fallback to persistence
        const persistedStatus = sessionStorage.getItem('dawg_engine_status');
        if (persistedStatus === 'ready') {
            // Verify we actually have an engine matching this claim
            const engine = AudioEngineGlobal.get();
            if (engine?.audioContext && engine.audioContext.state !== 'closed') {
                return 'ready';
            }
        }
        return 'idle';
    });

    const [engineError, setEngineError] = useState(null);
    const [autoStartInProgress, setAutoStartInProgress] = useState(false);
    // audioEngineRef initialized above
    const { isGuest } = useAuthStore();

    const audioEngineCallbacks = useMemo(() => ({
        setPlaybackState: (state) => { }, // Deprecated or unused
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
        onMixerLevels: useMixerStore.getState().batchUpdateLevels,
    }), []);

    const initializeAudioSystem = useCallback(async () => {
        if (engineStatus === 'ready' || engineStatus === 'initializing') return;

        // Check for existing engine again
        const existingEngine = AudioEngineGlobal.get();
        if (existingEngine?.audioContext && existingEngine.audioContext.state !== 'closed') {
            console.log('♻️ Reusing existing audio engine');
            audioEngineRef.current = existingEngine;
            window.audioEngine = existingEngine;

            if (existingEngine.audioContext.state === 'suspended') {
                try {
                    await existingEngine.resumeAudioContext();
                } catch (e) { console.warn(e); }
            }

            try {
                // Ensure mixer and instruments are synced
                await EngineStateSyncService.getInstance().syncMixerTracks();
            } catch (e) { console.warn(e); }

            setEngineStatus('ready');
            sessionStorage.setItem('dawg_engine_status', 'ready');
            return;
        }

        setEngineStatus('initializing');
        console.log('🚀 Booting System...');

        try {
            const engine = new NativeAudioEngineFacade(audioEngineCallbacks);
            await engine.initialize();
            audioEngineRef.current = engine;
            window.audioEngine = engine;

            try {
                await engine.resumeAudioContext();
            } catch (e) { console.warn(e); }

            // ✅ PERFORMANCE: Preload WASM module before any instruments are created
            // This eliminates the fetch/compile delay for the first instrument
            WasmModuleCache.preload().catch(err => {
                console.warn('⚠️ WASM preload failed (will load on-demand):', err);
            });

            // Load Worklets
            if (engine.workletManager) {
                const processorConfigs = [
                    { path: '/worklets/wasm-sampler-processor.js', name: 'wasm-sampler-processor' },
                    ...EffectFactory.getWorkletConfigs()
                ];
                await engine.workletManager.loadMultipleWorklets(processorConfigs);
            }

            AudioEngineGlobal.set(engine);

            // ✅ Initialize AudioContextService with engine (sets up store subscriptions)
            await AudioContextService.setAudioEngine(engine);

            // Initialize optimization manager
            new IdleOptimizationManager(engine);

            // Initial sync of mixer and instruments
            try {
                await EngineStateSyncService.getInstance().syncMixerTracks();
                await EngineStateSyncService.getInstance().syncInstrumentsToMixerInserts();
            } catch (e) { console.warn(e); }

            if (engine.audioContext) {
                visualizationEngine.init(engine.audioContext);
            }

            setEngineStatus('ready');
            sessionStorage.setItem('dawg_engine_status', 'ready');

        } catch (error) {
            console.error('❌ Boot Error:', error);
            setEngineError(error.message);
            setEngineStatus('error');
            sessionStorage.removeItem('dawg_engine_status');
        }
    }, [engineStatus, audioEngineCallbacks]);

    // Auto-Start Check
    useEffect(() => {
        if (engineStatus !== 'idle') return;

        let shouldAutoStart = false;
        try {
            const stored = sessionStorage.getItem('daw-auto-start');
            shouldAutoStart = stored ? JSON.parse(stored) : false;
        } catch { }

        if (shouldAutoStart && !autoStartInProgress) {
            sessionStorage.removeItem('daw-auto-start');
            setAutoStartInProgress(true);
            initializeAudioSystem();
        }
    }, [engineStatus, initializeAudioSystem, autoStartInProgress]);

    return {
        engineStatus,
        engineError,
        initializeAudioSystem,
        audioEngineRef
    };
};
