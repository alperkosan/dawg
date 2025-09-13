// src/engine/AudioEngine.js - Hybrid wrapper'a geçiş
import HybridAudioEngine from './HybridAudioEngine';

// Export etmek için wrapper class
class AudioEngine extends HybridAudioEngine {
  constructor(callbacks) {
    console.log('[AUDIO ENGINE] Hybrid wrapper ile başlatılıyor...');
    super(callbacks);
  }
}

// Mevcut export'unuzu koruyun
export default AudioEngine;

// Ek export'lar (ihtiyaç halinde)
export { AudioEngineUtils } from './HybridAudioEngine';