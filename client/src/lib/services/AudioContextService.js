// client/src/lib/services/AudioContextService.js - Native Version
import { useArrangementStore } from '../../store/useArrangementStore';
import { NativeTimeUtils } from '../utils/NativeTimeUtils';

export class AudioContextService {
  static instance = null;
  static audioEngine = null;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new AudioContextService();
    }
    return this.instance;
  }
  
  static async setAudioEngine(engine) {
    this.audioEngine = engine;
    
    // Engine tipini algıla
    if (engine && typeof engine.getEngineStats === 'function') {
      console.log("✅ AudioContextService: Native Audio Engine detected");
    } else if (engine && typeof engine.enableHybridMode === 'function') {
      console.log("✅ AudioContextService: Hybrid Audio Engine detected");
    } else {
      console.log("✅ AudioContextService: Standard Audio Engine detected");
    }
    
    console.log("✅ AudioContextService: Audio engine registered successfully");
  }
  
  static getAudioEngine() {
    if (!this.audioEngine) {
        console.warn("AudioContextService: Audio engine not ready or not registered!");
    }
    return this.audioEngine;
  }
  
  // =========================================================================
  // === NATIVE AUDIO ENGINE METHODS ===
  // =========================================================================
  
  // --- Core Engine Methods ---
  static async initialize(...args) { 
    return await this.getAudioEngine()?.initialize(...args); 
  }
  
  static async createInstrument(...args) { 
    return await this.getAudioEngine()?.createInstrument(...args); 
  }
  
  static disposeInstrument(instrumentId) {
    const engine = this.getAudioEngine();
    const instrument = engine?.instruments?.get(instrumentId);
    if (instrument) {
      instrument.workletInst?.dispose();
      engine.instruments.delete(instrumentId);
      
      // Mixer channel'ı da temizle
      const mixerChannel = engine.mixerChannels?.get(instrumentId);
      if (mixerChannel) {
        mixerChannel.input?.disconnect();
        mixerChannel.output?.disconnect();
        engine.mixerChannels.delete(instrumentId);
      }
      
      console.log(`🗑️ Instrument disposed: ${instrumentId}`);
      return true;
    }
    return false;
  }
  
  // --- Transport Controls ---
  static play(startStep = 0) { 
    return this.getAudioEngine()?.play(startStep); 
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
    return this.getAudioEngine()?.setLoop(startStep, endStep); 
  }
  
  static jumpToStep(step) { 
    return this.getAudioEngine()?.jumpToStep(step); 
  }
  
  static jumpToBar(bar) { 
    return this.getAudioEngine()?.jumpToBar(bar); 
  }
  
  // --- Audio Playback ---
  static auditionNoteOn(instrumentId, pitch, velocity = 0.8) { 
    return this.getAudioEngine()?.auditionNoteOn(instrumentId, pitch, velocity); 
  }
  
  static auditionNoteOff(instrumentId, pitch) { 
    return this.getAudioEngine()?.auditionNoteOff(instrumentId, pitch); 
  }
  
  // --- Mixer Controls ---
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
    return this.getAudioEngine()?.setChannelEQ(channelId, band, frequency, gain, q);
  }
  
  static setMasterVolume(volume) {
    return this.getAudioEngine()?.setMasterVolume(volume);
  }
  
  // --- Pattern Scheduling ---
  static schedulePattern(patternData) {
    return this.getAudioEngine()?.schedulePattern(patternData);
  }
  
  static reschedule() {
    // Native engine'de schedulePattern kullanılır
    const engine = this.getAudioEngine();
    if (!engine) return;
    
    // Pattern data'yı stores'dan al
    const arrangements = useArrangementStore?.getState?.();
    const activePattern = arrangements?.patterns?.[arrangements?.activePatternId];
    
    if (activePattern?.data) {
      engine.schedulePattern(activePattern.data);
      console.log('🔄 Pattern rescheduled');
    }
  }

  // Time utilities
  parseTime(timeValue) {
      return NativeTimeUtils.parseTime(timeValue, this.getCurrentBPM());
  }

  getCurrentBPM() {
      return this.audioEngine?.transport?.bpm || 120;
  }
  
  // --- Analysis Data ---
  static getAnalysisData(nodeId = 'master-spectrum') {
    return this.getAudioEngine()?.getAnalysisData(nodeId);
  }
  
  static getChannelMeterData(channelId) {
    return this.getAudioEngine()?.getChannelMeterData(channelId);
  }
  
  // --- Performance Metrics ---
  static getPerformanceMetrics() { 
    const engine = this.getAudioEngine();
    if (engine?.getEngineStats) {
      const stats = engine.getEngineStats();
      return {
        engineType: 'Native AudioWorklet',
        audioLatency: `${stats.audioContext.totalLatency.toFixed(1)}ms`,
        instrumentCount: stats.performance.instrumentCount,
        mixerChannelCount: stats.performance.mixerChannelCount,
        contextState: stats.audioContext.contextState,
        sampleRate: stats.audioContext.actualSampleRate,
        bufferSize: stats.audioContext.bufferSize,
        isNative: true,
        toneJsDependency: false // 🎯 Tone.js tamamen kaldırıldı!
      };
    }
    
    return {
      engineType: 'Unknown',
      audioLatency: 'Unknown',
      instrumentCount: 0,
      isNative: false
    };
  }
  
  static getEngineStats() {
    return this.getAudioEngine()?.getEngineStats();
  }
  
  // --- Context Management ---
  static async resumeAudioContext() {
    const engine = this.getAudioEngine();
    return await engine?.audioContextManager?.resume();
  }
  
  static async suspendAudioContext() {
    const engine = this.getAudioEngine();
    return await engine?.audioContextManager?.suspend();
  }
  
  static getCurrentTime() {
    const engine = this.getAudioEngine();
    return engine?.audioContextManager?.currentTime || 0;
  }
  
  // --- Advanced Features ---
  static async optimizeForLowLatency() {
    const engine = this.getAudioEngine();
    return await engine?.audioContextManager?.optimizeForLowLatency();
  }
  
  static createAudioBuffer(numberOfChannels, length, sampleRate) {
    const engine = this.getAudioEngine();
    return engine?.audioContextManager?.createBuffer(numberOfChannels, length, sampleRate);
  }
  
  static async decodeAudioData(arrayBuffer) {
    const engine = this.getAudioEngine();
    return await engine?.audioContextManager?.decodeAudioData(arrayBuffer);
  }
  
  // --- Backward Compatibility Methods (deprecated but kept for compatibility) ---
  static fullSync(instrumentData, mixerTrackData, arrangementData) {
    console.warn('⚠️ fullSync is deprecated in Native Engine. Use individual create methods.');
    // Native engine'de her instrument ayrı ayrı oluşturulur
    return Promise.resolve();
  }
  
  static updateInstrumentParameters(instrumentId, updatedInstrumentData) {
    const engine = this.getAudioEngine();
    const instrument = engine?.instruments?.get(instrumentId);
    
    if (instrument?.workletInst && updatedInstrumentData.synthParams) {
      const synthParams = updatedInstrumentData.synthParams;
      const worklet = instrument.workletInst;

      if (synthParams.oscillator) {
        worklet.updateParameter('detune', synthParams.oscillator.detune || 0);
      }
      if (synthParams.envelope) {
        worklet.updateParameter('attack', synthParams.envelope.attack || 0.01);
        worklet.updateParameter('decay', synthParams.envelope.decay || 0.3);
        worklet.updateParameter('sustain', synthParams.envelope.sustain || 0.7);
        worklet.updateParameter('release', synthParams.envelope.release || 1);
      }
      if (synthParams.filter) {
        worklet.updateParameter('filterFreq', synthParams.filter.frequency || 1000);
        worklet.updateParameter('filterQ', synthParams.filter.Q || 1);
      }
      
      console.log(`🔧 Native instrument parameters updated: ${instrumentId}`);
    }
  }
  
  static updateMixerParam(trackId, param, value) {
    const engine = this.getAudioEngine();
    
    switch (param) {
      case 'volume':
        engine?.setChannelVolume(trackId, value);
        break;
      case 'pan':
        engine?.setChannelPan(trackId, value);
        break;
      default:
        console.warn(`⚠️ Unknown mixer param: ${param}`);
    }
  }
  
  static setMuteState(trackId, isMuted) {
    return this.getAudioEngine()?.setChannelMute(trackId, isMuted);
  }
  
  static setSoloState(soloedChannels) {
    // Native engine'de solo logic
    const engine = this.getAudioEngine();
    if (!engine) return;
    
    engine.mixerChannels.forEach((channel, channelId) => {
      const isSoloed = soloedChannels.has(channelId);
      const shouldMute = soloedChannels.size > 0 && !isSoloed;
      
      if (channel.solo) {
        channel.solo.gain.exponentialRampToValueAtTime(
          shouldMute ? 0.001 : 1,
          engine.audioContextManager.currentTime + 0.02
        );
      }
    });
  }
  
  static setInstrumentMute(instrumentId, isMuted) {
    return this.setChannelMute(instrumentId, isMuted);
  }
  
  // --- Legacy Methods (no-op in native) ---
  static removeInstrument(...args) { 
    console.warn('⚠️ removeInstrument - use disposeInstrument instead');
    return this.disposeInstrument(...args);
  }
  
  static reconcileInstrument(...args) { 
    console.warn('⚠️ reconcileInstrument not needed in Native Engine');
    return null;
  }
  
  static async requestInstrumentBuffer(...args) { 
    console.warn('⚠️ requestInstrumentBuffer not applicable in Native Engine');
    return null;
  }
  
  static rebuildSignalChain(...args) { 
    console.warn('⚠️ rebuildSignalChain not needed in Native Engine');
  }
  
  static updateEffectParam(...args) { 
    console.warn('⚠️ updateEffectParam not implemented in Native Engine yet');
  }
  
  static updateSendLevel(...args) { 
    console.warn('⚠️ updateSendLevel not implemented in Native Engine yet');
  }
  
  static updateLoopRange(startStep, endStep) {
    return this.setLoop(startStep, endStep);
  }
  
  static updateEffectBandParam(...args) { 
    console.warn('⚠️ updateEffectBandParam not implemented in Native Engine yet');
  }
  
  static updateChannelEQ(trackId, band, param, value) {
    // Simplified EQ update
    const engine = this.getAudioEngine();
    const channel = engine?.mixerChannels?.get(trackId);
    
    if (channel?.eq?.[band]) {
      const eqBand = channel.eq[band];
      if (param === 'gain') {
        eqBand.gain.setValueAtTime(value, engine.audioContextManager.currentTime);
      } else if (param === 'frequency') {
        eqBand.frequency.setValueAtTime(value, engine.audioContextManager.currentTime);
      } else if (param === 'q') {
        eqBand.Q.setValueAtTime(value, engine.audioContextManager.currentTime);
      }
    }
  }
  
  static resetChannelEQ(trackId) {
    const engine = this.getAudioEngine();
    const channel = engine?.mixerChannels?.get(trackId);
    
    if (channel?.eq) {
      Object.values(channel.eq).forEach(eqBand => {
        eqBand.gain.setValueAtTime(0, engine.audioContextManager.currentTime);
      });
    }
  }
  
  static updateMasterEQ(band, param, value) {
    const engine = this.getAudioEngine();
    const masterEQ = engine?.masterMixer?.eq?.[band];
    
    if (masterEQ) {
      if (param === 'gain') {
        masterEQ.gain.setValueAtTime(value, engine.audioContextManager.currentTime);
      } else if (param === 'frequency') {
        masterEQ.frequency.setValueAtTime(value, engine.audioContextManager.currentTime);
      }
    }
  }
  
  // --- Debug & Development ---
  static logEngineState() {
    const engine = this.getAudioEngine();
    if (engine) {
      console.log('🔊 Native Engine State:');
      console.log('  Instruments:', Array.from(engine.instruments.keys()));
      console.log('  Mixer Channels:', Array.from(engine.mixerChannels.keys()));
      console.log('  Stats:', engine.getEngineStats());
    }
  }
  
  static isNativeEngine() {
    const engine = this.getAudioEngine();
    return engine && typeof engine.getEngineStats === 'function';
  }
}