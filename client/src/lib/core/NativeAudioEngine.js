// src/lib/core/NativeAudioEngine.js - Zaman Aşımlı (Timeout) Yükleyici

import { NativeAudioContextManager } from './NativeAudioContextManager.js';
import { NativeTransportSystem } from './NativeTransportSystem.js';
import { WorkletManager } from '../audio/WorkletManager.js';
import { WorkletInstrument } from '../audio/WorkletInstrument.js';
import { useArrangementStore } from '../../store/useArrangementStore';

export class NativeAudioEngine {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.audioContextManager = null;
    this.transportSystem = null;
    this.workletManager = null;
    this.masterMixer = null;
    this.instruments = new Map();
    this.mixerChannels = new Map();
    this.effects = new Map();
    this.analysisNodes = new Map();
    this.isInitialized = false;
    this.masterVolume = 0.8;
    this.performanceMetrics = {
      instrumentsCreated: 0,
      effectsCreated: 0,
      audioLatency: 0,
      cpuLoad: 0,
      memoryUsage: 0
    };
    console.log('🚀 Native Audio Engine created');
  }

  async initialize() {
    try {
      console.log('🎵 Initializing Native Audio Engine...');
      console.log('🔧 Step 1: Audio Context Manager...');
      this.audioContextManager = new NativeAudioContextManager({
        sampleRate: 44100,
        latencyHint: 'interactive'
      });
      await this.audioContextManager.initialize();
      console.log('🔧 Step 2: Transport System...');
      this.transportSystem = new NativeTransportSystem(this.audioContextManager);
      this.transportSystem.onPositionChange = (positionInfo) => {
        this.callbacks.setTransportPosition?.(positionInfo.formatted, positionInfo.position);
      };
      this.transportSystem.onStateChange = (state) => {
        const playbackState = state.isPlaying ? 
          (state.isPaused ? 'paused' : 'playing') : 'stopped';
        this.callbacks.setPlaybackState?.(playbackState);
      };
      console.log('🔧 Step 3: WorkletManager...');
      this.workletManager = new WorkletManager(this.audioContextManager.context);
      console.log('🔧 Step 4: Loading WorkletProcessors...');
      await this.loadEssentialWorklets(); // Bu fonksiyonu güncelledik
      console.log('🔧 Step 5: Master Mixer...');
      this.setupMasterMixer();
      console.log('🔧 Step 6: Analysis Nodes...');
      this.setupAnalysisNodes();
      this.isInitialized = true;
      this.updatePerformanceMetrics();
      console.log('✅ Native Audio Engine initialized successfully');
      console.log('📊 Engine Stats:', this.getEngineStats());
      return true;
    } catch (error) {
      console.error('❌ Native Audio Engine initialization failed:', error);
      throw error;
    }
  }

  // ESKİ initialize() METODUNU BU YENİ METODLA DEĞİŞTİRİN
  async initializeWithContext(nativeAudioContext) {
    try {
      console.log('🎵 Native Audio Engine, hazır context ile kuruluyor...');

      // 1. Audio Context Manager'ı DIŞARIDAN GELEN CONTEXT ile oluştur
      console.log('🔧 Step 1: Audio Context Manager...');
      this.audioContextManager = new NativeAudioContextManager(nativeAudioContext);
      this.audioContextManager.initialize(); // Sadece kurulum yap, oluşturma

      // 2. Transport System'i kur
      console.log('🔧 Step 2: Transport System...');
      this.transportSystem = new NativeTransportSystem(this.audioContextManager);
      // ... (transport callback'leri aynı kalabilir) ...

      // 3. WorkletManager'ı DIŞARIDAN GELEN CONTEXT ile oluştur
      console.log('🔧 Step 3: WorkletManager...');
      this.workletManager = new WorkletManager(this.audioContextManager.context);

      // ... (geri kalan adımlar (4, 5, 6) ve fonksiyonun sonu aynı kalabilir) ...
      console.log('🔧 Step 4: Loading WorkletProcessors...');
      await this.loadEssentialWorklets(); // Bu fonksiyonu güncelledik
      console.log('🔧 Step 5: Master Mixer...');
      this.setupMasterMixer();
      console.log('🔧 Step 6: Analysis Nodes...');
      this.setupAnalysisNodes();
      this.isInitialized = true;
      this.updatePerformanceMetrics();
      console.log('✅ Native Audio Engine initialized successfully');
      
      return true;

    } catch (error) {
      console.error('❌ Native Audio Engine initialization failed:', error);
      throw error;
    }
  }


  // --- YENİ VE DAHA SAĞLAM YÜKLEYİCİ FONKSİYON ---
  async loadEssentialWorklets() {
    const workletsToLoad = [
      { path: '/worklets/instrument-processor.js', name: 'instrument-processor' },
      { path: '/worklets/effects-processor.js', name: 'effects-processor' },
      { path: '/worklets/mixer-processor.js', name: 'mixer-processor' },
      { path: '/worklets/analysis-processor.js', name: 'analysis-processor' }
    ];

    const promises = workletsToLoad.map(worklet => 
      this.workletManager.loadWorklet(worklet.path, worklet.name)
    );

    // Zaman aşımı (timeout) ile Promise.all'u sarmalıyoruz
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Worklet yüklemesi 10 saniye içinde zaman aşımına uğradı. Dosyaların public/worklets klasöründe olduğundan emin misiniz?')), 10000)
    );

    const results = await Promise.race([
        Promise.allSettled(promises),
        timeoutPromise
    ]);

    if (!Array.isArray(results)) {
        // Bu, timeout'un tetiklendiği anlamına gelir
        throw new Error("Worklet yüklemesi zaman aşımına uğradı.");
    }
    
    const failedWorklets = results.filter(r => r.status === 'rejected');
    if (failedWorklets.length > 0) {
      const errorDetails = failedWorklets.map(f => f.reason.message).join(', ');
      throw new Error(`Bazı worklet'ler yüklenemedi: ${errorDetails}`);
    }

    const successCount = results.length - failedWorklets.length;
    console.log(`✅ ${successCount}/${results.length} worklets loaded successfully`);
  }

  // ... (dosyanın geri kalanında değişiklik yok, olduğu gibi bırakabilirsiniz) ...
  setupMasterMixer() {
    const context = this.audioContextManager.context;
    
    // Master mixer chain
    this.masterMixer = {
      input: context.createGain(),
      compressor: context.createDynamicsCompressor(),
      eq: {
        low: context.createBiquadFilter(),
        mid: context.createBiquadFilter(),
        high: context.createBiquadFilter()
      },
      limiter: context.createDynamicsCompressor(),
      output: this.audioContextManager.masterGain
    };

    // Setup master compressor
    this.masterMixer.compressor.threshold.value = -12;
    this.masterMixer.compressor.knee.value = 30;
    this.masterMixer.compressor.ratio.value = 3;
    this.masterMixer.compressor.attack.value = 0.003;
    this.masterMixer.compressor.release.value = 0.25;

    // Setup master EQ
    this.masterMixer.eq.low.type = 'lowshelf';
    this.masterMixer.eq.low.frequency.value = 320;
    this.masterMixer.eq.low.gain.value = 0;

    this.masterMixer.eq.mid.type = 'peaking';
    this.masterMixer.eq.mid.frequency.value = 1000;
    this.masterMixer.eq.mid.Q.value = 1;
    this.masterMixer.eq.mid.gain.value = 0;

    this.masterMixer.eq.high.type = 'highshelf';
    this.masterMixer.eq.high.frequency.value = 3200;
    this.masterMixer.eq.high.gain.value = 0;

    // Setup master limiter
    this.masterMixer.limiter.threshold.value = -1;
    this.masterMixer.limiter.knee.value = 0;
    this.masterMixer.limiter.ratio.value = 20;
    this.masterMixer.limiter.attack.value = 0.001;
    this.masterMixer.limiter.release.value = 0.01;

    // Connect master chain
    this.masterMixer.input
      .connect(this.masterMixer.compressor)
      .connect(this.masterMixer.eq.low)
      .connect(this.masterMixer.eq.mid)
      .connect(this.masterMixer.eq.high)
      .connect(this.masterMixer.limiter)
      .connect(this.masterMixer.output);

    console.log('✅ Master mixer chain established');
  }

  setupAnalysisNodes() {
    const context = this.audioContextManager.context;
    
    // Master spectrum analyzer
    this.analysisNodes.set('master-spectrum', {
      node: context.createAnalyser(),
      type: 'spectrum',
      fftSize: 2048
    });

    // Master waveform analyzer  
    this.analysisNodes.set('master-waveform', {
      node: context.createAnalyser(),
      type: 'waveform',
      fftSize: 1024
    });

    // Connect to master mixer output
    const spectrumNode = this.analysisNodes.get('master-spectrum').node;
    const waveformNode = this.analysisNodes.get('master-waveform').node;
    
    spectrumNode.fftSize = 2048;
    spectrumNode.smoothingTimeConstant = 0.3;
    
    waveformNode.fftSize = 1024;
    waveformNode.smoothingTimeConstant = 0.8;

    // Connect analyzers
    this.masterMixer.output.connect(spectrumNode);
    this.masterMixer.output.connect(waveformNode);

    console.log('✅ Analysis nodes setup complete');
  }

  // Instrument management
  async createInstrument(instrumentData) {
    try {
      console.log(`🎹 Creating native instrument: ${instrumentData.name}`);

      // Create WorkletInstrument
      const workletInst = new WorkletInstrument(instrumentData, this.workletManager);
      await workletInst.initialize();

      // Create mixer channel for this instrument
      const mixerChannel = this.createMixerChannel(instrumentData.id);
      
      // Connect instrument to its mixer channel
      workletInst.outputGain.connect(mixerChannel.input);
      
      // Connect mixer channel to master mixer
      mixerChannel.output.connect(this.masterMixer.input);

      // Store references
      this.instruments.set(instrumentData.id, {
        workletInst,
        mixerChannel,
        instrumentData
      });

      this.performanceMetrics.instrumentsCreated++;
      console.log(`✅ Native instrument created: ${instrumentData.name}`);

      return workletInst;

    } catch (error) {
      console.error(`❌ Failed to create native instrument: ${instrumentData.name}`, error);
      throw error;
    }
  }

  createMixerChannel(channelId) {
    const context = this.audioContextManager.context;
    
    const mixerChannel = {
      id: channelId,
      input: context.createGain(),
      volume: context.createGain(),
      pan: context.createStereoPanner(),
      eq: {
        low: context.createBiquadFilter(),
        mid: context.createBiquadFilter(),
        high: context.createBiquadFilter()
      },
      compressor: context.createDynamicsCompressor(),
      mute: context.createGain(),
      solo: context.createGain(),
      output: context.createGain(),
      
      // Analysis
      meter: context.createAnalyser(),
      
      // State
      isMuted: false,
      isSoloed: false,
      volumeLevel: 0.8,
      panPosition: 0
    };

    // Setup EQ
    mixerChannel.eq.low.type = 'lowshelf';
    mixerChannel.eq.low.frequency.value = 250;
    mixerChannel.eq.low.gain.value = 0;

    mixerChannel.eq.mid.type = 'peaking';
    mixerChannel.eq.mid.frequency.value = 1000;
    mixerChannel.eq.mid.Q.value = 1;
    mixerChannel.eq.mid.gain.value = 0;

    mixerChannel.eq.high.type = 'highshelf';
    mixerChannel.eq.high.frequency.value = 4000;
    mixerChannel.eq.high.gain.value = 0;

    // Setup compressor
    mixerChannel.compressor.threshold.value = -18;
    mixerChannel.compressor.knee.value = 2;
    mixerChannel.compressor.ratio.value = 3;
    mixerChannel.compressor.attack.value = 0.005;
    mixerChannel.compressor.release.value = 0.15;

    // Setup meter
    mixerChannel.meter.fftSize = 256;
    mixerChannel.meter.smoothingTimeConstant = 0.3;

    // Initial values
    mixerChannel.volume.gain.value = mixerChannel.volumeLevel;
    mixerChannel.pan.pan.value = mixerChannel.panPosition;
    mixerChannel.mute.gain.value = 1;
    mixerChannel.solo.gain.value = 1;

    // Connect channel chain
    mixerChannel.input
      .connect(mixerChannel.volume)
      .connect(mixerChannel.pan)
      .connect(mixerChannel.eq.low)
      .connect(mixerChannel.eq.mid)
      .connect(mixerChannel.eq.high)
      .connect(mixerChannel.compressor)
      .connect(mixerChannel.mute)
      .connect(mixerChannel.solo)
      .connect(mixerChannel.output);

    // Connect meter
    mixerChannel.output.connect(mixerChannel.meter);

    this.mixerChannels.set(channelId, mixerChannel);
    
    console.log(`🎛️ Mixer channel created: ${channelId}`);
    return mixerChannel;
  }

  // --- YENİ FONKSİYON: RESCHEDULE ---
  reschedule() {
    if (!this.isInitialized || !this.transportSystem) return;

    console.log('%c[RESCHEDULE] Notalar yeniden zamanlanıyor...', 'color: lightblue;');

    const { patterns, activePatternId } = useArrangementStore.getState();
    const activePattern = patterns[activePatternId];

    if (!activePattern) {
        console.warn('⚠️ Reschedule: Aktif pattern bulunamadı.');
        this.transportSystem.clearScheduledEvents(); // Mevcut zamanlamayı temizle
        return;
    }

    // Transport sistemine, hangi enstrümanın hangi notayı ne zaman çalacağını söyleyen
    // bir callback fonksiyonu iletiyoruz.
    this.transportSystem.schedulePattern(activePattern.data, (instrumentId, note, time) => {
      const instrument = this.instruments.get(instrumentId);
      if (instrument) {
        // Worklet'e çalma komutunu gönder
        instrument.workletInst.triggerNote(note.pitch, note.velocity, time, note.duration);
      }
    });
  }

  // Transport controls
  play(startStep = 0) {
    // Çalmaya başlamadan ÖNCE notaları zamanla
    this.reschedule();
    this.transportSystem.start(startStep);
  }

  pause() {
    this.transportSystem.pause();
    console.log('⏸️ Playback paused');
  }

  resume() {
    this.transportSystem.resume();
    console.log('▶️ Playback resumed');
  }

  stop() {
    this.transportSystem.stop();
    console.log('⏹️ Playback stopped');
  }

  setBPM(bpm) {
    this.transportSystem.setBPM(bpm);
  }

  setLoop(startStep, endStep) {
    this.transportSystem.setLoop(startStep, endStep);
  }

  jumpToStep(step) {
    this.transportSystem.jumpTo(step);
  }

  jumpToBar(bar) {
    this.transportSystem.jumpToBar(bar);
  }

  // Pattern scheduling
  schedulePattern(patternData) {
    this.transportSystem.schedulePattern(patternData, (instrumentId, note, time) => {
      const instrument = this.instruments.get(instrumentId);
      if (instrument) {
        instrument.workletInst.triggerNote(note.pitch, note.velocity, time, note.duration);
      }
    });
    
    console.log(`📋 Pattern scheduled with ${Object.keys(patternData).length} instruments`);
  }

  // Audio controls
  auditionNoteOn(instrumentId, pitch, velocity) {
    const instrument = this.instruments.get(instrumentId);
    if (instrument) {
      instrument.workletInst.triggerNote(pitch, velocity);
      console.log(`🎵 Note ON: ${instrumentId} - ${pitch} @ ${velocity}`);
    }
  }

  auditionNoteOff(instrumentId, pitch) {
    const instrument = this.instruments.get(instrumentId);
    if (instrument) {
      instrument.workletInst.releaseNote(pitch);
      console.log(`🎵 Note OFF: ${instrumentId} - ${pitch}`);
    }
  }

  // Mixer controls
  setChannelVolume(channelId, volume) {
    const channel = this.mixerChannels.get(channelId);
    if (channel) {
      channel.volumeLevel = Math.max(0, Math.min(2, volume));
      channel.volume.gain.exponentialRampToValueAtTime(
        channel.volumeLevel || 0.001,
        this.audioContextManager.currentTime + 0.02
      );
    }
  }

  setChannelPan(channelId, pan) {
    const channel = this.mixerChannels.get(channelId);
    if (channel) {
      channel.panPosition = Math.max(-1, Math.min(1, pan));
      channel.pan.pan.setValueAtTime(
        channel.panPosition,
        this.audioContextManager.currentTime
      );
    }
  }

  setChannelMute(channelId, muted) {
    const channel = this.mixerChannels.get(channelId);
    if (channel) {
      channel.isMuted = muted;
      channel.mute.gain.exponentialRampToValueAtTime(
        muted ? 0.001 : 1,
        this.audioContextManager.currentTime + 0.02
      );
    }
  }

  setChannelEQ(channelId, band, frequency, gain, q) {
    const channel = this.mixerChannels.get(channelId);
    if (channel && channel.eq[band]) {
      const eqBand = channel.eq[band];
      eqBand.frequency.setValueAtTime(frequency, this.audioContextManager.currentTime);
      eqBand.gain.setValueAtTime(gain, this.audioContextManager.currentTime);
      if (q !== undefined) {
        eqBand.Q.setValueAtTime(q, this.audioContextManager.currentTime);
      }
    }
  }

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(2, volume));
    this.audioContextManager.setMasterVolume(this.masterVolume);
  }

  // Analysis data
  getAnalysisData(nodeId) {
    const analysisNode = this.analysisNodes.get(nodeId);
    if (!analysisNode) return null;

    const analyzer = analysisNode.node;
    
    if (analysisNode.type === 'spectrum') {
      const frequencyData = new Uint8Array(analyzer.frequencyBinCount);
      analyzer.getByteFrequencyData(frequencyData);
      return frequencyData;
    } else if (analysisNode.type === 'waveform') {
      const waveformData = new Uint8Array(analyzer.fftSize);
      analyzer.getByteTimeDomainData(waveformData);
      return waveformData;
    }

    return null;
  }

  getChannelMeterData(channelId) {
    const channel = this.mixerChannels.get(channelId);
    if (!channel) return null;

    const meterData = new Uint8Array(channel.meter.frequencyBinCount);
    channel.meter.getByteFrequencyData(meterData);
    
    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < meterData.length; i++) {
      sum += meterData[i] * meterData[i];
    }
    const rms = Math.sqrt(sum / meterData.length) / 255;

    return {
      rms,
      peak: Math.max(...meterData) / 255,
      spectrum: meterData
    };
  }

  // Performance monitoring
  updatePerformanceMetrics() {
    this.performanceMetrics = {
      ...this.performanceMetrics,
      audioLatency: this.audioContextManager.getStats().totalLatency,
      instrumentCount: this.instruments.size,
      mixerChannelCount: this.mixerChannels.size,
      effectCount: this.effects.size,
      contextState: this.audioContextManager.context?.state || 'unknown'
    };
  }

  getEngineStats() {
    this.updatePerformanceMetrics();
    return {
      isInitialized: this.isInitialized,
      audioContext: this.audioContextManager.getStats(),
      transport: this.transportSystem.getStats(),
      worklets: this.workletManager.getStats(),
      performance: this.performanceMetrics
    };
  }

  // Cleanup
  dispose() {
    console.log('🗑️ Disposing Native Audio Engine...');

    // Stop transport
    if (this.transportSystem) {
      this.transportSystem.dispose();
    }

    // Dispose instruments
    this.instruments.forEach((instrument, id) => {
      try {
        instrument.workletInst.dispose();
      } catch (error) {
        console.error(`❌ Error disposing instrument ${id}:`, error);
      }
    });
    this.instruments.clear();

    // Dispose mixer channels
    this.mixerChannels.forEach((channel, id) => {
      try {
        channel.input.disconnect();
        channel.output.disconnect();
        // Disconnect all nodes in the channel
        Object.values(channel).forEach(node => {
          if (node && typeof node.disconnect === 'function') {
            node.disconnect();
          }
        });
      } catch (error) {
        console.error(`❌ Error disposing mixer channel ${id}:`, error);
      }
    });
    this.mixerChannels.clear();

    // Dispose analysis nodes
    this.analysisNodes.forEach((analysis, id) => {
      try {
        analysis.node.disconnect();
      } catch (error) {
        console.error(`❌ Error disposing analysis node ${id}:`, error);
      }
    });
    this.analysisNodes.clear();

    // Dispose worklet manager
    if (this.workletManager) {
      this.workletManager.disposeAllNodes();
    }

    // Dispose audio context manager
    if (this.audioContextManager) {
      this.audioContextManager.dispose();
    }

    this.isInitialized = false;
    console.log('✅ Native Audio Engine disposed');
  }
}