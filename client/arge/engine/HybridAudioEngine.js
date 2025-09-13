// ============================================================================
// HYBRID AUDIO ENGINE WRAPPER - BROWSER SAFE VERSİYON
// ============================================================================

// 1. HybridAudioEngine.js - Ana wrapper dosyası (Browser Safe)
import { EnterpriseAudioEngine } from './EnterpriseAudioEngine';

// Browser-safe development detection
const isDevelopment = () => {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '' ||
    window.location.port !== '' ||
    window.location.search.includes('debug=true')
  );
};

// Browser-safe environment variable check
const getEnvVar = (varName, defaultValue = null) => {
  try {
    // Vite/React environment variables
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[varName] || defaultValue;
    }
    
    // Webpack environment variables
    if (typeof process !== 'undefined' && process.env) {
      return process.env[varName] || defaultValue;
    }
    
    // Fallback: localStorage-based config
    const storageKey = varName.replace('REACT_APP_', '').toLowerCase();
    return localStorage.getItem(storageKey) || defaultValue;
  } catch (error) {
    console.warn(`[HYBRID] Environment variable ${varName} okunamadı:`, error);
    return defaultValue;
  }
};

class HybridAudioEngine {
  constructor(callbacks) {
    this.callbacks = callbacks || {};
    
    // Engine seçimi - Browser-safe
    this.useEnterprise = this._shouldUseEnterprise();
    
    // Debug logging
    console.log(`[HYBRID] ${this.useEnterprise ? 'Enterprise' : 'Legacy'} engine seçildi`);
    
    // Engine initialization
    if (this.useEnterprise) {
      this._initializeEnterpriseEngine();
    } else {
      this._initializeLegacyEngine();
    }
    
    // Feature detection
    this._detectFeatures();
    
    // Migration helpers
    this._setupMigrationHelpers();
  }

  /**
   * Engine seçim mantığı - Browser-safe
   */
  _shouldUseEnterprise() {
    try {
      // 1. Debug override (developer tools için)
      const debugOverride = localStorage.getItem('forceAudioEngine');
      if (debugOverride === 'enterprise') return true;
      if (debugOverride === 'legacy') return false;
      
      // 2. User preference
      const userPreference = localStorage.getItem('useEnterpriseAudio');
      if (userPreference !== null) {
        return userPreference === 'true';
      }
      
      // 3. Environment variable (browser-safe)
      const envEnterprise = getEnvVar('REACT_APP_ENTERPRISE_AUDIO', 'false');
      if (envEnterprise === 'true') {
        return true;
      }
      
      // 4. Feature detection (otomatik)
      if (this._canUseEnterprise()) {
        // Enterprise destekleniyorsa ve büyük proje ise
        const instrumentCount = this._estimateInstrumentCount();
        return instrumentCount > 10; // 10+ enstrümanda enterprise
      }
      
      // 5. Default: Legacy (güvenli)
      return false;
      
    } catch (error) {
      console.warn('[HYBRID] Engine seçim hatası, legacy kullanılıyor:', error);
      return false;
    }
  }

  /**
   * Enterprise engine uyumluluğu kontrolü
   */
  _canUseEnterprise() {
    try {
      // Web Audio API kontrolü
      if (!window.AudioContext && !window.webkitAudioContext) {
        return false;
      }
      
      // Performance API kontrolü
      if (!window.performance || !window.performance.now) {
        return false;
      }
      
      // Memory API kontrolü (opsiyonel)
      const hasMemoryAPI = !!(window.performance && window.performance.memory);
      
      console.log(`[HYBRID] Enterprise uyumluluk: Audio API ✓, Performance API ✓, Memory API ${hasMemoryAPI ? '✓' : '⚠️'}`);
      return true;
      
    } catch (error) {
      console.warn('[HYBRID] Enterprise uyumluluk kontrolü başarısız:', error);
      return false;
    }
  }

  /**
   * Proje boyutunu tahmin et
   */
  _estimateInstrumentCount() {
    try {
      // LocalStorage'dan mevcut instrument verilerini kontrol et
      const instruments = JSON.parse(localStorage.getItem('instrumentData') || '[]');
      return instruments.length;
    } catch {
      return 0;
    }
  }

  /**
   * Enterprise engine başlatma
   */
  _initializeEnterpriseEngine() {
    try {
      // Enterprise engine'i import et ve başlat
      this.engine = new EnterpriseAudioEngine({
        ...this.callbacks,
        onPerformanceWarning: (warning) => {
          console.warn('[ENTERPRISE] Performance uyarısı:', warning);
          this.callbacks.onPerformanceWarning?.(warning);
        },
        onEmergencyCleanup: () => {
          console.warn('[ENTERPRISE] Emergency cleanup tetiklendi');
          this.callbacks.onEmergencyCleanup?.();
        }
      });
      
      this.engineType = 'enterprise';
      console.log('[HYBRID] ✅ Enterprise engine başlatıldı');
      
    } catch (error) {
      console.error('[HYBRID] Enterprise engine başlatma hatası:', error);
      console.log('[HYBRID] ⚠️ Legacy engine\'a geçiliyor...');
      this._fallbackToLegacy();
    }
  }

  /**
   * Legacy engine başlatma (mevcut kodunuz)
   */
  _initializeLegacyEngine() {
    try {
      // Mevcut AudioEngine.js'inizi import edin
      // import { AudioEngine } from './AudioEngine.backup';
      
      // GEÇICI: Basit mock engine (gerçek legacy engine'inizi buraya koyun)
      this.engine = this._createLegacyEngine();
      
      this.engineType = 'legacy';
      console.log('[HYBRID] ✅ Legacy engine başlatıldı');
      
    } catch (error) {
      console.error('[HYBRID] Legacy engine başlatma hatası:', error);
      throw new Error('Her iki engine de başlatılamadı');
    }
  }

  /**
   * Legacy engine'a güvenli geçiş
   */
  _fallbackToLegacy() {
    this.useEnterprise = false;
    localStorage.setItem('useEnterpriseAudio', 'false');
    this._initializeLegacyEngine();
  }

  /**
   * Geçici legacy engine (gerçek kodunuzla değiştirin)
   */
  _createLegacyEngine() {
    console.log('[HYBRID] Mock legacy engine oluşturuluyor...');
    
    return {
      // Mevcut AudioEngine.js metodlarınızı buraya proxy edin
      syncFromStores: async (instrumentData, mixerTrackData) => {
        console.log('[LEGACY MOCK] syncFromStores çağrıldı', {
          instruments: instrumentData?.length || 0,
          tracks: mixerTrackData?.length || 0
        });
        
        // Simulated sync delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Success callback
        if (this.callbacks.onSyncComplete) {
          this.callbacks.onSyncComplete();
        }
        
        return Promise.resolve();
      },
      
      trigger: (instrumentId, time, note, bufferDuration, cutItself) => {
        console.log('[LEGACY MOCK] trigger çağrıldı', { instrumentId, note: note?.pitch });
      },
      
      reschedule: () => {
        console.log('[LEGACY MOCK] reschedule çağrıldı');
      },
      
      dispose: () => {
        console.log('[LEGACY MOCK] dispose çağrıldı');
      },
      
      // Mock properties
      instruments: new Map(),
      mixerStrips: new Map(),
      isPlaying: false,
      
      // Mock methods for compatibility
      clearAllScheduledNotes: () => {
        console.log('[LEGACY MOCK] clearAllScheduledNotes çağrıldı');
      },
      
      updateParameters: () => {
        console.log('[LEGACY MOCK] updateParameters çağrıldı');
      }
    };
  }

  /**
   * Feature detection - Hangi özelliklerin mevcut olduğunu belirle
   */
  _detectFeatures() {
    this.features = {
      // Temel özellikler (her iki engine'de mevcut)
      basicPlayback: true,
      syncFromStores: true,
      trigger: true,
      reschedule: true,
      
      // Enterprise-specific özellikler
      voiceManagement: this.useEnterprise,
      performanceMonitoring: this.useEnterprise,
      emergencyCleanup: this.useEnterprise,
      polyphony: this.useEnterprise,
      nativeAudio: this.useEnterprise,
      
      // Legacy-specific özellikler
      toneJsIntegration: !this.useEnterprise
    };
    
    console.log('[HYBRID] Mevcut özellikler:', this.features);
  }

  /**
   * Migration helper metodları
   */
  _setupMigrationHelpers() {
    // Global debug fonksiyonları (development için)
    if (isDevelopment()) {
      window.hybridAudioEngine = this;
      window.switchToEnterprise = () => this.switchEngine('enterprise');
      window.switchToLegacy = () => this.switchEngine('legacy');
      window.getAudioEngineInfo = () => this.getEngineInfo();
    }
  }

  // ========================================================================
  // PUBLIC API - Mevcut kodunuzla uyumlu interface
  // ========================================================================

  /**
   * Ana sync metodu - Her iki engine'e proxy
   */
  async syncFromStores(instrumentData, mixerTrackData) {
    try {
      const startTime = performance.now();
      
      await this.engine.syncFromStores(instrumentData, mixerTrackData);
      
      const duration = performance.now() - startTime;
      console.log(`[HYBRID] Sync tamamlandı (${this.engineType}): ${duration.toFixed(2)}ms`);
      
      return true;
    } catch (error) {
      console.error(`[HYBRID] Sync hatası (${this.engineType}):`, error);
      
      // Enterprise'da hata varsa legacy'e geç
      if (this.useEnterprise && error.name !== 'UserGestureRequired') {
        console.log('[HYBRID] Enterprise hatası nedeniyle legacy\'e geçiliyor...');
        this._fallbackToLegacy();
        return this.syncFromStores(instrumentData, mixerTrackData);
      }
      
      throw error;
    }
  }

  /**
   * Trigger metodu - Mevcut kullanımınızla uyumlu
   */
  trigger(instrumentId, time, note, bufferDuration, cutItself) {
    try {
      return this.engine.trigger(instrumentId, time, note, bufferDuration, cutItself);
    } catch (error) {
      console.error(`[HYBRID] Trigger hatası (${this.engineType}):`, error);
      throw error;
    }
  }

  /**
   * Reschedule metodu
   */
  reschedule() {
    try {
      return this.engine.reschedule();
    } catch (error) {
      console.error(`[HYBRID] Reschedule hatası (${this.engineType}):`, error);
      throw error;
    }
  }

  /**
   * Dispose metodu
   */
  dispose() {
    try {
      if (this.engine && this.engine.dispose) {
        this.engine.dispose();
      }
      console.log(`[HYBRID] ${this.engineType} engine kapatıldı`);
    } catch (error) {
      console.error(`[HYBRID] Dispose hatası (${this.engineType}):`, error);
    }
  }

  // ========================================================================
  // ENTERPRISE-SPECIFIC METHODS (Fallback ile)
  // ========================================================================

  /**
   * Performance raporu (sadece enterprise'da mevcut)
   */
  getSystemPerformanceReport() {
    if (this.features.performanceMonitoring && this.engine.getSystemPerformanceReport) {
      return this.engine.getSystemPerformanceReport();
    }
    
    return {
      engineType: this.engineType,
      message: 'Performance monitoring sadece enterprise engine\'da mevcut',
      fallback: {
        totalVoices: 'Bilinmiyor',
        maxVoices: 'Bilinmiyor',
        instrumentCount: this.engine.instruments?.size || 'Bilinmiyor',
        systemLoad: 'Bilinmiyor'
      }
    };
  }

  /**
   * Emergency cleanup (sadece enterprise'da mevcut)
   */
  performEmergencyCleanup() {
    if (this.features.emergencyCleanup && this.engine.performEmergencyCleanup) {
      console.log('[HYBRID] Emergency cleanup tetikleniyor...');
      return this.engine.performEmergencyCleanup();
    }
    
    console.warn('[HYBRID] Emergency cleanup sadece enterprise engine\'da mevcut');
    // Legacy fallback: Temel temizlik
    if (this.engine.reschedule) {
      this.engine.reschedule();
    }
    if (this.engine.clearAllScheduledNotes) {
      this.engine.clearAllScheduledNotes();
    }
  }

  /**
   * Total active voices (sadece enterprise'da mevcut)
   */
  getTotalActiveVoices() {
    if (this.features.voiceManagement && this.engine.getTotalActiveVoices) {
      return this.engine.getTotalActiveVoices();
    }
    
    return 0; // Legacy fallback
  }

  /**
   * Memory cleanup
   */
  performMemoryCleanup() {
    if (this.engine.performMemoryCleanup) {
      return this.engine.performMemoryCleanup();
    }
    
    // Legacy fallback: Garbage collection hint
    if (window.gc) {
      window.gc();
    }
  }

  // ========================================================================
  // DEVELOPMENT & DEBUGGING TOOLS
  // ========================================================================

  /**
   * Engine değiştirme (development için)
   */
  switchEngine(targetEngine) {
    if (!isDevelopment()) {
      console.warn('[HYBRID] Engine switching sadece development modda mevcut');
      return;
    }
    
    console.log(`[HYBRID] Engine değiştiriliyor: ${this.engineType} -> ${targetEngine}`);
    
    // Mevcut engine'i kapat
    this.dispose();
    
    // Yeni engine'i zorla
    localStorage.setItem('forceAudioEngine', targetEngine);
    
    // Sayfa yenilenmesi gerekiyor
    if (window.confirm('Engine değişikliği için sayfa yenilenmesi gerekiyor. Devam edilsin mi?')) {
      window.location.reload();
    }
  }

  /**
   * Engine bilgilerini al
   */
  getEngineInfo() {
    return {
      currentEngine: this.engineType,
      useEnterprise: this.useEnterprise,
      features: this.features,
      canUseEnterprise: this._canUseEnterprise(),
      estimatedInstrumentCount: this._estimateInstrumentCount(),
      isDevelopment: isDevelopment(),
      
      // Debug helpers
      debugCommands: isDevelopment() ? [
        'window.switchToEnterprise()',
        'window.switchToLegacy()', 
        'window.getAudioEngineInfo()',
        'window.hybridAudioEngine.getSystemPerformanceReport()',
        'window.hybridAudioEngine.performEmergencyCleanup()'
      ] : []
    };
  }

  /**
   * Feature kontrolü helper'ı
   */
  hasFeature(featureName) {
    return !!this.features[featureName];
  }

  /**
   * Safe method call - Metod varsa çağır, yoksa fallback
   */
  safeCall(methodName, fallbackValue = null, ...args) {
    if (this.engine && typeof this.engine[methodName] === 'function') {
      try {
        return this.engine[methodName](...args);
      } catch (error) {
        console.error(`[HYBRID] Safe call hatası (${methodName}):`, error);
        return fallbackValue;
      }
    }
    
    console.warn(`[HYBRID] Metod mevcut değil: ${methodName}`);
    return fallbackValue;
  }
}

// ============================================================================
// EXPORTS & UTILITIES
// ============================================================================

export default HybridAudioEngine;

// Utility functions
export const AudioEngineUtils = {
  /**
   * Mevcut engine tipini öğren
   */
  getCurrentEngineType() {
    return window.hybridAudioEngine?.engineType || 'unknown';
  },
  
  /**
   * Enterprise engine'in mevcut olup olmadığını kontrol et
   */
  isEnterpriseAvailable() {
    try {
      // EnterpriseAudioEngine import edilebilir mi?
      return typeof EnterpriseAudioEngine === 'function';
    } catch {
      return false;
    }
  },
  
  /**
   * Development mode kontrolü
   */
  isDevelopment,
  
  /**
   * Environment variable helper
   */
  getEnvVar,
  
  /**
   * Migration önerileri
   */
  getMigrationRecommendation() {
    const instrumentCount = JSON.parse(localStorage.getItem('instrumentData') || '[]').length;
    const hasPolyphony = localStorage.getItem('needsPolyphony') === 'true';
    const hasPerformanceIssues = localStorage.getItem('hasPerformanceIssues') === 'true';
    
    if (instrumentCount > 20 || hasPolyphony || hasPerformanceIssues) {
      return {
        recommendation: 'enterprise',
        reason: 'Büyük proje veya performance ihtiyacı tespit edildi',
        benefits: [
          'Daha iyi performance',
          'Çoklu ses desteği', 
          'Memory optimizasyonu',
          'Advanced monitoring'
        ]
      };
    }
    
    return {
      recommendation: 'legacy',
      reason: 'Mevcut proje boyutu için legacy engine yeterli',
      benefits: [
        'Basit ve stabil',
        'Test edilmiş',
        'Düşük komplekslik'
      ]
    };
  }
};