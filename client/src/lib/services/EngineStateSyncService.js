/**
 * EngineStateSyncService
 * 
 * Handles synchronization between React Stores (Zustand) and the NativeAudioEngine.
 * Extracts this complex logic from the legacy AudioContextService.
 */

import { AudioEngineGlobal } from '../core/AudioEngineGlobal';
import { normalizeEffectParam, normalizeEffectSettings } from '../audio/effects/parameterMappings.js';
import { effectRegistry } from '../audio/EffectRegistry';

export class EngineStateSyncService {
    static instance = null;

    static getInstance() {
        if (!this.instance) this.instance = new EngineStateSyncService();
        return this.instance;
    }

    constructor() {
        this.pendingMixerSync = false;
        // Batch mode: suppresses syncs during project restore
        this._batchMode = false;
        this._pendingBatchSync = false;
        this._syncDebounceTimer = null;
    }

    /**
     * Enable/disable batch mode for project restore
     * When enabled, syncs are suppressed and queued for a single sync at the end
     */
    setBatchMode(enabled) {
        const wasInBatchMode = this._batchMode;
        this._batchMode = enabled;

        // When exiting batch mode, ALWAYS perform final sync
        // This ensures instruments are connected to mixer after project restore
        if (wasInBatchMode && !enabled) {
            this._pendingBatchSync = false;
            console.log('📦 Batch mode ended - performing final sync...');
            this.syncMixerTracks();
            // Critical: Also sync instruments to mixer inserts!
            this.syncInstrumentsToMixerInserts();
        }
    }

    /**
     * Check if currently in batch mode
     */
    isInBatchMode() {
        return this._batchMode;
    }

    /**
     * Normalize legacy send formats (object) into modern array structure
     */
    _normalizeTrackSends(track) {
        if (!track) return [];
        if (Array.isArray(track.sends)) {
            return track.sends
                .filter(send => send && send.busId)
                .map(send => ({
                    busId: send.busId,
                    level: typeof send.level === 'number' ? Math.max(0, Math.min(1, send.level)) : 0,
                    preFader: !!send.preFader
                }));
        }
        if (!track.sends || typeof track.sends !== 'object') return [];
        return Object.entries(track.sends)
            .filter(([key]) => key && !key.endsWith('_muted'))
            .map(([busId, value]) => {
                const numericValue = typeof value === 'number' ? value : 0;
                const levelLinear = numericValue > 1 ? Math.pow(10, numericValue / 20) : numericValue;
                return {
                    busId,
                    level: Math.max(0, Math.min(1, levelLinear)),
                    preFader: false
                };
            });
    }

    /**
     * Detect structural changes in mixer state (vs parameter changes)
     * Structural changes require full sync, parameter changes are handled by UI
     * 
     * @param {Object} state - Current mixer state
     * @param {Object} prevState - Previous mixer state
     * @returns {Object} { hasStructuralChanges, changes: [] }
     */
    detectStructuralChanges(state, prevState) {
        const changes = [];

        // Track count changed (add/remove)
        if (state.mixerTracks?.length !== prevState.mixerTracks?.length) {
            changes.push('track_count');
        }

        // Send channel configuration changed
        if (state.sendChannels?.length !== prevState.sendChannels?.length) {
            changes.push('send_channels');
        }

        // Check for routing changes (send bus assignments)
        if (state.mixerTracks && prevState.mixerTracks) {
            const routingChanged = state.mixerTracks.some((track, idx) => {
                const prevTrack = prevState.mixerTracks[idx];
                if (!prevTrack || track.id !== prevTrack.id) return true;

                // Check if send routing changed (not levels, just assignments)
                const currentSends = this._normalizeTrackSends(track);
                const prevSends = this._normalizeTrackSends(prevTrack);

                if (currentSends.length !== prevSends.length) return true;

                return currentSends.some((send, i) => {
                    const prevSend = prevSends[i];
                    return !prevSend || send.busId !== prevSend.busId;
                });
            });

            if (routingChanged) {
                changes.push('routing');
            }
        }

        // Check for effect structure changes (add/remove, not parameter changes)
        if (state.mixerTracks && prevState.mixerTracks) {
            const effectsChanged = state.mixerTracks.some((track, idx) => {
                const prevTrack = prevState.mixerTracks[idx];
                if (!prevTrack || track.id !== prevTrack.id) return false;

                const currentEffects = track.insertEffects || [];
                const prevEffects = prevTrack.insertEffects || [];

                // Check count
                if (currentEffects.length !== prevEffects.length) return true;

                // Check IDs and types (not settings)
                return currentEffects.some((effect, i) => {
                    const prevEffect = prevEffects[i];
                    return !prevEffect || effect.id !== prevEffect.id || effect.type !== prevEffect.type;
                });
            });

            if (effectsChanged) {
                changes.push('effects');
            }
        }

        return {
            hasStructuralChanges: changes.length > 0,
            changes
        };
    }

    /**
     * Sync mixer tracks from store to audio engine
     * Respects batch mode - queues sync if in batch mode
     */
    async syncMixerTracks() {
        // If in batch mode, queue the sync for later
        if (this._batchMode) {
            this._pendingBatchSync = true;
            return;
        }

        const engine = AudioEngineGlobal.get();
        if (!engine) {
            console.warn('⚠️ Cannot sync mixer tracks: audio engine not ready');
            this.pendingMixerSync = true;
            return;
        }
        this.pendingMixerSync = false;

        try {
            let mixerTracks = [];
            try {
                const { useMixerStore } = await import('@/store/useMixerStore');
                const state = useMixerStore.getState();
                mixerTracks = state.mixerTracks || [];
            } catch (importError) {
                if (typeof window !== 'undefined' && window.__DAWG_STORES__?.useMixerStore) {
                    const state = window.__DAWG_STORES__.useMixerStore.getState();
                    mixerTracks = state.mixerTracks || [];
                } else {
                    console.warn('⚠️ Cannot access mixer store - mixer tracks may not be synced');
                    return;
                }
            }

            console.log(`🎛️ Syncing ${mixerTracks.length} mixer tracks to audio engine...`);

            const normalizedTracks = mixerTracks.map(track => ({
                ...track,
                sends: this._normalizeTrackSends(track)
            }));

            const trackMap = new Map(normalizedTracks.map(track => [track.id, track]));

            const ensureInsertForTrack = (track) => {
                if (!track) return null;
                let insert = engine.mixerInserts?.get(track.id);
                if (insert) return insert;
                try {
                    insert = engine.createMixerInsert(track.id, track.name || track.id);
                    if (insert) {
                        if (typeof track.volume === 'number') {
                            const linearGain = Math.pow(10, track.volume / 20);
                            insert.setGain(linearGain);
                        }
                        if (typeof track.pan === 'number') insert.setPan(track.pan);
                    }
                } catch (error) {
                    console.error(`❌ Failed to create mixer insert for track ${track.id}:`, error);
                    return null;
                }
                return insert;
            };

            for (const track of normalizedTracks) {
                const insert = ensureInsertForTrack(track);
                if (!insert) continue;

                if (track.insertEffects && Array.isArray(track.insertEffects) && track.insertEffects.length > 0) {
                    for (const effect of track.insertEffects) {
                        try {
                            const effectExists = insert.effects?.has(effect.id);
                            if (!effectExists) {
                                let mergedSettings = effect.settings || {};
                                if (effect.type === 'Compressor') {
                                    const { pluginConfig } = await import('@/config/pluginConfig.jsx');
                                    const compressorDefaults = pluginConfig?.Compressor?.defaultSettings || {};
                                    mergedSettings = { ...compressorDefaults, ...mergedSettings };
                                }
                                await engine.addEffectToInsert(
                                    track.id,
                                    effect.type,
                                    mergedSettings,
                                    effect.id
                                );
                            }
                            if (insert.effects?.has(effect.id)) {
                                const bypassState = effect.bypass === true;
                                insert.setEffectBypass(effect.id, bypassState);
                            }
                        } catch (error) {
                            console.error(`❌ Failed to add effect ${effect.type} to insert ${track.id}:`, error);
                        }
                    }
                }
            }

            for (const track of normalizedTracks) {
                if (!track.sends.length) continue;
                const sourceInsert = ensureInsertForTrack(track);
                if (!sourceInsert) continue;

                for (const send of track.sends) {
                    if (!send?.busId) continue;
                    let busInsert = engine.mixerInserts?.get(send.busId);
                    if (!busInsert) {
                        const busTrackState = trackMap.get(send.busId);
                        busInsert = ensureInsertForTrack(busTrackState);
                    }
                    if (!busInsert) continue;

                    const level = typeof send.level === 'number' ? send.level : 0;
                    const hasSend = sourceInsert?.sends && typeof sourceInsert.sends.has === 'function'
                        ? sourceInsert.sends.has(send.busId)
                        : false;

                    if (hasSend) {
                        try { sourceInsert.setSendLevel(send.busId, level); } catch (e) { console.warn(e); }
                        continue;
                    }
                    try {
                        engine.createSend(track.id, send.busId, level, !!send.preFader);
                    } catch (error) {
                        console.error(`❌ Failed to recreate send ${track.id} → ${send.busId}:`, error);
                    }
                }
            }

            if (typeof engine.refreshAllMixerConnections === 'function') {
                engine.refreshAllMixerConnections();
            }

            await this.syncInstrumentsToMixerInserts();
        } catch (error) {
            console.error('❌ Failed to sync mixer tracks:', error);
        }
    }

    /**
     * Sync existing instruments to mixer inserts
     */
    async syncInstrumentsToMixerInserts(silent = false) {
        // If in batch mode, skip (will be called after batch ends)
        if (this._batchMode) return;

        const engine = AudioEngineGlobal.get();
        if (!engine) return;

        try {
            let instruments = [];
            try {
                const { useInstrumentsStore } = await import('@/store/useInstrumentsStore');
                const state = useInstrumentsStore.getState();
                instruments = state.instruments || [];
            } catch (importError) {
                if (typeof window !== 'undefined' && window.__DAWG_STORES__?.useInstrumentsStore) {
                    const state = window.__DAWG_STORES__.useInstrumentsStore.getState();
                    instruments = state.instruments || [];
                } else return;
            }

            if (!silent) {
                console.log(`🎵 Syncing ${instruments.length} instruments to mixer inserts...`);
            }

            // ✅ Track pending instrument creations to prevent duplicates
            if (!this._pendingInstrumentCreations) {
                this._pendingInstrumentCreations = new Set();
            }

            // ✅ Track initialization promises to wait for completion
            const initPromises = [];

            for (const instrument of instruments) {
                if (!instrument.mixerTrackId) continue;

                let audioEngineInstrument = engine.instruments?.get(instrument.id);

                // ✅ CRITICAL FIX: Check if instrument exists OR is being created
                if (!audioEngineInstrument && !this._pendingInstrumentCreations.has(instrument.id)) {
                    try {
                        // Mark as pending to prevent duplicate creation
                        this._pendingInstrumentCreations.add(instrument.id);

                        // ✅ FIX: Preload samples even if audioBuffer exists
                        // For newly added samples, audioBuffer is loaded in UI but needs to be transferred to WASM worklet
                        // ✅ CRITICAL FIX: Also check for multiSamples (for multisampled instruments like Piano)
                        if (instrument.type === 'sample' && (instrument.url || (instrument.multiSamples && instrument.multiSamples.length > 0))) {
                            try {
                                await engine.preloadSamples([instrument]);
                            } catch (e) {
                                console.warn(`Failed to preload sample for ${instrument.id}:`, e);
                            }
                        }

                        // ✅ Create instrument and track initialization promise
                        const creationPromise = engine.createInstrument(instrument)
                            .then(() => {
                                // Remove from pending after successful creation
                                this._pendingInstrumentCreations.delete(instrument.id);
                                return engine.instruments?.get(instrument.id);
                            })
                            .catch((createError) => {
                                console.error(`❌ Failed to create instrument ${instrument.id}:`, createError);
                                // Remove from pending even on error to allow retry
                                this._pendingInstrumentCreations.delete(instrument.id);
                                return null;
                            });

                        initPromises.push(creationPromise);
                        audioEngineInstrument = await creationPromise;

                        if (!audioEngineInstrument) continue;
                    } catch (createError) {
                        console.error(`❌ Failed to create instrument ${instrument.id}:`, createError);
                        this._pendingInstrumentCreations.delete(instrument.id);
                        continue;
                    }
                } else if (this._pendingInstrumentCreations.has(instrument.id)) {
                    // Instrument is being created, skip for now
                    if (!silent) {
                        console.log(`⏳ Instrument ${instrument.id} is being created, skipping...`);
                    }
                    continue;
                }

                let mixerInsert = engine.mixerInserts?.get(instrument.mixerTrackId);
                if (!mixerInsert) {
                    try {
                        mixerInsert = engine.createMixerInsert(instrument.mixerTrackId, instrument.mixerTrackId);
                        if (!mixerInsert) continue;
                        await new Promise(resolve => setTimeout(resolve, 10)); // Yield to allow processing
                    } catch (createError) {
                        continue;
                    }
                }

                const currentRoute = engine.instrumentToInsert?.get(instrument.id);
                let needsRouting = true;
                if (currentRoute === instrument.mixerTrackId) {
                    const insert = engine.mixerInserts?.get(instrument.mixerTrackId);
                    if (insert && audioEngineInstrument.output) {
                        // Check actual connection in AudioNode graph if possible, or trust internal map
                        const isConnected = insert.instruments?.has(instrument.id);
                        if (isConnected) needsRouting = true; // Force verify Wasm route - simplified
                    }
                }

                if (needsRouting) {
                    // Ported from routeInstrumentWithRetry logic
                    let success = false;
                    for (let attempt = 0; attempt < 5; attempt++) {
                        const insert = engine.mixerInserts?.get(instrument.mixerTrackId);
                        if (audioEngineInstrument.output && insert) {
                            try {
                                // Assuming connectInstrument logic exists on the Engine or Insert
                                // If it was on Insert:
                                if (insert.connectInstrument) {
                                    success = insert.connectInstrument(instrument.id, audioEngineInstrument.output);
                                }
                                if (success) {
                                    engine.instrumentToInsert.set(instrument.id, instrument.mixerTrackId);
                                    break;
                                }
                            } catch (e) { }
                        }
                        if (!success) await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(1.5, attempt)));
                    }
                }
            }

            // ✅ Wait for all instrument initializations to complete
            if (initPromises.length > 0) {
                await Promise.all(initPromises);
                if (!silent) {
                    console.log(`✅ All ${initPromises.length} instrument initializations completed`);
                }
            }
        } catch (error) {
            console.error('❌ Failed to sync instruments:', error);
        }
    }

    async syncSendChannels() {
        const engine = AudioEngineGlobal.get();
        if (!engine) return;
        try {
            const { useMixerStore } = await import('@/store/useMixerStore');
            const state = useMixerStore.getState();
            const sendChannels = state.sendChannels || [];
            sendChannels.forEach(channel => {
                if (!engine.mixerInserts.has(channel.id)) {
                    engine.createMixerInsert(channel.id, channel.name);
                }
            });
        } catch (e) { }
    }
}
