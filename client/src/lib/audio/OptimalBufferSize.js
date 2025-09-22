// client/src/lib/audio/OptimalBufferSize.js
export class BufferSizeOptimizer {
  static getOptimalBufferSize(audioContext) {
    const sampleRate = audioContext.sampleRate;
    const baseLatency = audioContext.baseLatency;
    const outputLatency = audioContext.outputLatency;
    
    // Hedef: <10ms total latency
    const targetLatency = 0.010; // 10ms
    const currentLatency = baseLatency + outputLatency;
    
    if (currentLatency > targetLatency) {
      // Buffer size'ı küçült
      return Math.max(128, Math.floor(sampleRate * targetLatency / 2));
    }
    
    // Optimal range: 128-512 samples
    return Math.min(512, Math.max(128, Math.floor(sampleRate * targetLatency)));
  }

  static async setOptimalBuffer(audioContext) {
    const optimalSize = this.getOptimalBufferSize(audioContext);
    
    if (audioContext.audioWorklet) {
      // AudioWorklet buffer size hint
      return optimalSize;
    }
    
    return 512; // Fallback
  }
}