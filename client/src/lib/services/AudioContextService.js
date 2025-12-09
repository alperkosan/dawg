// lib/services/AudioContextService.js - Enhanced with Interface Layer
// DAWG - AudioContextService v3.0 with Native Interface APIs
// Refactored to use decoupled services (IdleOptimizationManager, InterfaceService)

// Imports removed: effectRegistry, normalizeEffectParam
import EventBus from '../core/EventBus';
import { audioAssetManager } from '../audio/AudioAssetManager';
// import { effectRegistry } from '../audio/EffectRegistry'; // Unused
// import { normalizeEffectParam, normalizeEffectSettings } from '../audio/effects/parameterMappings.js'; // Unused

// Decoupled Services
import { IdleOptimizationManager } from '../audio/IdleOptimizationManager';
import { InterfaceService } from './InterfaceService';
import { MixerService } from './MixerService';
import { EffectService } from './EffectService';
import { InstrumentService } from './InstrumentService';

export class AudioContextService {
  static instance = null;
  static audioEngine = null;
  static isSubscriptionsSetup = false;
  static pendingMixerSync = false;

  static _idleManager = null;

  // =================== INTERFACE LAYER DELEGATION ===================
  // Delegates to InterfaceService for backward compatibility and clean access
  static get timeline() { return InterfaceService.getInstance().getTimeline(); }
  static get parameters() { return InterfaceService.getInstance().getParameters(); }
  static get loop() { return InterfaceService.getInstance().getLoopManager(); }
  static get events() { return InterfaceService.getInstance().eventBus; }

  // Specialized APIs (Deprecated direct access, use getters above)
  static get timelineAPI() { return this.timeline; }
  static get parameterSync() { return this.parameters; }
  static get loopManager() { return this.loop; }

  // =================== SINGLETON PATTERN ===================

  static getInstance() {
    if (!this.instance) {
      this.instance = new AudioContextService();
    }
    return this.instance;
  };

  static getAudioEngine() {
    return this.audioEngine;
  }

  static getAudioContext() {
    return this.audioEngine?.audioContext;
  }

  static async setAudioEngine(engine) {
    const isNewEngine = this.audioEngine !== engine;
    this.audioEngine = engine;

    // Initialize AudioAssetManager with AudioContext
    if (engine?.audioContext) {
      audioAssetManager.setAudioContext(engine.audioContext);
      console.log("✅ AudioAssetManager initialized");
    }

    // Initialize Interface Layer via Service
    InterfaceService.getInstance().initialize(engine);

    // Setup store subscriptions for reactive updates
    if (!this.isSubscriptionsSetup) {
      await this._setupStoreSubscriptions();
      this.isSubscriptionsSetup = true;
    }

    // Initialize Idle Optimization via Manager
    if (this._idleManager) {
      this._idleManager.dispose();
    }
    this._idleManager = new IdleOptimizationManager(engine);

    // Ensure AudioContext is resumed
    if (engine?.audioContext && engine.audioContext.state === 'suspended') {
      try {
        await engine.audioContext.resume();
        console.log('✅ AudioContext resumed after engine set');
      } catch (error) {
        console.warn('⚠️ Failed to resume AudioContext:', error);
      }
    }

    if (this.pendingMixerSync) {
      console.log('🔁 Pending mixer sync detected - running now');
      await this._syncMixerTracksToAudioEngine();
    }

    // Ensure Send Channels (Reverb/Delay) are initialized
    this._syncSendChannels();

    console.log("✅ AudioContextService v3.1: Native Engine + Interface Service + Idle Manager ready");
    return engine;
  };

  // =================== STORE INTEGRATION ===================
  /**
   * Store subscription management
   * Uses batch mode awareness and debouncing for optimal performance
   */
  static async _setupStoreSubscriptions() {
    console.log('📡 Setting up store subscriptions...');

    // Initial sync
    const syncService = (await import('./EngineStateSyncService.js')).EngineStateSyncService.getInstance();
    await syncService.syncMixerTracks();
    await syncService.syncInstrumentsToMixerInserts(true); // silent = true

    // Debounce timer for structural syncs
    let structuralSyncTimer = null;
    const STRUCTURAL_SYNC_DEBOUNCE = 50; // ms

    // Subscribe to Mixer Store with smart structural change detection
    const { useMixerStore } = await import('@/store/useMixerStore');
    useMixerStore.subscribe(async (state, prevState) => {
      // Skip if in batch mode (project restore in progress)
      if (syncService.isInBatchMode()) return;

      // ✅ PROFESSIONAL DAW ARCHITECTURE:
      // Only sync on STRUCTURAL changes (add/remove tracks, routing changes, effect structure)
      // Parameter changes (volume, pan, mute, solo, send levels) are handled by UI → AudioEngine directly

      const { hasStructuralChanges, changes } = syncService.detectStructuralChanges(state, prevState);

      if (hasStructuralChanges) {
        // Debounce structural syncs to prevent multiple rapid syncs
        if (structuralSyncTimer) clearTimeout(structuralSyncTimer);
        structuralSyncTimer = setTimeout(async () => {
          console.log(`🔧 Structural changes detected: ${changes.join(', ')} - syncing mixer...`);
          await syncService.syncMixerTracks();
        }, STRUCTURAL_SYNC_DEBOUNCE);
      }
    });

    // Subscribe to Instruments Store
    const { useInstrumentsStore } = await import('@/store/useInstrumentsStore');
    useInstrumentsStore.subscribe(async (state, prevState) => {
      // Skip if in batch mode (project restore in progress)
      if (syncService.isInBatchMode()) return;

      if (state.instruments !== prevState.instruments) {
        await syncService.syncInstrumentsToMixerInserts(true); // silent = true
      }
    });

    console.log('✅ Store subscriptions set up successfully');
  }

  /**
   * Normalize legacy send formats (object) into modern array structure
   * @param {object} track
   * @returns {Array<{busId: string, level: number, preFader: boolean}>}
   */
  static _normalizeTrackSends(track) {
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
  static async _syncMixerTracksToAudioEngine() {
    if (!this.audioEngine) {
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
        let insert = this.audioEngine.mixerInserts?.get(track.id);
        if (insert) return insert;
        try {
          insert = this.createMixerInsert(track.id, track.name || track.id);
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
                await this.audioEngine.addEffectToInsert(
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
          let busInsert = this.audioEngine.mixerInserts?.get(send.busId);
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
            this.audioEngine.createSend(track.id, send.busId, level, !!send.preFader);
          } catch (error) {
            console.error(`❌ Failed to recreate send ${track.id} → ${send.busId}:`, error);
          }
        }
      }

      if (typeof this.audioEngine.refreshAllMixerConnections === 'function') {
        this.audioEngine.refreshAllMixerConnections();
      }

      await this._syncInstrumentsToMixerInserts();
    } catch (error) {
      console.error('❌ Failed to sync mixer tracks:', error);
    }
  }

  /**
   * Sync existing instruments to mixer inserts
   */
  static async _syncInstrumentsToMixerInserts() {
    if (!this.audioEngine) return;

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

        let audioEngineInstrument = this.audioEngine.instruments?.get(instrument.id);

        if (!audioEngineInstrument) {
          try {
            if (instrument.type === 'sample' && instrument.url && !instrument.audioBuffer) {
              try {
                await this.audioEngine.preloadSamples([instrument]);
              } catch (e) {
                // Ignore
              }
            }
            await this.audioEngine.createInstrument(instrument);
            audioEngineInstrument = this.audioEngine.instruments?.get(instrument.id);
            if (audioEngineInstrument) continue;
            else continue;
          } catch (createError) {
            console.error(`❌ Failed to create instrument ${instrument.id}:`, createError);
            continue;
          }
        }

        let mixerInsert = this.audioEngine.mixerInserts?.get(instrument.mixerTrackId);
        if (!mixerInsert) {
          try {
            mixerInsert = this.createMixerInsert(instrument.mixerTrackId, instrument.mixerTrackId);
            if (!mixerInsert) continue;
            await new Promise(resolve => setTimeout(resolve, 10));
          } catch (createError) {
            continue;
          }
        }

        const currentRoute = this.audioEngine.instrumentToInsert?.get(instrument.id);
        let needsRouting = true;
        if (currentRoute === instrument.mixerTrackId) {
          const insert = this.audioEngine.mixerInserts?.get(instrument.mixerTrackId);
          const audioInstrument = this.audioEngine.instruments?.get(instrument.id);
          if (insert && audioInstrument?.output) {
            const isConnected = insert.instruments?.has(instrument.id);
            if (isConnected) needsRouting = true; // Force verify Wasm route
          }
        }

        if (needsRouting) {
          await this.routeInstrumentWithRetry(instrument.id, instrument.mixerTrackId, 5, 100);
        }
      }
    } catch (error) {
      console.error('❌ Failed to sync instruments:', error);
    }
  }

  // =================== BRIDGE METHODS ===================

  static updateMixerParam(trackId, param, value) {
    if (!this.audioEngine) return;
    if (param === 'volume' && this.audioEngine.setChannelVolume) {
      const linearValue = this.dbToLinear(value);
      this.audioEngine.setChannelVolume(trackId, linearValue);
    } else if (param === 'pan' && this.audioEngine.setChannelPan) {
      this.audioEngine.setChannelPan(trackId, value);
    } else if (param.startsWith('eq.') && this.audioEngine.setChannelEQ) {
      const eqParam = param.split('.')[1];
      this.audioEngine.setChannelEQ(trackId, eqParam, value);
    }
  }

  static setMuteState(trackId, muted) {
    if (this.audioEngine?.setChannelMute) this.audioEngine.setChannelMute(trackId, muted);
  }

  static setMonoState(trackId, mono) {
    if (this.audioEngine?.setChannelMono) this.audioEngine.setChannelMono(trackId, mono);
  }

  static setSoloState(soloedChannels, mutedChannels = new Set()) {
    if (!this.audioEngine?.mixerInserts) return;
    const isAnySoloed = soloedChannels.size > 0;
    this.audioEngine.mixerInserts.forEach((insert, insertId) => {
      if (insertId === 'master') return;
      const isSoloed = soloedChannels.has(insertId);
      const isManuallyMuted = mutedChannels.has(insertId);
      if (isAnySoloed) {
        if (this.audioEngine.setChannelMute) this.audioEngine.setChannelMute(insertId, !isSoloed);
      } else {
        if (this.audioEngine.setChannelMute) this.audioEngine.setChannelMute(insertId, isManuallyMuted);
      }
    });
  }

  // =================== EFFECTS MANAGEMENT ===================

  /**
   * @deprecated Use EffectService.rebuildMasterChain
   */
  static async rebuildMasterChain(trackState) {
    return EffectService.rebuildMasterChain(trackState);
  }


  /**
   * @deprecated Use EffectService.rebuildSignalChain
   */
  static async rebuildSignalChain(trackId, trackState) {
    return EffectService.rebuildSignalChain(trackId, trackState);
  }

  /**
   * @deprecated Use EffectService.reorderEffects
   */
  static reorderInsertEffects(trackId, sourceIndex, destinationIndex) {
    return EffectService.reorderEffects(trackId, sourceIndex, destinationIndex);
  }

  /**
   * @deprecated Use EffectService.toggleBypass
   */
  static toggleEffectBypass(trackId, effectId, bypass) {
    return EffectService.toggleBypass(trackId, effectId, bypass);
  }

  static getTrackState(trackId) {
    try {
      if (typeof window !== 'undefined' && window.__DAWG_STORES__?.useMixerStore) {
        const state = window.__DAWG_STORES__.useMixerStore.getState();
        return state.mixerTracks?.find(t => t.id === trackId);
      }
    } catch (e) { }
    return null;
  }

  /**
   * @deprecated Use EffectService.updateEffectParam
   */
  static updateEffectParam(trackId, effectId, param, value) {
    return EffectService.updateEffectParam(trackId, effectId, param, value);
  }

  /**
   * @deprecated Use EffectService.getEffectNode
   */
  static getEffectNode(trackId, effectId) {
    return EffectService.getEffectNode(trackId, effectId);
  }

  /**
   * @deprecated Use InstrumentService.previewSample
   */
  static previewSample(instrumentId, trackId, velocity = 0.8) {
    return InstrumentService.previewSample(instrumentId, trackId, velocity);
  }

  /**
   * @deprecated Use InstrumentService.stopPreview
   */
  static stopSamplePreview(instrumentId) {
    return InstrumentService.stopPreview(instrumentId);
  }

  /**
   * @deprecated Use InstrumentService.updateParameters
   */
  static updateInstrumentParams(instrumentId, params) {
    return InstrumentService.updateParameters(instrumentId, params);
  }

  /**
   * @deprecated Use InstrumentService.requestBuffer
   */
  static async requestInstrumentBuffer(instrumentId) {
    return InstrumentService.requestBuffer(instrumentId);
  }

  static dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  // =================== INSTRUMENT CREATION ===================

  /**
   * @deprecated Use InstrumentService.createInstrument
   */
  static async createInstrument(instrument) {
    return InstrumentService.createInstrument(instrument);
  }

  /**
   * @deprecated Use InstrumentService._syncInstrumentParams (private) or updateParameters
   */
  static async _syncInstrumentParams(instrumentId) {
    // This was an internal helper, delegating to InstrumentService's private logic if possible, 
    // but better to just use InstrumentService public API or duplicate logic if strictly needed.
    // Since it was checking store state, InstrumentService now handles this.
    // For now, we can check if InstrumentService has a way to trigger sync, or just rely on InstrumentService.updateParameters
    // InstrumentService._syncInstrumentParams is private. 
    // We cannot access it easily. However, createInstrument called this.
    // We delegated createInstrument to InstrumentService, which calls its own _syncInstrumentParams.
    // So this method might be unused unless called externally.
    // If called externally, we should probably warn or try to replicate using updateParameters.
    // But for now, let's leave it empty or log warning, as consumers should use InstrumentService.
    console.warn('AudioContextService._syncInstrumentParams is deprecated and no-op. Use InstrumentService.');
  }

  /**
   * @deprecated Use InstrumentService.updateParameters
   */
  static updateInstrumentParameters(instrumentId, params) {
    return InstrumentService.updateParameters(instrumentId, params);
  }

  /**
   * @deprecated Use InstrumentService.setMute
   */
  static setInstrumentMute(instrumentId, isMuted) {
    return InstrumentService.setMute(instrumentId, isMuted);
  }

  /**
   * @deprecated Use InstrumentService.reconcile
   */
  static async reconcileInstrument(instrumentId, instrumentData) {
    return InstrumentService.reconcile(instrumentId, instrumentData);
  }

  static dispose() {
    if (this._idleManager) {
      this._idleManager.dispose();
      this._idleManager = null;
    }
    this.audioEngine = null;
    this.pendingMixerSync = false;
    this.instance = null;
  }

  // =================== VISUALIZATION SUPPORT ===================

  /**
   * @deprecated Use EffectService.getEffectNode
   */
  static getEffectAudioNode(trackId, effectId) {
    return EffectService.getEffectNode(trackId, effectId);
  }

  /**
   * @deprecated Use MixerService.getChannelNode (if available) or access insert.output
   */
  static getChannelAudioNode(trackId) {
    // MixerService doesn't expose this yet, but we can access engine global
    const audioEngine = this.getAudioEngine();
    const insert = audioEngine?.mixerInserts?.get(trackId);
    return insert?.output || null;
  }

  // =================== DYNAMIC MIXER INSERT API ===================

  /**
   * @deprecated Use MixerService.createMixerInsert
   */
  static createMixerInsert(trackId, label = '') {
    return MixerService.createMixerInsert(trackId, label);
  }

  /**
   * @deprecated Use InstrumentService.routeWithRetry
   */
  static async routeInstrumentWithRetry(instrumentId, mixerTrackId, maxRetries = 5, baseDelay = 100) {
    return InstrumentService.routeWithRetry(instrumentId, mixerTrackId, maxRetries, baseDelay);
  }

  /**
   * @deprecated Use MixerService.removeMixerInsert
   */
  static removeMixerInsert(trackId) {
    return MixerService.removeMixerInsert(trackId);
  }

  /**
   * @deprecated Use InstrumentService.routeToInsert
   */
  static routeInstrumentToInsert(instrumentId, trackId) {
    return InstrumentService.routeToInsert(instrumentId, trackId);
  }

  /**
   * @deprecated Use EffectService.addEffect
   */
  static async addEffectToInsert(trackId, effectType, settings = {}) {
    return EffectService.addEffect(trackId, effectType, settings);
  }

  /**
   * @deprecated Use EffectService.removeEffect
   */
  static removeEffectFromInsert(trackId, effectId) {
    return EffectService.removeEffect(trackId, effectId);
  }

  /**
   * @deprecated Use EffectService.updateEffectParam
   */
  static updateInsertEffectParam(trackId, effectId, paramName, value) {
    return EffectService.updateEffectParam(trackId, effectId, paramName, value);
  }
  // Delegated to MixerService for better separation of concerns
  // These methods are kept for backward compatibility

  /**
   * Set track volume - delegates to MixerService
   * @deprecated Import MixerService directly for new code
   */
  static setTrackVolume(trackId, db) {
    return MixerService.setTrackVolume(trackId, db);
  }

  /**
   * Set track pan - delegates to MixerService
   * @deprecated Import MixerService directly for new code
   */
  static setTrackPan(trackId, pan) {
    return MixerService.setTrackPan(trackId, pan);
  }

  /**
   * Set track mute - delegates to MixerService
   * @deprecated Import MixerService directly for new code
   */
  static setTrackMute(trackId, muted) {
    return MixerService.setTrackMute(trackId, muted);
  }

  /**
   * Set track solo - delegates to MixerService
   * @deprecated Import MixerService directly for new code
   */
  static async setTrackSolo(trackId, solo) {
    return MixerService.setTrackSolo(trackId, solo);
  }

  /**
   * Set send level - delegates to MixerService
   * @deprecated Import MixerService directly for new code
   */
  static setSendLevel(trackId, sendId, level) {
    return MixerService.setSendLevel(trackId, sendId, level);
  }

  /**
   * Set effect bypass - delegates to MixerService
   * @deprecated Import MixerService directly for new code
   */
  static setEffectBypass(trackId, effectId, bypassed) {
    return MixerService.setEffectBypass(trackId, effectId, bypassed);
  }

  /**
   * Set master volume - delegates to MixerService
   * @deprecated Import MixerService directly for new code
   */
  static setMasterVolume(db) {
    return MixerService.setMasterVolume(db);
  }

  // =================== LEGACY COMPATIBILITY ===================
  // Keep old method names for backward compatibility

  static setInsertGain(trackId, gain) {
    return MixerService.setInsertGain(trackId, gain);
  }

  static setInsertPan(trackId, pan) {
    return MixerService.setInsertPan(trackId, pan);
  }

  // =================== UTILITY METHODS ===================

  static getInsertAnalyzer(trackId) {
    return MixerService.getAnalyzer(trackId);
  }

  static getMixerInsert(trackId) {
    return MixerService.getMixerInsert(trackId);
  }

  static async _syncSendChannels() {
    if (!this.audioEngine) return;
    try {
      const { useMixerStore } = await import('@/store/useMixerStore');
      const sendChannels = useMixerStore.getState().sendChannels;
      sendChannels.forEach(channel => {
        if (!this.audioEngine.mixerInserts.has(channel.id)) {
          this.audioEngine.createMixerInsert(channel.id, channel.name);
        }
      });
    } catch (e) { }
  }
}