// client/src/lib/core/EventBus.js

/**
 * Uygulama genelinde olay tabanlı iletişim için basit bir Event Bus.
 * Farklı modüllerin birbirine doğrudan bağımlı olmadan iletişim kurmasını sağlar.
 */
class EventEmitter {
    constructor() {
      this.events = {};
      // ⚡ PERFORMANCE: Throttling for high-frequency events
      this.throttledEvents = new Map();
      this.throttleSettings = {
        'positionUpdate': 16,  // 60fps for position updates
        'levelMeter': 33,      // 30fps for level meters
        'NOTE_ADDED': 50,      // 20fps for note operations
        'NOTE_REMOVED': 50,
        'NOTE_MODIFIED': 50
      };
    }
  
    /**
     * Bir olayı dinlemek için bir dinleyici (callback) ekler.
     * @param {string} eventName - Dinlenecek olayın adı.
     * @param {function} listener - Olay tetiklendiğinde çağrılacak fonksiyon.
     */
    on(eventName, listener) {
      if (!this.events[eventName]) {
        this.events[eventName] = [];
      }
      this.events[eventName].push(listener);
    }
  
    /**
     * ⚡ OPTIMIZED: Throttled emit for high-frequency events
     * @param {string} eventName - Tetiklenecek olayın adı.
     * @param {*} payload - Dinleyicilere gönderilecek veri.
     */
    emit(eventName, payload) {
      if (!this.events[eventName]) return;

      // Check if this event should be throttled
      const throttleMs = this.throttleSettings[eventName];
      if (throttleMs) {
        const now = Date.now();
        const lastEmit = this.throttledEvents.get(eventName) || 0;

        if (now - lastEmit < throttleMs) {
          return; // Skip this emit due to throttling
        }

        this.throttledEvents.set(eventName, now);
      }

      // Emit the event
      this.events[eventName].forEach(listener => {
        try {
          listener(payload);
        } catch (error) {
          console.warn(`EventBus: Error in listener for ${eventName}:`, error);
        }
      });
    }
  
    /**
     * Bir olayın dinleyicisini kaldırır.
     * @param {string} eventName - Olayın adı.
     * @param {function} listenerToRemove - Kaldırılacak dinleyici fonksiyonu.
     */
    off(eventName, listenerToRemove) {
      if (!this.events[eventName]) return;
  
      this.events[eventName] = this.events[eventName].filter(
        listener => listener !== listenerToRemove
      );
    }
  }
  
  // Singleton bir örnek oluşturarak tüm uygulamada aynı EventBus'ın kullanılmasını sağlıyoruz.
  const EventBus = new EventEmitter();
  export default EventBus;