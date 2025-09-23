/**
 * Uygulama genelinde olay (event) tabanlı iletişim için basit bir Event Bus.
 * Farklı modüllerin birbirine doğrudan bağımlı olmadan iletişim kurmasını sağlar.
 * Singleton pattern kullanılarak tek bir instance oluşturulur.
 */
class EventBus {
    constructor() {
      this.events = {};
    }
  
    /**
     * Bir olayı dinlemek için bir callback fonksiyonu kaydeder.
     * @param {string} eventName - Dinlenecek olayın adı.
     * @param {function} callback - Olay tetiklendiğinde çalıştırılacak fonksiyon.
     * @returns {function} - Dinleyiciyi kaldırmak için kullanılabilecek bir fonksiyon.
     */
    on(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = [];
      }
      this.events[eventName].push(callback);
      
      // Dinleyiciyi kaldırma fonksiyonu döndür.
      return () => {
        this.off(eventName, callback);
      };
    }
  
    /**
     * Bir olayın dinleyicisini kaldırır.
     * @param {string} eventName - Olayın adı.
     * @param {function} callback - Kaldırılacak callback fonksiyonu.
     */
    off(eventName, callback) {
      if (!this.events[eventName]) return;
  
      this.events[eventName] = this.events[eventName].filter(
        (cb) => cb !== callback
      );
    }
  
    /**
     * Bir olayı tetikler ve kayıtlı tüm dinleyicilere veri gönderir.
     * @param {string} eventName - Tetiklenecek olayın adı.
     * @param {*} data - Dinleyicilere gönderilecek veri.
     */
    emit(eventName, data) {
      if (!this.events[eventName]) return;
      this.events[eventName].forEach((callback) => callback(data));
    }
  }
  
  // Singleton instance'ı export et
  export const eventBus = new EventBus();