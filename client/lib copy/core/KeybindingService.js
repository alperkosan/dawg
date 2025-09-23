// src/lib/core/MeteringService.js - YENİ VE BASİTLEŞTİRİLMİŞ VERSİYON

/**
 * @file MeteringService.js
 * @description Sadece gelen veriyi ilgili abonelere dağıtan,
 * yüksek performanslı ve pasif bir yayın/abonelik (pub/sub) sistemi.
 * Bu yapı, ses motorundan gelen veriyi UI bileşenlerine iletmek için kullanılır.
 */

const subscribers = new Map();

/**
 * Belirli bir ölçümleme ID'sine (meterId) bir callback fonksiyonu abone eder.
 * @param {string} meterId - Benzersiz ölçümleme noktası kimliği (örn: 'track-1-output').
 * @param {Function} callback - Veri geldiğinde çağrılacak fonksiyon.
 * @returns {Function} - Aboneliği iptal etmek için çağrılacak bir fonksiyon.
 */
const subscribe = (meterId, callback) => {
  if (!subscribers.has(meterId)) {
    subscribers.set(meterId, new Set());
  }
  subscribers.get(meterId).add(callback);
  
  // Aboneliği sonlandırmak için bir fonksiyon döndür
  return () => unsubscribe(meterId, callback);
};

/**
 * Bir aboneliği sonlandırır.
 * @param {string} meterId - Aboneliğin yapıldığı kimlik.
 * @param {Function} callback - Kaldırılacak fonksiyon.
 */
const unsubscribe = (meterId, callback) => {
  if (subscribers.has(meterId)) {
    subscribers.get(meterId).delete(callback);
    if (subscribers.get(meterId).size === 0) {
      subscribers.delete(meterId);
    }
  }
};

/**
 * Dışarıdan (genellikle ses motorundan) çağrılır.
 * Belirli bir ölçümleme noktası için yeni veriyi tüm abonelere yayınlar.
 * @param {string} meterId - Verinin ait olduğu kimlik.
 * @param {*} data - Abonelere gönderilecek olan veri (genellikle bir sayı veya dizi).
 */
const publish = (meterId, data) => {
  if (subscribers.has(meterId)) {
    subscribers.get(meterId).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[MeteringService] Callback error for ${meterId}:`, error);
      }
    });
  }
};

export const MeteringService = {
  subscribe,
  unsubscribe,
  publish,
};