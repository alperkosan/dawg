/**
 * @file MeteringService.js
 * @description AudioEngine'den gelen yüksek frekanslı görsel verileri (metreler, analizörler)
 * ilgili UI bileşenlerine dağıtan bir yayın/abonelik sistemidir.
 */

// Aboneleri tutacak olan ana nesne.
// Yapısı: { "trackId-effectId": Set<callback>, ... }
const subscribers = new Map();

/**
 * Belirli bir efektin verisine abone olur.
 * @param {string} meterId - Benzersiz abone kimliği (örn: "track-1-fx-12345").
 * @param {Function} callback - Veri geldiğinde çalıştırılacak fonksiyon.
 */
const subscribe = (meterId, callback) => {
  if (!subscribers.has(meterId)) {
    subscribers.set(meterId, new Set());
  }
  subscribers.get(meterId).add(callback);
};

/**
 * Bir efektin aboneliğini sonlandırır.
 * @param {string} meterId - Benzersiz abone kimliği.
 * @param {Function} callback - Kaldırılacak fonksiyon.
 */
const unsubscribe = (meterId, callback) => {
  if (subscribers.has(meterId)) {
    subscribers.get(meterId).delete(callback);
  }
};

/**
 * AudioEngine tarafından çağrılır. Gelen veriyi ilgili abonelere yayınlar.
 * @param {string} meterId - Verinin ait olduğu benzersiz kimlik.
 * @param {*} data - Yayınlanacak veri (örn: gain reduction değeri, frekans spektrumu).
 */
const publish = (meterId, data) => {
  if (subscribers.has(meterId)) {
    subscribers.get(meterId).forEach(callback => callback(data));
  }
};

export const MeteringService = {
  subscribe,
  unsubscribe,
  publish,
};