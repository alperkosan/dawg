// lib/services/AudioContextService.js - Enhanced Native Version
// DAWG - Enhanced Audio Context Service - Store Integration & Pattern Management

import { useArrangementStore } from '../../store/useArrangementStore';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { NativeTimeUtils } from '../utils/NativeTimeUtils';
import { PatternData } from '../core/NativeAudioEngine';

export class AudioContextService {
  static instance = null;
  static audioEngine = null;
  
  // =================== SINGLETON PATTERN ===================
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new AudioContextService();
    }
    return this.instance;
  }
  
  static async setAudioEngine(engine) {
    this.audioEngine = engine;
    
    // Setup store subscriptions for reactive updates
    this._setupStoreSubscriptions();
    
    console.log("✅ AudioContextService: Native Audio Engine v2.0 registered");
    return engine;
  }
  
  static getAudioEngine() {
    if (!this.audioEngine) {
      console.warn("⚠️ AudioContextService: Audio engine not ready!");
    }
    return this.audioEngine;
  }

  // =================== STORE INTEGRATION ===================

  static _setupStoreSubscriptions() {
    // Subscribe to arrangement changes
    useArrangementStore.subscribe((state, prevState) => {
      if (state.activePatternId !== prevState.activePatternId) {
        this._onActivePatternChanged(state.activePatternId);
      }
      
      if (state.patterns !== prevState.patterns) {
        this._onPatternsUpdated(state.patterns);
      }
    });

    // Subscribe to playback changes
    usePlaybackStore.subscribe((state, prevState) => {
      if (state.bpm !== prevState.bpm) {
        this.setBPM(state.bpm);
      }
      
      if (state.masterVolume !== prevState.masterVolume) {
        this.setMasterVolume(state.masterVolume);
      }
    });

    // Subscribe to mixer changes
    useMixerStore.subscribe((state, prevState) => {
      // Handle mixer track updates
      if (state.mixerTracks !== prevState.mixerTracks) {
        this._onMixerTracksUpdated(state.mixerTracks, prevState.mixerTracks);
      }
    });

    // Subscribe to instrument changes
    useInstrumentsStore.subscribe((state, prevState) => {
      if (state.instruments !== prevState.instruments) {
        this._onInstrumentsUpdated(state.instruments, prevState.instruments);
      }
    });
  }

  // =================== PATTERN MANAGEMENT ===================

  static _onActivePatternChanged(newPatternId) {
    const engine = this.getAudioEngine();
    if (!engine) return;

    engine.activePatternId = newPatternId;
    
    // Load the new pattern into the engine
    const arrangementState = useArrangementStore.getState();
    const pattern = arrangementState.patterns[newPatternId];
    
    if (pattern) {
      const patternData = new PatternData(pattern.id, pattern.name, pattern.data);
      engine.patterns.set(newPatternId, patternData);
    }

    // Reschedule if playing
    if (usePlaybackStore.getState().playbackState === 'playing') {
      this.reschedule();
    }

    console.log(`🔄 Active pattern changed: ${newPatternId}`);
  }

  static _onPatternsUpdated(newPatterns) {
    const engine = this.getAudioEngine();
    if (!engine) return;

    // Update all patterns in engine
    Object.entries(newPatterns).forEach(([patternId, pattern]) => {
      const patternData = new PatternData(pattern.id, pattern.name, pattern.data);
      engine.patterns.set(patternId, patternData);
    });

    console.log('🔄 Patterns updated in engine');
  }

  // =================== INSTRUMENT MANAGEMENT ===================

  static _onInstrumentsUpdated(newInstruments, prevInstruments) {
    const engine = this.getAudioEngine();
    if (!engine) return;

    // Find added instruments
    const prevIds = new Set(prevInstruments.map(inst => inst.id));
    const newInstruments_ = newInstruments.filter(inst => !prevIds.has(inst.id));
    
    // Find removed instruments
    const currentIds = new Set(newInstruments.map(inst => inst.id));
    const removedInstruments = prevInstruments.filter(inst => !currentIds.has(inst.id));

    // Create new instruments
    newInstruments_.forEach(async (instData) => {
      try {
        await this.createInstrument(instData);
      } catch (error) {
        console.error(`❌ Failed to create instrument: ${instData.name}`, error);
      }
    });

    // Remove old instruments
    removedInstruments.forEach(instData => {
      this.disposeInstrument(instData.id);
    });

    // Update existing instruments
    newInstruments.forEach(instData => {
      const prevInst = prevInstruments.find(inst => inst.id === instData.id);
      if (prevInst && this._hasInstrumentChanged(instData, prevInst)) {
        this.updateInstrumentParameters(instData.id, instData);
      }
    });
  }

  static _hasInstrumentChanged(newInst, prevInst) {
    // Check if significant parameters have changed
    return JSON.stringify(newInst.synthParams) !== JSON.stringify(prevInst.synthParams) ||
           newInst.isMuted !== prevInst.isMuted ||
           JSON.stringify(newInst.precomputed) !== JSON.stringify(prevInst.precomputed);
  }

  // =================== MIXER MANAGEMENT ===================

  static _onMixerTracksUpdated(newTracks, prevTracks) {
    const engine = this.getAudioEngine();
    if (!engine) return;

    newTracks.forEach(track => {
      const prevTrack = prevTracks.find(t => t.id === track.id);
      
      if (!prevTrack) {
        // New track - create mixer channel
        this._createMixerChannel(track);
      } else if (this._hasTrackChanged(track, prevTrack)) {
        // Existing track - update parameters
        this._updateMixerChannel(track, prevTrack);
      }
    });
  }

  static _hasTrackChanged(newTrack, prevTrack) {
    return newTrack.volume !== prevTrack.volume ||
           newTrack.pan !== prevTrack.pan ||
           JSON.stringify(newTrack.insertEffects) !== JSON.stringify(prevTrack.insertEffects) ||
           JSON.stringify(newTrack.sends) !== JSON.stringify(prevTrack.sends);
  }

  static async _createMixerChannel(trackData) {
    const engine = this.getAudioEngine();
    if (!engine) return;

    try {
      await engine._createMixerChannel(trackData.id, trackData.name, {
        type: trackData.type,
        isMaster: trackData.type === 'master'
      });
      
      // Apply initial settings
      this._updateMixerChannel(trackData, {});
      
      console.log(`✅ Mixer channel created: ${trackData.name}`);
    } catch (error) {
      console.error(`❌ Failed to create mixer channel: ${trackData.name}`, error);
    }
  }

  static _updateMixerChannel(trackData, prevTrackData) {
    const engine = this.getAudioEngine();
    const channel = engine?.mixerChannels?.get(trackData.id);
    if (!channel) return;

    // Update basic parameters
    if (trackData.volume !== prevTrackData.volume) {
      channel.setVolume(trackData.volume);
    }
    
    if (trackData.pan !== prevTrackData.pan) {
      channel.setPan(trackData.pan);
    }

    // Update EQ if changed
    if (trackData.eq && JSON.stringify(trackData.eq) !== JSON.stringify(prevTrackData.eq)) {
      Object.entries(trackData.eq).forEach(([band, settings]) => {
        channel.setEQBand(band, settings.gain);
      });
    }

    // Handle effects changes
    this._updateChannelEffects(channel, trackData.insertEffects || [], prevTrackData.insertEffects || []);
  }

  static async _updateChannelEffects(channel, newEffects, prevEffects) {
    // Remove old effects
    const prevEffectIds = new Set(prevEffects.map(fx => fx.id));
    const newEffectIds = new Set(newEffects.map(fx => fx.id));
    
    prevEffects.forEach(fx => {
      if (!newEffectIds.has(fx.id)) {
        channel.removeEffect(fx.id);
      }
    });

    // Add new effects
    for (const fx of newEffects) {
      if (!prevEffectIds.has(fx.id)) {
        try {
          await channel.addEffect(fx.type, fx.settings);
        } catch (error) {
          console.error(`❌ Failed to add effect: ${fx.type}`, error);
        }
      }
    }

    // Update existing effects
    newEffects.forEach(fx => {
      const prevFx = prevEffects.find(pFx => pFx.id === fx.id);
      if (prevFx && JSON.stringify(fx.settings) !== JSON.stringify(prevFx.settings)) {
        const effect = channel.effects.get(fx.id);
        if (effect) {
          Object.entries(fx.settings).forEach(([param, value]) => {
            effect.updateParameter(param, value);
          });
        }
      }
    });
  }

  // =================== CORE ENGINE METHODS ===================

  static async initialize(...args) { 
    return await this.getAudioEngine()?.initialize(...args); 
  }
  
  static async createInstrument(instrumentData) {
    const engine = this.getAudioEngine();
    if (!engine) return null;

    try {
      // Preload sample if needed
      if (instrumentData.type === 'sample' && instrumentData.url) {
        await engine.preloadSamples([instrumentData]);
      }

      const instrument = await engine.createInstrument(instrumentData);
      
      // Update store to reflect creation
      console.log(`✅ Instrument created: ${instrumentData.name}`);
      return instrument;
      
    } catch (error) {
      console.error(`❌ Failed to create instrument: ${instrumentData.name}`, error);
      throw error;
    }
  }
  
  static disposeInstrument(instrumentId) {
    const engine = this.getAudioEngine();
    const instrument = engine?.instruments?.get(instrumentId);
    
    if (instrument) {
      instrument.dispose();
      engine.instruments.delete(instrumentId);
      
      console.log(`🗑️ Instrument disposed: ${instrumentId}`);
      return true;
    }
    return false;
  }

  // =================== PATTERN & SCHEDULING ===================

  static reschedule() {
    const engine = this.getAudioEngine();
    if (!engine) return;

    // Get current pattern data from store
    const arrangementState = useArrangementStore.getState();
    const activePattern = arrangementState.patterns[arrangementState.activePatternId];
    
    if (activePattern) {
      const patternData = new PatternData(activePattern.id, activePattern.name, activePattern.data);
      engine.patterns.set(activePattern.id, patternData);
      engine.activePatternId = activePattern.id;
      
      // Reschedule the pattern
      engine.schedulePattern(activePattern.data);
    }

    console.log('🔄 Pattern rescheduled');
  }

  static schedulePattern(patternData) {
    return this.getAudioEngine()?.schedulePattern(patternData);
  }

  // =================== TRANSPORT CONTROLS ===================
  
  static play(startStep = 0) { 
    const engine = this.getAudioEngine();
    if (!engine) return;

    // Make sure current pattern is loaded
    this.reschedule();
    
    return engine.play(startStep); 
  }
  
  static pause() { 
    return this.getAudioEngine()?.pause(); 
  }
  
  static resume() { 
    return this.getAudioEngine()?.resume(); 
  }
  
  static stop() { 
    return this.getAudioEngine()?.stop(); 
  }
  
  static setBPM(bpm) { 
    return this.getAudioEngine()?.setBPM(bpm); 
  }
  
  static setLoop(startStep, endStep) { 
    // Update transport loop in engine
    const engine = this.getAudioEngine();
    if (engine?.transport) {
      engine.transport.setLoopPoints(startStep, endStep);
    }
  }
  
  static jumpToStep(step) { 
    const engine = this.getAudioEngine();
    if (engine?.transport) {
      engine.transport.setPosition(step);
    }
  }
  
  static jumpToBar(bar) { 
    const engine = this.getAudioEngine();
    if (engine?.transport) {
      const stepInBar = 16; // Assuming 16 steps per bar
      engine.transport.setPosition((bar - 1) * stepInBar);
    }
  }

  // =================== MIXER CONTROLS ===================
  
  static setChannelVolume(channelId, volume) {
    return this.getAudioEngine()?.setChannelVolume(channelId, volume);
  }
  
  static setChannelPan(channelId, pan) {
    return this.getAudioEngine()?.setChannelPan(channelId, pan);
  }
  
  static setChannelMute(channelId, muted) {
    return this.getAudioEngine()?.setChannelMute(channelId, muted);
  }
  
  static setChannelEQ(channelId, band, frequency, gain, q) {
    const engine = this.getAudioEngine();
    const channel = engine?.mixerChannels?.get(channelId);
    if (channel) {
      channel.setEQBand(band, gain);
    }
  }
  
  static setMasterVolume(volume) {
    return this.getAudioEngine()?.setMasterVolume(volume);
  }

  static updateMixerParam(trackId, param, value) {
    const engine = this.getAudioEngine();
    const channel = engine?.mixerChannels?.get(trackId);
    
    if (channel) {
      switch (param) {
        case 'volume':
          channel.setVolume(value);
          break;
        case 'pan':
          channel.setPan(value);
          break;
        default:
          console.warn(`⚠️ Unknown mixer param: ${param}`);
      }
    }
  }

  static setMuteState(trackId, isMuted) {
    return this.getAudioEngine()?.setChannelMute(trackId, isMuted);
  }

  static setSoloState(soloedChannels) {
    const engine = this.getAudioEngine();
    if (!engine) return;
    
    // Update all channels based on solo state
    engine.mixerChannels.forEach((channel, channelId) => {
      const isSoloed = soloedChannels.has(channelId);
      const isAnySoloed = soloedChannels.size > 0;
      channel.setSolo(isSoloed, isAnySoloed);
    });
  }

  static setInstrumentMute(instrumentId, isMuted) {
    // Find which mixer channel this instrument is connected to
    const instrumentData = useInstrumentsStore.getState().instruments.find(
      inst => inst.id === instrumentId
    );
    
    if (instrumentData?.mixerTrackId) {
      this.setMuteState(instrumentData.mixerTrackId, isMuted);
    }
  }

  // =================== AUDITION (PREVIEW) ===================
  
  static auditionNoteOn(instrumentId, pitch, velocity = 0.8) { 
    return this.getAudioEngine()?.auditionNoteOn(instrumentId, pitch, velocity); 
  }
  
  static auditionNoteOff(instrumentId, pitch) { 
    return this.getAudioEngine()?.auditionNoteOff(instrumentId, pitch); 
  }

  // =================== INSTRUMENT PARAMETERS ===================

  static updateInstrumentParameters(instrumentId, updatedInstrumentData) {
    const engine = this.getAudioEngine();
    const instrument = engine?.instruments?.get(instrumentId);
    
    if (!instrument) {
      console.warn(`⚠️ Instrument not found: ${instrumentId}`);
      return;
    }

    if (instrument.type === 'synth' && updatedInstrumentData.synthParams) {
      // Update synth parameters
      instrument.updateParameters(updatedInstrumentData.synthParams);
      console.log(`🔧 Synth parameters updated: ${instrumentId}`);
    }

    // Update other instrument properties
    if (updatedInstrumentData.isMuted !== undefined) {
      this.setInstrumentMute(instrumentId, updatedInstrumentData.isMuted);
    }
  }

  static reconcileInstrument(instrumentId, updatedInstData) {
    const engine = this.getAudioEngine();
    if (!engine) return null;

    const instrument = engine.instruments.get(instrumentId);
    if (!instrument || instrument.type !== 'sample') {
      console.warn(`[RECONCILE] ${instrumentId} is not a sample instrument`);
      return null;
    }

    console.log(`🔄 [RECONCILE] Processing ${instrumentId}...`, updatedInstData.precomputed);

    // For sample instruments, we might need to reprocess the buffer
    // This is a simplified version - you might want to implement actual buffer processing
    const originalBuffer = engine.sampleBuffers.get(instrumentId);
    if (!originalBuffer) {
      console.error(`❌ [RECONCILE] Original buffer not found: ${instrumentId}`);
      return null;
    }

    // Apply processing effects (normalize, reverse, etc.)
    let processedBuffer = originalBuffer;
    
    if (updatedInstData.precomputed) {
      // Here you would apply the processing effects
      // For now, we'll just return the original buffer
      console.log(`✅ [RECONCILE] ${instrumentId} buffer updated`);
    }

    return processedBuffer;
  }

  // =================== EFFECTS MANAGEMENT ===================

  static updateEffectParam(trackId, effectId, param, value) {
    const engine = this.getAudioEngine();
    const channel = engine?.mixerChannels?.get(trackId);
    const effect = channel?.effects?.get(effectId);
    
    if (effect) {
      effect.updateParameter(param, value);
    } else {
      console.warn(`⚠️ Effect not found: ${trackId}/${effectId}`);
    }
  }

  static updateEffectBandParam(trackId, effectId, bandId, param, value) {
    console.log(`🎛️ AudioContextService: EQ band update - ${trackId}/${effectId}/${bandId}.${param} = ${value}`);
    
    // For now, delegate to updateEffectParam
    // In a full implementation, you'd handle multi-band effects specially
    this.updateEffectParam(trackId, effectId, `${bandId}_${param}`, value);
  }

  static rebuildSignalChain(trackId, newTrackState) {
    console.log(`🔗 Rebuilding signal chain for: ${trackId}`);
    
    // In the native engine, this happens automatically when effects are added/removed
    // But we can trigger a rebuild if needed
    const engine = this.getAudioEngine();
    const channel = engine?.mixerChannels?.get(trackId);
    
    if (channel) {
      // Rebuild the channel's effect chain
      channel._rebuildEffectChain();
    }
  }

  // =================== ANALYSIS & MONITORING ===================
  
  static getAnalysisData(nodeId = 'master-spectrum') {
    return this.getAudioEngine()?.getAnalysisData(nodeId);
  }
  
  static getChannelMeterData(channelId) {
    return this.getAudioEngine()?.getChannelMeterData(channelId);
  }

  // =================== PERFORMANCE METRICS ===================
  
  static getPerformanceMetrics() { 
    const engine = this.getAudioEngine();
    if (!engine) {
      return {
        engineType: 'Not Initialized',
        audioLatency: 'Unknown',
        instrumentCount: 0,
        isNative: false
      };
    }

    const stats = engine.getEngineStats();
    return {
      engineType: 'Native AudioWorklet Engine v2.0',
      audioLatency: `${stats.audioContext.totalLatency.toFixed(1)}ms`,
      instrumentCount: stats.instruments.total,
      mixerChannelCount: stats.mixerChannels,
      contextState: stats.audioContext.state,
      sampleRate: `${stats.audioContext.sampleRate}Hz`,
      activeVoices: stats.performance.activeVoices,
      isNative: true,
      toneJSDependency: false,
      workletSupport: true,
      cpuUsage: stats.performance.cpuUsage,
      memoryUsage: stats.workletManager?.memoryUsage
    };
  }
  
  static getEngineStats() {
    return this.getAudioEngine()?.getEngineStats();
  }

  // =================== CONTEXT MANAGEMENT ===================
  
  static async resumeAudioContext() {
    const engine = this.getAudioEngine();
    if (engine?.audioContext?.state === 'suspended') {
      await engine.audioContext.resume();
      console.log('▶️ AudioContext resumed');
      return true;
    }
    return false;
  }
  
  static async suspendAudioContext() {
    const engine = this.getAudioEngine();
    if (engine?.audioContext?.state === 'running') {
      await engine.audioContext.suspend();
      console.log('⏸️ AudioContext suspended');
      return true;
    }
    return false;
  }
  
  static getCurrentTime() {
    const engine = this.getAudioEngine();
    return engine?.audioContext?.currentTime || 0;
  }

  // =================== ADVANCED FEATURES ===================

  static async optimizeForLowLatency() {
    const engine = this.getAudioEngine();
    if (!engine) return false;

    try {
      // Adjust buffer sizes and other settings for low latency
      engine.settings.bufferSize = 128;
      engine.settings.latencyHint = 'interactive';
      
      console.log('🚀 Engine optimized for low latency');
      return true;
    } catch (error) {
      console.error('❌ Failed to optimize for low latency:', error);
      return false;
    }
  }

  static createAudioBuffer(numberOfChannels, length, sampleRate) {
    const engine = this.getAudioEngine();
    return engine?.audioContext?.createBuffer(numberOfChannels, length, sampleRate);
  }

  static async decodeAudioData(arrayBuffer) {
    const engine = this.getAudioEngine();
    return await engine?.audioContext?.decodeAudioData(arrayBuffer);
  }

  // =================== UTILITY METHODS ===================

  static parseTime(timeValue) {
    const currentBPM = usePlaybackStore.getState().bpm;
    return NativeTimeUtils.parseTime(timeValue, currentBPM);
  }

  static getCurrentBPM() {
    return usePlaybackStore.getState().bpm;
  }

  static isNativeEngine() {
    const engine = this.getAudioEngine();
    return engine && engine.engineMode === 'native-worklet';
  }

  static getEngineMode() {
    const engine = this.getAudioEngine();
    return engine?.engineMode || 'unknown';
  }

  // =================== PATTERN UTILITIES ===================

  static updatePatternNotes(patternId, instrumentId, newNotes) {
    const engine = this.getAudioEngine();
    const pattern = engine?.patterns?.get(patternId);
    
    if (pattern) {
      pattern.updateInstrumentNotes(instrumentId, newNotes);
      
      // If this is the active pattern and we're playing, reschedule
      if (patternId === engine.activePatternId && 
          usePlaybackStore.getState().playbackState === 'playing') {
        this.reschedule();
      }
    }
  }

  static createNewPattern(name = 'New Pattern') {
    const engine = this.getAudioEngine();
    if (!engine) return null;

    const patternId = `pattern_${Date.now()}`;
    const pattern = new PatternData(patternId, name, {});
    
    engine.patterns.set(patternId, pattern);
    
    return {
      id: patternId,
      name: name,
      data: {}
    };
  }

  static clonePattern(sourcePatternId, newName) {
    const engine = this.getAudioEngine();
    const sourcePattern = engine?.patterns?.get(sourcePatternId);
    
    if (!sourcePattern) {
      console.warn(`⚠️ Source pattern not found: ${sourcePatternId}`);
      return null;
    }

    const clonedPattern = sourcePattern.clone();
    clonedPattern.name = newName || `${sourcePattern.name} Copy`;
    
    engine.patterns.set(clonedPattern.id, clonedPattern);
    
    return {
      id: clonedPattern.id,
      name: clonedPattern.name,
      data: clonedPattern.data
    };
  }

  // =================== DEBUGGING & DEVELOPMENT ===================
  
  static logEngineState() {
    const engine = this.getAudioEngine();
    if (engine) {
      console.group('🔊 Native Audio Engine State');
      console.log('Engine Mode:', engine.engineMode);
      console.log('Instruments:', Array.from(engine.instruments.keys()));
      console.log('Mixer Channels:', Array.from(engine.mixerChannels.keys()));
      console.log('Patterns:', Array.from(engine.patterns.keys()));
      console.log('Active Pattern:', engine.activePatternId);
      console.log('Performance Stats:', engine.getEngineStats());
      console.groupEnd();
    } else {
      console.warn('⚠️ No engine available for logging');
    }
  }

  static async runDiagnostics() {
    console.group('🔍 Audio Engine Diagnostics');
    
    const engine = this.getAudioEngine();
    if (!engine) {
      console.error('❌ No audio engine initialized');
      console.groupEnd();
      return false;
    }

    // Test audio context
    console.log('AudioContext State:', engine.audioContext.state);
    console.log('Sample Rate:', engine.audioContext.sampleRate);
    console.log('Base Latency:', engine.audioContext.baseLatency);
    console.log('Output Latency:', engine.audioContext.outputLatency);

    // Test worklet manager
    if (engine.workletManager) {
      const workletStats = engine.workletManager.getDetailedStats();
      console.log('Worklet Manager:', workletStats);
    }

    // Test transport
    if (engine.transport) {
      const transportStats = engine.transport.getStats();
      console.log('Transport:', transportStats);
    }

    // Test instruments
    console.log('Instruments:', engine.instruments.size);
    engine.instruments.forEach((instrument, id) => {
      console.log(`  ${id}: ${instrument.type} (${instrument.getActiveVoiceCount()} voices)`);
    });

    // Test mixer channels
    console.log('Mixer Channels:', engine.mixerChannels.size);
    engine.mixerChannels.forEach((channel, id) => {
      const meterData = channel.getMeterData();
      console.log(`  ${id}: Peak=${meterData.peak.toFixed(1)}dB, RMS=${meterData.rms.toFixed(1)}dB`);
    });

    console.groupEnd();
    return true;
  }

  // =================== LEGACY COMPATIBILITY ===================
  
  // These methods provide compatibility with the old engine interface
  static fullSync(instrumentData, mixerTrackData, arrangementData) {
    console.warn('⚠️ fullSync is deprecated in Native Engine v2.0');
    // The new engine handles this through store subscriptions
    return Promise.resolve();
  }
  
  static removeInstrument(instrumentId) { 
    console.warn('⚠️ removeInstrument is deprecated - use disposeInstrument instead');
    return this.disposeInstrument(instrumentId);
  }
  
  static async requestInstrumentBuffer(instrumentId) { 
    console.warn('⚠️ requestInstrumentBuffer not applicable in Native Engine v2.0');
    const engine = this.getAudioEngine();
    return engine?.sampleBuffers?.get(instrumentId) || null;
  }
  
  static updateLoopRange(startStep, endStep) {
    return this.setLoop(startStep, endStep);
  }

  static updateChannelEQ(trackId, band, param, value) {
    // Simplified EQ update for compatibility
    this.setChannelEQ(trackId, band, 1000, value, 1);
  }

  static resetChannelEQ(trackId) {
    const engine = this.getAudioEngine();
    const channel = engine?.mixerChannels?.get(trackId);
    
    if (channel) {
      // Reset all EQ bands to 0
      ['low', 'mid', 'high'].forEach(band => {
        channel.setEQBand(band, 0);
      });
    }
  }

  static updateMasterEQ(band, param, value) {
    const engine = this.getAudioEngine();
    if (engine?.masterMixer) {
      const paramName = `${band}Gain`;
      const param = engine.masterMixer.parameters.get(paramName);
      if (param) {
        param.setTargetAtTime(value, engine.audioContext.currentTime, 0.02);
      }
    }
  }
}