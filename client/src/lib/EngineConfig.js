// Note: AudioQualityManager will be imported dynamically to avoid circular dependency
let qualityManager = null;

// Dynamic import function
async function getQualityManager() {
  if (!qualityManager) {
    const { default: AudioQualityManager } = await import('./config/AudioQualityConfig.js');
    qualityManager = new AudioQualityManager();
  }
  return qualityManager;
}

export const NativeEngineConfig = {
  // Dynamic Audio Context Settings (can be overridden by AudioQualityManager)
  audioContext: {
    sampleRate: 48000,
    latencyHint: 'interactive',
    bufferSize: 256
  },

  // Worklet Settings (performance-sensitive)
  worklets: {
    maxPolyphony: 32,
    workletPoolSize: 4,
    enableDebugMode: process.env.NODE_ENV === 'development',
    errorRetryAttempts: 3,
    enableAudioWorkletFallback: true
  },

  // Performance Settings (dynamically adjustable)
  performance: {
    enablePerformanceMonitoring: true,
    performanceUpdateInterval: 1000,
    cpuUsageThreshold: 80,
    memoryUsageThreshold: 100, // MB
    enableRealTimeEffects: true,
    enableHighQualityResampling: false
  },

  // Mixer Settings (scalable based on system)
  mixer: {
    defaultChannelCount: 16,
    defaultBusCount: 4,
    enableAutoRouting: true,
    enableSendEffects: true,
    maxChannelCount: 64
  },

  // Pattern Settings
  pattern: {
    defaultLength: 64, // steps
    maxPatternLength: 256,
    enablePatternChaining: true,
    enablePatternMutation: true
  },

  // Transport Settings
  transport: {
    defaultBPM: 120,
    minBPM: 60,
    maxBPM: 200,
    enableSwing: true,
    enableQuantization: true
  }
};

// Function to apply dynamic settings from AudioQualityManager
export async function applyDynamicConfig(audioEngine, userPreferences = {}) {
  try {
    console.log('🎛️ Applying dynamic audio configuration...');

    // Get quality manager instance
    const manager = await getQualityManager();

    // Initialize quality manager if not already done
    if (!manager.capabilities) {
      await manager.initialize();
    }

    // Get optimal settings based on machine capabilities
    const optimalSettings = manager.getCurrentSettings();

    // Merge with user preferences
    const finalSettings = { ...optimalSettings, ...userPreferences };

    // Apply to audio engine
    if (audioEngine.audioContext) {
      // Update engine settings object
      audioEngine.settings = {
        ...audioEngine.settings,
        sampleRate: finalSettings.sampleRate,
        latencyHint: finalSettings.latencyHint,
        bufferSize: finalSettings.bufferSize,
        maxPolyphony: finalSettings.maxPolyphony
      };

      // Update global config
      NativeEngineConfig.audioContext.sampleRate = finalSettings.sampleRate;
      NativeEngineConfig.audioContext.latencyHint = finalSettings.latencyHint;
      NativeEngineConfig.audioContext.bufferSize = finalSettings.bufferSize;
      NativeEngineConfig.worklets.maxPolyphony = finalSettings.maxPolyphony;
      NativeEngineConfig.mixer.defaultChannelCount = finalSettings.mixerChannels;
      NativeEngineConfig.performance.performanceUpdateInterval = finalSettings.performanceUpdateInterval;
      NativeEngineConfig.performance.enableRealTimeEffects = finalSettings.enableRealTimeEffects;
      NativeEngineConfig.performance.enableHighQualityResampling = finalSettings.enableHighQualityResampling;

      console.log('✅ Dynamic configuration applied:', finalSettings);

      return {
        applied: finalSettings,
        capabilities: manager.capabilities,
        performanceImpact: manager.calculatePerformanceImpact(finalSettings)
      };
    }

    console.warn('⚠️ Audio engine not available for configuration');
    return { applied: finalSettings };

  } catch (error) {
    console.error('❌ Failed to apply dynamic configuration:', error);
    return { error: error.message };
  }
}

// Export the getQualityManager function
export { getQualityManager };

// Performance monitoring with dynamic thresholds
export function updatePerformanceThresholds(capabilities) {
  if (capabilities.overallScore >= 80) {
    NativeEngineConfig.performance.cpuUsageThreshold = 85;
    NativeEngineConfig.performance.performanceUpdateInterval = 500;
  } else if (capabilities.overallScore >= 60) {
    NativeEngineConfig.performance.cpuUsageThreshold = 75;
    NativeEngineConfig.performance.performanceUpdateInterval = 1000;
  } else {
    NativeEngineConfig.performance.cpuUsageThreshold = 65;
    NativeEngineConfig.performance.performanceUpdateInterval = 2000;
  }
}
