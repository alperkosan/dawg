// client/src/lib/audio/WorkletFallback.js
export class WorkletFallbackManager {
  static async testWorkletSupport() {
    try {
      if (!window.AudioWorkletNode) {
        return { supported: false, reason: 'AudioWorkletNode not available' };
      }

      const context = new AudioContext();
      
      // Basit test worklet yükle
      await context.audioWorklet.addModule('/worklets/test-processor.js');
      
      context.close();
      return { supported: true };
      
    } catch (error) {
      return { 
        supported: false, 
        reason: `WorkletTest failed: ${error.message}` 
      };
    }
  }

  static getRecommendedMode() {
    const isChrome = navigator.userAgent.includes('Chrome');
    const isFirefox = navigator.userAgent.includes('Firefox');
    const isSafari = navigator.userAgent.includes('Safari') && !isChrome;

    if (isChrome) return 'hybrid'; // En iyi destek
    if (isFirefox) return 'limited'; // Kısıtlı destek
    if (isSafari) return 'tone-only'; // Safari'de sorunlu olabilir
    
    return 'tone-only'; // Güvenli fallback
  }
}