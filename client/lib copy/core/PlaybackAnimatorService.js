/**
 * @file PlaybackAnimatorService.js
 * @description React'in render döngüsünden tamamen bağımsız, yüksek performanslı bir animasyon
 * yayın/abonelik (pub/sub) sistemi. AudioEngine'den gelen yüksek frekanslı konum
 * güncellemelerini, animasyonu gerçekleştirecek olan hook'lara (abonelere) dağıtır.
 * Bu yapı, state güncellemelerinin neden olduğu gereksiz re-render'ları tamamen ortadan kaldırır.
 */

// Tüm animasyon abonelerinin (callback fonksiyonlarının) listesi.
const subscribers = new Set();

/**
 * Yeni bir animasyon abonesi (bir callback fonksiyonu) ekler.
 * @param {Function} callback - Her animasyon karesinde çalıştırılacak fonksiyon.
 * Bu fonksiyon, parametre olarak playback ilerlemesini (0-1 arası) alır.
 */
const subscribe = (callback) => {
  subscribers.add(callback);
};

/**
 * Bir animasyon abonesini listeden kaldırır.
 * @param {Function} callback - Kaldırılacak olan callback fonksiyonu.
 */
const unsubscribe = (callback) => {
  subscribers.delete(callback);
};

/**
 * AudioEngine tarafından çağrılır. Yeni playback ilerlemesini tüm abonelere yayınlar.
 * @param {number} progress - Loop içindeki mevcut ilerleme (0 ile 1 arasında bir sayı).
 */
const publish = (progress) => {
  // Set üzerinde forEach ile tüm abonelere yeni ilerlemeyi bildir.
  subscribers.forEach(callback => callback(progress));
};

// Servisin public arayüzünü dışa aktar.
export const PlaybackAnimatorService = {
  subscribe,
  unsubscribe,
  publish,
};