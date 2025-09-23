// client/src/lib/core/NativeAudioContextManager.js
export class NativeAudioContextManager {
  constructor(nativeAudioContext) {
    if (!nativeAudioContext || !(nativeAudioContext instanceof AudioContext)) {
      throw new Error("NativeAudioContextManager geçerli bir AudioContext gerektirir.");
    }

    this.context = nativeAudioContext;
    this.isReady = false;
    this.masterGain = null;
    this.analyzerNode = null;
    this.options = { bufferSize: 256 }; // Varsayılan options'ı burada set ediyoruz.

    this.stats = { contextState: 'suspended' };
    this.onStateChange = null;

    console.log("✅ NativeAudioContextManager hazır bir context ile başlatıldı.");
  }

  // initialize fonksiyonu artık context oluşturmuyor, sadece kurulum yapıyor.
  initialize() {
    console.log('🎵 Mevcut Audio Context üzerinde kurulum yapılıyor...');
    
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.context.destination);

    this.analyzerNode = this.context.createAnalyser();
    this.analyzerNode.fftSize = 2048;
    this.masterGain.connect(this.analyzerNode);

    this.setupEventListeners();
    this.updateStats();

    if (this.context.state === 'running') {
      this.isReady = true;
    }
    
    console.log('✅ Native Audio Context Manager kurulumu tamamlandı.');
  }

  async resume() {
    if (!this.context) return false;

    try {
      if (this.context.state === 'suspended') {
        await this.context.resume();
        console.log('▶️ Audio context resumed');
      }
      
      this.isReady = true;
      this.updateStats();
      return true;
    } catch (error) {
      console.error('❌ Failed to resume audio context:', error);
      return false;
    }
  }

  async suspend() {
    if (!this.context) return;

    try {
      await this.context.suspend();
      this.isReady = false;
      console.log('⏸️ Audio context suspended');
    } catch (error) {
      console.error('❌ Failed to suspend audio context:', error);
    }
  }

  async close() {
    if (!this.context) return;

    try {
      await this.context.close();
      this.isReady = false;
      this.context = null;
      console.log('🔌 Audio context closed');
    } catch (error) {
      console.error('❌ Failed to close audio context:', error);
    }
  }

  // Master volume control
  setMasterVolume(volume) {
    if (this.masterGain) {
      const clampedVolume = Math.max(0, Math.min(2, volume));
      this.masterGain.gain.exponentialRampToValueAtTime(
        clampedVolume || 0.001, // Prevent 0 for exponential ramp
        this.context.currentTime + 0.02
      );
    }
  }

  getMasterVolume() {
    return this.masterGain ? this.masterGain.gain.value : 0;
  }

  // Audio graph utilities
  createGain(value = 1) {
    const gain = this.context.createGain();
    gain.gain.value = value;
    return gain;
  }

  createDelay(maxDelayTime = 1) {
    return this.context.createDelay(maxDelayTime);
  }

  createBiquadFilter(type = 'lowpass', frequency = 1000, Q = 1) {
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = Q;
    return filter;
  }

  createConvolver() {
    return this.context.createConvolver();
  }

  createDynamicsCompressor() {
    return this.context.createDynamicsCompressor();
  }

  createPanner() {
    return this.context.createPanner();
  }

  createStereoPanner() {
    return this.context.createStereoPanner();
  }

  createAnalyser(fftSize = 2048) {
    const analyser = this.context.createAnalyser();
    analyser.fftSize = fftSize;
    return analyser;
  }

  // Buffer utilities
  createBuffer(numberOfChannels, length, sampleRate) {
    return this.context.createBuffer(
      numberOfChannels, 
      length, 
      sampleRate || this.context.sampleRate
    );
  }

  async decodeAudioData(arrayBuffer) {
    return await this.context.decodeAudioData(arrayBuffer);
  }

  // Time utilities
  get currentTime() {
    return this.context ? this.context.currentTime : 0;
  }

  // Performance monitoring
  updateStats() {
    if (!this.context) return;

    this.stats = {
      contextState: this.context.state,
      actualSampleRate: this.context.sampleRate,
      baseLatency: this.context.baseLatency * 1000, // ms
      outputLatency: this.context.outputLatency * 1000, // ms
      totalLatency: (this.context.baseLatency + this.context.outputLatency) * 1000, // ms
      bufferSize: this.options.bufferSize
    };

    if (this.onLatencyChange) {
      this.onLatencyChange(this.stats);
    }
  }

  getStats() {
    this.updateStats();
    return { ...this.stats };
  }

  // Event handling
  setupEventListeners() {
    if (!this.context) return;

    this.context.addEventListener('statechange', () => {
      console.log(`🔄 Audio context state changed: ${this.context.state}`);
      this.updateStats();
      
      if (this.context.state === 'running') {
        this.isReady = true;
      } else if (this.context.state === 'suspended') {
        this.isReady = false;
      }

      if (this.onStateChange) {
        this.onStateChange(this.context.state);
      }
    });
  }

  // Browser detection
  isIOSSafari() {
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua);
    const webkit = /WebKit/.test(ua);
    const chrome = /CriOS|Chrome/.test(ua);
    return iOS && webkit && !chrome;
  }

  isChrome() {
    return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  }

  isFirefox() {
    return navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  }

  // Audio worklet utilities
  async loadAudioWorklet(modulePath, processorName) {
    if (!this.context) {
      throw new Error('Audio context not initialized');
    }

    try {
      await this.context.audioWorklet.addModule(modulePath);
      console.log(`✅ AudioWorklet loaded: ${processorName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to load AudioWorklet: ${processorName}`, error);
      throw error;
    }
  }

  createAudioWorkletNode(processorName, options = {}) {
    if (!this.context) {
      throw new Error('Audio context not initialized');
    }

    return new AudioWorkletNode(this.context, processorName, {
      numberOfInputs: options.numberOfInputs || 1,
      numberOfOutputs: options.numberOfOutputs || 1,
      outputChannelCount: options.outputChannelCount || [2],
      processorOptions: options.processorOptions || {},
      ...options
    });
  }

  // Advanced features
  async optimizeForLowLatency() {
    if (!this.context) return false;

    try {
      // Minimum buffer size için context'i yeniden oluştur
      const currentState = this.context.state;
      
      if (currentState === 'running') {
        await this.suspend();
      }

      // Yeni context düşük latency ile
      const newContextOptions = {
        ...this.options,
        latencyHint: 'interactive',
        bufferSize: 128 // Minimum buffer size
      };

      await this.close();
      this.options = newContextOptions;
      await this.initialize();
      
      if (currentState === 'running') {
        await this.resume();
      }

      console.log('🚀 Audio context optimized for low latency');
      return true;

    } catch (error) {
      console.error('❌ Failed to optimize for low latency:', error);
      return false;
    }
  }

  // Debug utilities
  logAudioGraph() {
    console.log('🔊 Audio Graph Info:');
    console.log('  Context:', this.context);
    console.log('  Master Gain:', this.masterGain);
    console.log('  Analyzer:', this.analyzerNode);
    console.log('  Stats:', this.getStats());
  }

  // Memory management
  dispose() {
    if (this.analyzerNode) {
      this.analyzerNode.disconnect();
      this.analyzerNode = null;
    }

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }

    this.close();
    
    console.log('🗑️ Native Audio Context Manager disposed');
  }
}