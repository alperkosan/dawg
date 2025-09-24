// Dynamic Audio Quality Configuration System
// Adapts audio settings based on machine capabilities and user preferences

export const AUDIO_QUALITY_PRESETS = {
  'maximum-performance': {
    name: 'Maximum Performance',
    description: 'Lowest CPU usage, highest compatibility',
    settings: {
      sampleRate: 44100,
      latencyHint: 'playback',
      bufferSize: 1024,
      maxPolyphony: 16,
      workletPoolSize: 2,
      enableRealTimeEffects: false,
      enableHighQualityResampling: false,
      mixerChannels: 8,
      performanceUpdateInterval: 2000,
      enablePerformanceMonitoring: false,
      audioWorkletFallback: true
    },
    requirements: {
      minCPUCores: 1,
      minRAM: 2, // GB
      browserMinScore: 50
    }
  },

  'balanced': {
    name: 'Balanced',
    description: 'Good quality with reasonable performance',
    settings: {
      sampleRate: 48000,
      latencyHint: 'interactive',
      bufferSize: 512,
      maxPolyphony: 24,
      workletPoolSize: 4,
      enableRealTimeEffects: true,
      enableHighQualityResampling: false,
      mixerChannels: 16,
      performanceUpdateInterval: 1000,
      enablePerformanceMonitoring: true,
      audioWorkletFallback: true
    },
    requirements: {
      minCPUCores: 2,
      minRAM: 4,
      browserMinScore: 70
    }
  },

  'high-quality': {
    name: 'High Quality',
    description: 'Professional quality for production work',
    settings: {
      sampleRate: 48000,
      latencyHint: 'interactive',
      bufferSize: 256,
      maxPolyphony: 32,
      workletPoolSize: 6,
      enableRealTimeEffects: true,
      enableHighQualityResampling: true,
      mixerChannels: 32,
      performanceUpdateInterval: 500,
      enablePerformanceMonitoring: true,
      audioWorkletFallback: false
    },
    requirements: {
      minCPUCores: 4,
      minRAM: 8,
      browserMinScore: 85
    }
  },

  'ultra': {
    name: 'Ultra Quality',
    description: 'Maximum quality for high-end systems',
    settings: {
      sampleRate: 96000,
      latencyHint: 'interactive',
      bufferSize: 128,
      maxPolyphony: 64,
      workletPoolSize: 8,
      enableRealTimeEffects: true,
      enableHighQualityResampling: true,
      mixerChannels: 64,
      performanceUpdateInterval: 250,
      enablePerformanceMonitoring: true,
      audioWorkletFallback: false
    },
    requirements: {
      minCPUCores: 8,
      minRAM: 16,
      browserMinScore: 95
    }
  },

  'custom': {
    name: 'Custom',
    description: 'User-defined settings',
    settings: {
      // Will be populated by user selections
    },
    requirements: {
      minCPUCores: 1,
      minRAM: 2,
      browserMinScore: 50
    }
  }
};

// Performance impact factors for each setting
export const PERFORMANCE_IMPACT = {
  sampleRate: {
    44100: { cpu: 1.0, memory: 1.0, quality: 0.8 },
    48000: { cpu: 1.1, memory: 1.1, quality: 1.0 },
    88200: { cpu: 2.0, memory: 2.0, quality: 1.1 },
    96000: { cpu: 2.2, memory: 2.2, quality: 1.15 },
    176400: { cpu: 4.0, memory: 4.0, quality: 1.2 },
    192000: { cpu: 4.4, memory: 4.4, quality: 1.25 }
  },

  bufferSize: {
    64: { cpu: 1.8, latency: 0.3, stability: 0.6 },
    128: { cpu: 1.4, latency: 0.5, stability: 0.8 },
    256: { cpu: 1.0, latency: 1.0, stability: 1.0 },
    512: { cpu: 0.7, latency: 2.0, stability: 1.2 },
    1024: { cpu: 0.5, latency: 4.0, stability: 1.4 },
    2048: { cpu: 0.3, latency: 8.0, stability: 1.6 }
  },

  maxPolyphony: {
    8: { cpu: 0.3, memory: 0.4 },
    16: { cpu: 0.6, memory: 0.7 },
    24: { cpu: 0.8, memory: 0.9 },
    32: { cpu: 1.0, memory: 1.0 },
    48: { cpu: 1.5, memory: 1.4 },
    64: { cpu: 2.0, memory: 1.8 },
    128: { cpu: 4.0, memory: 3.5 }
  }
};

// Machine capability detection
export class MachineCapabilityDetector {
  constructor() {
    this.capabilities = null;
  }

  async detectCapabilities() {
    console.log('🔍 Detecting machine capabilities...');

    const capabilities = {
      // CPU Information
      cpu: await this.detectCPUInfo(),

      // Memory Information
      memory: await this.detectMemoryInfo(),

      // Browser Performance Score
      browserScore: await this.benchmarkBrowser(),

      // Audio System Capabilities
      audioSystem: await this.detectAudioCapabilities(),

      // Network & Storage
      storage: await this.detectStorageCapabilities(),

      // Overall Performance Score
      overallScore: 0
    };

    // Calculate overall score
    capabilities.overallScore = this.calculateOverallScore(capabilities);

    this.capabilities = capabilities;
    console.log('✅ Machine capabilities detected:', capabilities);

    return capabilities;
  }

  async detectCPUInfo() {
    const cpuInfo = {
      cores: navigator.hardwareConcurrency || 4,
      architecture: 'unknown',
      estimated: true
    };

    // Estimate CPU performance with a micro-benchmark
    const startTime = performance.now();
    let iterations = 0;
    const targetTime = 10; // 10ms benchmark

    while ((performance.now() - startTime) < targetTime) {
      Math.random() * Math.random();
      iterations++;
    }

    cpuInfo.performanceScore = iterations / 1000;

    return cpuInfo;
  }

  async detectMemoryInfo() {
    const memInfo = {
      deviceMemory: navigator.deviceMemory || 4, // GB
      jsHeapSizeLimit: 0,
      estimated: !navigator.deviceMemory
    };

    // Get JavaScript heap info if available
    if (performance.memory) {
      memInfo.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit / (1024 * 1024 * 1024); // Convert to GB
      memInfo.usedJSHeapSize = performance.memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }

    return memInfo;
  }

  async benchmarkBrowser() {
    console.log('🚀 Running browser performance benchmark...');

    const benchmarks = {
      jsPerformance: await this.benchmarkJavaScript(),
      audioPerformance: await this.benchmarkAudioAPI(),
      renderPerformance: await this.benchmarkRendering()
    };

    // Calculate weighted score (0-100)
    const score = (
      benchmarks.jsPerformance * 0.4 +
      benchmarks.audioPerformance * 0.4 +
      benchmarks.renderPerformance * 0.2
    );

    return Math.min(100, Math.max(0, score));
  }

  async benchmarkJavaScript() {
    const start = performance.now();

    // CPU-intensive operations
    for (let i = 0; i < 100000; i++) {
      Math.sin(i) * Math.cos(i) + Math.sqrt(i);
    }

    const jsTime = performance.now() - start;

    // Score: lower time = higher score
    return Math.max(0, 100 - jsTime * 2);
  }

  async benchmarkAudioAPI() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const tempContext = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 48000
      });

      const score = {
        contextCreation: 20,
        sampleRate: tempContext.sampleRate >= 48000 ? 20 : 10,
        baseLatency: tempContext.baseLatency < 0.01 ? 20 : tempContext.baseLatency < 0.02 ? 15 : 10,
        audioWorkletSupport: 'audioWorklet' in tempContext ? 20 : 0,
        webAudioSupport: 20
      };

      await tempContext.close();

      return Object.values(score).reduce((sum, val) => sum + val, 0);
    } catch (error) {
      console.warn('Audio benchmark failed:', error);
      return 30; // Fallback score
    }
  }

  async benchmarkRendering() {
    // Simple canvas rendering benchmark
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      ctx.fillStyle = `hsl(${i % 360}, 50%, 50%)`;
      ctx.fillRect(Math.random() * 100, Math.random() * 100, 10, 10);
    }

    const renderTime = performance.now() - start;

    return Math.max(0, 100 - renderTime);
  }

  async detectAudioCapabilities() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const testContext = new AudioContext();

      const capabilities = {
        maxSampleRate: testContext.sampleRate,
        baseLatency: testContext.baseLatency,
        audioWorkletSupported: 'audioWorklet' in testContext,
        webAudioSupported: true,
        mediaDevicesSupported: 'mediaDevices' in navigator,
        estimatedMaxPolyphony: this.estimateMaxPolyphony(testContext)
      };

      await testContext.close();
      return capabilities;

    } catch (error) {
      console.warn('Audio capability detection failed:', error);
      return {
        maxSampleRate: 44100,
        baseLatency: 0.02,
        audioWorkletSupported: false,
        webAudioSupported: false,
        mediaDevicesSupported: false,
        estimatedMaxPolyphony: 8
      };
    }
  }

  estimateMaxPolyphony(audioContext) {
    const cpuCores = navigator.hardwareConcurrency || 4;
    const sampleRate = audioContext.sampleRate;

    // Rough estimation based on CPU cores and sample rate
    let basePolyphony = cpuCores * 8;

    // Adjust for sample rate
    if (sampleRate > 48000) basePolyphony *= 0.7;
    if (sampleRate > 96000) basePolyphony *= 0.5;

    return Math.min(128, Math.max(8, Math.round(basePolyphony)));
  }

  async detectStorageCapabilities() {
    const storage = {
      persistent: false,
      quota: 0,
      indexedDBSupported: 'indexedDB' in window
    };

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        storage.quota = estimate.quota || 0;
        storage.usage = estimate.usage || 0;
        storage.persistent = await navigator.storage.persist();
      } catch (error) {
        console.warn('Storage detection failed:', error);
      }
    }

    return storage;
  }

  calculateOverallScore(capabilities) {
    const weights = {
      cpu: 0.3,
      memory: 0.2,
      browserScore: 0.3,
      audioSystem: 0.2
    };

    const scores = {
      cpu: Math.min(100, capabilities.cpu.cores * 15 + capabilities.cpu.performanceScore * 10),
      memory: Math.min(100, capabilities.memory.deviceMemory * 12.5),
      browserScore: capabilities.browserScore,
      audioSystem: capabilities.audioSystem.audioWorkletSupported ? 80 :
                  capabilities.audioSystem.webAudioSupported ? 60 : 30
    };

    return Object.entries(weights).reduce((total, [key, weight]) => {
      return total + (scores[key] * weight);
    }, 0);
  }
}

// Quality configuration manager
export class AudioQualityManager {
  constructor() {
    this.currentPreset = 'balanced';
    this.customSettings = {};
    this.machineCapabilities = null;
    this.detector = new MachineCapabilityDetector();
  }

  async initialize() {
    console.log('🎛️ Initializing Audio Quality Manager...');

    // Detect machine capabilities
    this.machineCapabilities = await this.detector.detectCapabilities();

    // Auto-select best preset based on capabilities
    this.currentPreset = this.recommendPreset(this.machineCapabilities);

    console.log(`🎯 Recommended preset: ${this.currentPreset}`);

    return {
      capabilities: this.machineCapabilities,
      recommendedPreset: this.currentPreset,
      settings: this.getCurrentSettings()
    };
  }

  recommendPreset(capabilities) {
    if (capabilities.overallScore >= 90) return 'ultra';
    if (capabilities.overallScore >= 75) return 'high-quality';
    if (capabilities.overallScore >= 60) return 'balanced';
    return 'maximum-performance';
  }

  getCurrentSettings() {
    if (this.currentPreset === 'custom') {
      return { ...AUDIO_QUALITY_PRESETS.balanced.settings, ...this.customSettings };
    }
    return AUDIO_QUALITY_PRESETS[this.currentPreset].settings;
  }

  setPreset(presetName) {
    if (!AUDIO_QUALITY_PRESETS[presetName]) {
      throw new Error(`Unknown preset: ${presetName}`);
    }

    this.currentPreset = presetName;
    console.log(`🎛️ Audio preset changed to: ${presetName}`);

    return this.getCurrentSettings();
  }

  updateCustomSetting(key, value) {
    this.customSettings[key] = value;
    if (this.currentPreset !== 'custom') {
      this.currentPreset = 'custom';
    }

    console.log(`🔧 Custom setting updated: ${key} = ${value}`);

    return this.getCurrentSettings();
  }

  calculatePerformanceImpact(settings = null) {
    settings = settings || this.getCurrentSettings();

    const impact = {
      cpu: 1.0,
      memory: 1.0,
      latency: 1.0,
      quality: 1.0
    };

    // Sample rate impact
    if (PERFORMANCE_IMPACT.sampleRate[settings.sampleRate]) {
      const srImpact = PERFORMANCE_IMPACT.sampleRate[settings.sampleRate];
      impact.cpu *= srImpact.cpu;
      impact.memory *= srImpact.memory;
      impact.quality *= srImpact.quality;
    }

    // Buffer size impact
    if (PERFORMANCE_IMPACT.bufferSize[settings.bufferSize]) {
      const bufImpact = PERFORMANCE_IMPACT.bufferSize[settings.bufferSize];
      impact.cpu *= bufImpact.cpu;
      impact.latency *= bufImpact.latency;
    }

    // Polyphony impact
    if (PERFORMANCE_IMPACT.maxPolyphony[settings.maxPolyphony]) {
      const polyImpact = PERFORMANCE_IMPACT.maxPolyphony[settings.maxPolyphony];
      impact.cpu *= polyImpact.cpu;
      impact.memory *= polyImpact.memory;
    }

    return impact;
  }

  validateSettings(settings) {
    const validation = {
      valid: true,
      warnings: [],
      errors: []
    };

    // Check if machine can handle these settings
    if (this.machineCapabilities) {
      const impact = this.calculatePerformanceImpact(settings);
      const caps = this.machineCapabilities;

      // CPU warnings
      if (impact.cpu > 2.0 && caps.cpu.cores < 4) {
        validation.warnings.push('High CPU usage expected with current settings');
      }

      if (impact.cpu > 3.0 && caps.cpu.cores < 8) {
        validation.errors.push('Settings may cause audio dropouts on this system');
        validation.valid = false;
      }

      // Memory warnings
      if (impact.memory > 2.0 && caps.memory.deviceMemory < 8) {
        validation.warnings.push('High memory usage expected');
      }

      // Browser compatibility
      if (settings.sampleRate > 48000 && caps.browserScore < 80) {
        validation.warnings.push('High sample rates may not be stable in this browser');
      }

      if (!caps.audioSystem.audioWorkletSupported && !settings.audioWorkletFallback) {
        validation.errors.push('Audio Worklets not supported - enable fallback mode');
        validation.valid = false;
      }
    }

    return validation;
  }

  getCompatiblePresets() {
    if (!this.machineCapabilities) return Object.keys(AUDIO_QUALITY_PRESETS);

    return Object.entries(AUDIO_QUALITY_PRESETS)
      .filter(([_, preset]) => {
        const caps = this.machineCapabilities;
        const req = preset.requirements;

        return caps.cpu.cores >= req.minCPUCores &&
               caps.memory.deviceMemory >= req.minRAM &&
               caps.browserScore >= req.browserMinScore;
      })
      .map(([name, _]) => name);
  }

  exportSettings() {
    return {
      preset: this.currentPreset,
      customSettings: this.customSettings,
      machineCapabilities: this.machineCapabilities,
      timestamp: Date.now()
    };
  }

  importSettings(data) {
    if (data.preset && AUDIO_QUALITY_PRESETS[data.preset]) {
      this.currentPreset = data.preset;
    }

    if (data.customSettings) {
      this.customSettings = { ...data.customSettings };
    }

    console.log('📥 Audio settings imported');

    return this.getCurrentSettings();
  }
}

// Default export
export default AudioQualityManager;