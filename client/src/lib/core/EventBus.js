// client/src/lib/core/EventBus.js

/**
 * Uygulama genelinde olay tabanlı iletişim için basit bir Event Bus.
 * Farklı modüllerin birbirine doğrudan bağımlı olmadan iletişim kurmasını sağlar.
 */
class EventEmitter {
    constructor() {
      this.events = {};
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
     * Bir olayı tetikler ve ilgili tüm dinleyicileri çağırır.
     * @param {string} eventName - Tetiklenecek olayın adı.
     * @param {*} payload - Dinleyicilere gönderilecek veri.
     */
    emit(eventName, payload) {
      if (this.events[eventName]) {
        this.events[eventName].forEach(listener => listener(payload));
      }
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