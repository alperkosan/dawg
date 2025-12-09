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
     * Sync mixer tracks from store to audio engine
     */
    async syncMixerTracks() {
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
    async syncInstrumentsToMixerInserts() {
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

            console.log(`🎵 Syncing ${instruments.length} instruments to mixer inserts...`);

            for (const instrument of instruments) {
                if (!instrument.mixerTrackId) continue;

                let audioEngineInstrument = engine.instruments?.get(instrument.id);

                if (!audioEngineInstrument) {
                    try {
                        // ✅ FIX: Preload samples even if audioBuffer exists
                        // For newly added samples, audioBuffer is loaded in UI but needs to be transferred to WASM worklet
                        if (instrument.type === 'sample' && instrument.url) {
                            try {
                                await engine.preloadSamples([instrument]);
                            } catch (e) {
                                console.warn(`Failed to preload sample for ${instrument.id}:`, e);
                            }
                        }
                        await engine.createInstrument(instrument);
                        audioEngineInstrument = engine.instruments?.get(instrument.id);
                        if (!audioEngineInstrument) continue;
                    } catch (createError) {
                        console.error(`❌ Failed to create instrument ${instrument.id}:`, createError);
                        continue;
                    }
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
