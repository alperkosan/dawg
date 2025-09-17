// FixedUniversalPlayheadManager.js - Playhead hareket etmeme sorununu çözen
/**
 * @file UniversalPlayheadManager.js
 * @description Merkezi playhead takip sistemi - tüm UI bileşenlerinde tutarlı playhead davranışı sağlar
 * Bu sistem 2 parametre (position, containerWidth) alarak herhangi bir arayüzde kullanılabilir
 */

class UniversalPlayheadManager {
  constructor() {
    this.subscribers = new Map(); // component id -> callback mapping
    this.globalPosition = 0; // Global playback position (in steps)
    this.isPlaying = false;
    this.lastUpdateTime = performance.now();
    this.animationFrame = null;
    
    // Debug için
    this.debugMode = true; // 🔥 DEBUG'u açık bırak
    
    console.log('🎯 [PlayheadManager] Sistem başlatıldı');
  }

  /**
   * Yeni bir bileşeni playhead takibine kaydeder
   * @param {string} componentId - Benzersiz bileşen tanımlayıcısı
   * @param {Function} callback - Playhead pozisyonu güncellendiğinde çağrılacak fonksiyon
   * @param {Object} config - Konfigürasyon seçenekleri
   */
  subscribe(componentId, callback, config = {}) {
    const defaultConfig = {
      containerWidth: 1000, // Container genişliği (px)
      stepWidth: 16, // Her step'in pixel genişliği
      offset: 0, // Başlangıç offset'i
      loop: true, // Loop desteği
      smoothing: true // Yumuşak animasyon
    };

    this.subscribers.set(componentId, {
      callback,
      config: { ...defaultConfig, ...config },
      lastPosition: 0
    });

    if (this.debugMode) {
      console.log(`🎵 [PlayheadManager] ${componentId} subscribed`, config);
    }

    // Mevcut pozisyonu hemen gönder
    this._updateSubscriber(componentId);
  }

  /**
   * Bileşeni takipten çıkarır
   */
  unsubscribe(componentId) {
    this.subscribers.delete(componentId);
    
    if (this.debugMode) {
      console.log(`🔇 [PlayheadManager] ${componentId} unsubscribed`);
    }
  }

  /**
   * Global playback pozisyonunu günceller (AudioEngine tarafından çağrılır)
   * @param {number} position - Yeni pozisyon (step cinsinden)
   * @param {boolean} isPlaying - Oynatma durumu
   */
  updatePosition(position, isPlaying = this.isPlaying) {
    this.globalPosition = position;
    this.isPlaying = isPlaying;
    this.lastUpdateTime = performance.now();

    if (this.debugMode) {
      console.log(`🎯 [PlayheadManager] Position updated: ${position}, Playing: ${isPlaying}`);
    }

    // Tüm aboneleri güncelle
    this._updateAllSubscribers();

    // Animasyonu başlat/durdur
    if (isPlaying && !this.animationFrame) {
      this._startAnimation();
    } else if (!isPlaying && this.animationFrame) {
      this._stopAnimation();
    }
  }

  /**
   * Belirli bir pozisyona atlama (timeline tıklaması için)
   */
  jumpToPosition(position) {
    if (this.debugMode) {
      console.log(`🎯 [PlayheadManager] Jump to position: ${position}`);
    }
    this.updatePosition(position, this.isPlaying);
  }

  /**
   * Bileşen konfigürasyonunu günceller
   */
  updateConfig(componentId, newConfig) {
    const subscriber = this.subscribers.get(componentId);
    if (subscriber) {
      subscriber.config = { ...subscriber.config, ...newConfig };
      this._updateSubscriber(componentId);
      
      if (this.debugMode) {
        console.log(`🔧 [PlayheadManager] Config updated for ${componentId}`, newConfig);
      }
    }
  }

  /**
   * Tüm aboneleri günceller
   */
  _updateAllSubscribers() {
    this.subscribers.forEach((subscriber, componentId) => {
      this._updateSubscriber(componentId);
    });
  }

  /**
   * Tek bir aboneyi günceller
   */
  _updateSubscriber(componentId) {
    const subscriber = this.subscribers.get(componentId);
    if (!subscriber) return;

    const { callback, config } = subscriber;
    const { containerWidth, stepWidth, offset, loop } = config;

    // Pozisyonu pixel cinsine çevir
    let pixelPosition = (this.globalPosition * stepWidth) + offset;

    // Loop kontrolü
    if (loop && containerWidth > 0) {
      const totalWidth = containerWidth;
      pixelPosition = pixelPosition % totalWidth;
    }

    // Callback'i çağır
    try {
      const data = {
        position: pixelPosition,
        stepPosition: this.globalPosition,
        isPlaying: this.isPlaying,
        timestamp: this.lastUpdateTime
      };
      
      callback(data);
      subscriber.lastPosition = pixelPosition;
      
      // Debug için
      if (this.debugMode && componentId === 'channel-rack-main') {
        console.log(`📍 [PlayheadManager] ${componentId} updated:`, data);
      }
    } catch (error) {
      console.error(`❌ [PlayheadManager] Error in ${componentId} callback:`, error);
    }
  }

  /**
   * Yumuşak animasyon başlatır
   */
  _startAnimation() {
    if (this.debugMode) {
      console.log('▶️ [PlayheadManager] Animation started');
    }
    
    const animate = () => {
      if (this.isPlaying) {
        this._updateAllSubscribers();
        this.animationFrame = requestAnimationFrame(animate);
      }
    };
    animate();
  }

  /**
   * Animasyonu durdurur
   */
  _stopAnimation() {
    if (this.debugMode) {
      console.log('⏹️ [PlayheadManager] Animation stopped');
    }
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Debug modunu açar/kapatır
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`🐛 [PlayheadManager] Debug mode: ${enabled}`);
  }

  /**
   * Sistem durumunu döndürür
   */
  getStatus() {
    const status = {
      subscriberCount: this.subscribers.size,
      globalPosition: this.globalPosition,
      isPlaying: this.isPlaying,
      subscribers: Array.from(this.subscribers.keys()),
      animationActive: !!this.animationFrame
    };
    
    if (this.debugMode) {
      console.log('📊 [PlayheadManager] Status:', status);
    }
    
    return status;
  }

  /**
   * Sistemi temizler
   */
  dispose() {
    this._stopAnimation();
    this.subscribers.clear();
    console.log('🗑️ [PlayheadManager] Disposed');
  }
}

// Singleton instance
const playheadManager = new UniversalPlayheadManager();

export { playheadManager as UniversalPlayheadManager };

// React Hook - kolay kullanım için
export function usePlayheadTracking(componentId, config) {
  const [playheadData, setPlayheadData] = React.useState({
    position: 0,
    stepPosition: 0,
    isPlaying: false,
    timestamp: 0
  });

  React.useEffect(() => {
    const callback = (data) => setPlayheadData(data);
    
    playheadManager.subscribe(componentId, callback, config);
    
    return () => {
      playheadManager.unsubscribe(componentId);
    };
  }, [componentId, config]);

  const updateConfig = React.useCallback((newConfig) => {
    playheadManager.updateConfig(componentId, newConfig);
  }, [componentId]);

  return [playheadData, updateConfig];
}