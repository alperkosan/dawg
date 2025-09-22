export const NativeEngineConfig = {
  // Audio Context Settings
  audioContext: {
    sampleRate: 48000,
    latencyHint: 'interactive',
    bufferSize: 256
  },

  // Worklet Settings
  worklets: {
    maxPolyphony: 32,
    enableDebugMode: process.env.NODE_ENV === 'development',
    errorRetryAttempts: 3
  },

  // Performance Settings
  performance: {
    enablePerformanceMonitoring: true,
    performanceUpdateInterval: 1000,
    cpuUsageThreshold: 80,
    memoryUsageThreshold: 100 // MB
  },

  // Mixer Settings
  mixer: {
    defaultChannelCount: 16,
    defaultBusCount: 4,
    enableAutoRouting: true,
    enableSendEffects: true
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
