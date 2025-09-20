/**
 * @file MeteringService.js
 * @description AudioEngine'den gelen yüksek frekanslı görsel verileri (metreler, analizörler)
 * ilgili UI bileşenlerine dağıtan, kendi yaşam döngüsünü yöneten bir yayın/abonelik sistemidir.
 * REHBER ADIM 4.1'e göre güncellenmiştir.
 */

const subscribers = new Map();
let isMeteringActive = false; // Metering'in aktif olup olmadığını takip eder

/**
 * Abonelik döngüsünü yönetir. AudioEngine'deki Tone.Transport'a bağlıdır.
 * Bu fonksiyonun dışarıdan çağrılmasına gerek yoktur.
 */
const manageMeteringLifecycle = () => {
  let totalSubscribers = 0;
  subscribers.forEach(callbackSet => totalSubscribers += callbackSet.size);

  if (totalSubscribers > 0 && !isMeteringActive) {
    // İlk abone eklendiğinde metering aktif hale gelir.
    // Gerçek veri gönderimi AudioEngine içindeki Tone.Transport.scheduleRepeat ile yapılır.
    isMeteringActive = true;
    console.log('[MeteringService] Aktif. Aboneler veri bekliyor.');
  } else if (totalSubscribers === 0 && isMeteringActive) {
    // Son abone de çıktığında deaktif hale gelir.
    isMeteringActive = false;
    console.log('[MeteringService] Pasif. Hiç abone yok.');
  }
};

/**
 * Belirli bir efektin verisine abone olur.
 * @param {string} meterId - Benzersiz abone kimliği (örn: "track-1-output").
 * @param {Function} callback - Veri geldiğinde çalıştırılacak fonksiyon.
 */
const subscribe = (meterId, callback) => {
  if (!subscribers.has(meterId)) {
    subscribers.set(meterId, new Set());
  }
  subscribers.get(meterId).add(callback);
  manageMeteringLifecycle();
};

/**
 * Bir efektin aboneliğini sonlandırır.
 * @param {string} meterId - Benzersiz abone kimliği.
 * @param {Function} callback - Kaldırılacak fonksiyon.
 */
const unsubscribe = (meterId, callback) => {
  if (subscribers.has(meterId)) {
    subscribers.get(meterId).delete(callback);
    if (subscribers.get(meterId).size === 0) {
      subscribers.delete(meterId);
    }
  }
  manageMeteringLifecycle();
};

/**
 * AudioEngine tarafından çağrılır. Gelen veriyi ilgili abonelere yayınlar.
 * @param {string} meterId - Verinin ait olduğu benzersiz kimlik.
 * @param {*} data - Yayınlanacak veri (örn: gain reduction değeri, frekans spektrumu).
 */
const publish = (meterId, data) => {
  if (!isMeteringActive || !subscribers.has(meterId)) return;
  
  subscribers.get(meterId).forEach(callback => {
    try {
      callback(data);
    } catch (error) {
      console.error(`[MeteringService] Abone geri çağrım hatası (meterId: ${meterId}):`, error);
    }
  });
};

export const MeteringService = {
  subscribe,
  unsubscribe,
  publish,
};
