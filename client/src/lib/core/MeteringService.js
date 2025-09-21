/**
 * @file MeteringService.js - Enhanced Version
 * @description Geliştirilmiş metering sistemi - daha hassas veri işleme ve otomatik throttling
 */

const subscribers = new Map();
const dataBuffers = new Map(); // Her meterId için ring buffer
const BUFFER_SIZE = 128;
let isMeteringActive = false;

// Her meterId için buffer oluştur
const createBuffer = (meterId, type = 'spectrum') => {
  if (!dataBuffers.has(meterId)) {
    dataBuffers.set(meterId, {
      type,
      data: new Float32Array(type === 'spectrum' ? 256 : 1024),
      writeIndex: 0,
      lastUpdate: 0,
      smoothedData: new Float32Array(type === 'spectrum' ? 256 : 1024),
      peakHold: 0,
      peakDecay: 0.95
    });
  }
  return dataBuffers.get(meterId);
};

// Veri yumuşatma fonksiyonu (SADECE DİZİLER İÇİN)
const smoothData = (buffer, newData, smoothingFactor = 0.15) => {
  if (!buffer.smoothedData || buffer.smoothedData.length !== newData.length) {
    buffer.smoothedData = new Float32Array(newData);
    return buffer.smoothedData;
  }
  
  for (let i = 0; i < newData.length; i++) {
    buffer.smoothedData[i] = buffer.smoothedData[i] * (1 - smoothingFactor) + newData[i] * smoothingFactor;
  }
  
  return buffer.smoothedData;
};

// Peak detection ve hold (SADECE DİZİLER İÇİN)
const processPeaks = (buffer, data) => {
  const currentPeak = Math.max(...data.map(Math.abs));
  if (currentPeak > buffer.peakHold) {
    buffer.peakHold = currentPeak;
  } else {
    buffer.peakHold *= buffer.peakDecay;
  }
  return buffer.peakHold;
};

const manageMeteringLifecycle = () => {
  let totalSubscribers = 0;
  subscribers.forEach(callbackSet => totalSubscribers += callbackSet.size);

  if (totalSubscribers > 0 && !isMeteringActive) {
    isMeteringActive = true;
    console.log('[MeteringService] Enhanced metering activated');
  } else if (totalSubscribers === 0 && isMeteringActive) {
    isMeteringActive = false;
    dataBuffers.clear();
    console.log('[MeteringService] Metering deactivated, buffers cleared');
  }
};

const subscribe = (meterId, callback, config = {}) => {
  if (!subscribers.has(meterId)) {
    subscribers.set(meterId, new Set());
  }
  subscribers.get(meterId).add(callback);
  
  createBuffer(meterId, config.type || 'spectrum');
  manageMeteringLifecycle();
  
  return () => unsubscribe(meterId, callback);
};

const unsubscribe = (meterId, callback) => {
  if (subscribers.has(meterId)) {
    subscribers.get(meterId).delete(callback);
    if (subscribers.get(meterId).size === 0) {
      subscribers.delete(meterId);
      dataBuffers.delete(meterId);
    }
  }
  manageMeteringLifecycle();
};

const publish = (meterId, rawData, config = {}) => {
  if (!isMeteringActive || !subscribers.has(meterId)) return;
  
  const buffer = createBuffer(meterId, config.type);
  const now = performance.now();
  
  if (now - buffer.lastUpdate < 16.67) return;
  buffer.lastUpdate = now;
  
  // === HATA DÜZELTME BÖLGESİ BAŞLANGICI ===
  let processedData;
  let peak;

  // Gelen verinin DİZİ mi yoksa TEK SAYI mı olduğunu kontrol et
  if (Array.isArray(rawData) || rawData instanceof Float32Array) {
    // DİZİ İSE: Mevcut spektrum/dalga formu mantığını kullan
    processedData = rawData;
    if (config.smooth !== false) {
      processedData = smoothData(buffer, rawData, config.smoothingFactor);
    }
    peak = processPeaks(buffer, processedData);
  } else if (typeof rawData === 'number' && isFinite(rawData)) {
    // SAYI İSE (dB seviyeleri): Sayılar için özel, daha basit bir mantık kullan
    processedData = rawData; // Veriyi olduğu gibi işle
    peak = rawData; // Seviye ölçer için "peak", o anki değerin kendisidir.
    // ÖNEMLİ: smoothData veya processPeaks burada ÇAĞRILMAZ!
  } else {
    // Geçersiz veri tipi, işlemi durdur.
    return;
  }
  // === HATA DÜZELTME BÖLGESİ SONU ===

  // Abonelere gönder
  subscribers.get(meterId).forEach(callback => {
    try {
      callback({
        data: processedData,
        peak, // Her iki durumda da tutarlı bir peak değeri gönderiliyor.
        timestamp: now,
        type: buffer.type
      });
    } catch (error) {
      console.error(`[MeteringService] Callback error for ${meterId}:`, error);
    }
  });
};

const getDebugInfo = () => ({
  activeMeters: subscribers.size,
  totalSubscribers: Array.from(subscribers.values()).reduce((sum, set) => sum + set.size, 0),
  bufferMemory: dataBuffers.size * BUFFER_SIZE * 4,
  isActive: isMeteringActive
});

export const MeteringService = {
  subscribe,
  unsubscribe,
  publish,
  getDebugInfo,
  publishBatch: (updates) => {
    updates.forEach(({ meterId, data, config }) => {
      publish(meterId, data, config);
    });
  }
};