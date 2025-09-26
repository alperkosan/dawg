import { VIEWPORT_CONFIG, MUSIC_CONFIG } from '../config';

/**
 * @file viewport.js
 * @description Dünya uzayı (tick, midi) ve ekran uzayı (piksel) arasındaki
 * tüm dönüşümleri, zoom ve pan işlemlerini yönetir.
 */

export class Viewport {
  constructor(canvasWidth, canvasHeight) {
    // EKRAN BİLGİLERİ (Piksel)
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // DÜNYA UZAYI GÖRÜNÜMÜ (tick, midi)
    this.x = 0; // Viewport'un sol kenarının "tick" olarak konumu
    this.y = VIEWPORT_CONFIG.INITIAL_MIDI_Y_POSITION; // Viewport'un üst kenarının "MIDI nota no" olarak konumu (C6 civarı)

    // ZOOM SEVİYELERİ
    this.zoomX = VIEWPORT_CONFIG.INITIAL_ZOOM_X; // 1 tick'in kapladığı piksel sayısı
    this.zoomY = VIEWPORT_CONFIG.INITIAL_ZOOM_Y; // 1 MIDI notasının kapladığı piksel sayısı

    // İÇERİK BOYUTLARI
    this.totalBars = 32; // Varsayılan 32 bar

    // SINIRLAR
    this.minZoomX = 0.005;
    this.maxZoomX = 2.0;
    this.minZoomY = 5;
    this.maxZoomY = 50;
  }

  // === DÖNÜŞÜM FONKSİYONLARI ===

  /**
   * Dünya koordinatlarını (tick, midi) ekran pikseline çevirir.
   * @param {number} tick - Zaman (tick)
   * @param {number} midiNote - Nota numarası (0-127)
   * @returns {{x: number, y: number}} Ekran pikseli {x, y}
   */
  worldToScreen(tick, midiNote) {
    const screenX = (tick - this.x) * this.zoomX;
    const screenY = (this.canvasHeight - (midiNote - this.y) * this.zoomY); // Y eksenini ters çeviriyoruz (MIDI artarken Y azalmalı)
    return { x: screenX, y: screenY };
  }

  /**
   * Ekran pikselini dünya koordinatlarına (tick, midi) çevirir.
   * @param {number} screenX - Ekrandaki x pikseli
   * @param {number} screenY - Ekrandaki y pikseli
   * @returns {{tick: number, midiNote: number}} Dünya koordinatı {tick, midiNote}
   */
  screenToWorld(screenX, screenY) {
    const tick = (screenX / this.zoomX) + this.x;
    const midiNote = ((this.canvasHeight - screenY) / this.zoomY) + this.y;
    return { tick, midiNote };
  }

  // === ETKİLEŞİM FONKSİYONLARI ===

  /**
   * Viewport'u piksel cinsinden kaydırır (pan).
   * @param {number} deltaX - X eksenindeki piksel kayması
   * @param {number} deltaY - Y eksenindeki piksel kayması
   */
  pan(deltaX, deltaY) {
    this.x -= deltaX / this.zoomX;
    this.y += deltaY / this.zoomY; // Y ekseni ters olduğu için topluyoruz
  }

  /**
   * Belirtilen bir ekran noktası merkez alınarak zoom yapar.
   * @param {number} delta - Zoom değişimi (örneğin, -0.1 veya +0.1)
   * @param {number} centerX - Zoom merkezinin ekran x pikseli
   * @param {number} centerY - Zoom merkezinin ekran y pikseli
   */
  zoom(delta, centerX, centerY) {
      const { tick: tickBefore, midiNote: midiBefore } = this.screenToWorld(centerX, centerY);

      // Yeni zoom seviyesini hesapla
      const scale = 1 - delta * 0.01;

      // Dikey zoom maximum'a ulaştıysa sadece yatay zoom yap
      if (this.zoomY >= VIEWPORT_CONFIG.MAX_ZOOM_Y && scale > 1) {
        // Sadece yatay zoom
        this.zoomX = Math.max(VIEWPORT_CONFIG.MIN_ZOOM_X, Math.min(VIEWPORT_CONFIG.MAX_ZOOM_X, this.zoomX * scale));
      } else {
        // Normal zoom - hem yatay hem dikey
        this.zoomX = Math.max(VIEWPORT_CONFIG.MIN_ZOOM_X, Math.min(VIEWPORT_CONFIG.MAX_ZOOM_X, this.zoomX * scale));
        this.zoomY = Math.max(VIEWPORT_CONFIG.MIN_ZOOM_Y, Math.min(VIEWPORT_CONFIG.MAX_ZOOM_Y, this.zoomY * scale));
      }

      const { tick: tickAfter, midiNote: midiAfter } = this.screenToWorld(centerX, centerY);

      // İmlecin dünya üzerindeki konumu sabit kalacak şekilde viewport'u kaydır
      this.x += tickBefore - tickAfter;
      this.y += midiBefore - midiAfter;
  }

  /**
   * Canvas boyutu değiştiğinde günceller.
   * @param {number} width - Yeni genişlik
   * @param {number} height - Yeni yükseklik
   */
  resize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  // === GETTERS ===
  /**
   * Görünür olan tick aralığını döner.
   * @returns {{start: number, end: number}}
   */
  getVisibleTickRange() {
      const start = this.x;
      const end = this.x + this.canvasWidth / this.zoomX;
      return { start, end };
  }

  /**
   * Görünür olan MIDI nota aralığını döner.
   * @returns {{start: number, end: number}}
   */
  getVisibleMidiRange() {
      const start = this.y;
      const end = this.y + this.canvasHeight / this.zoomY;
      return { start, end };
  }

  /**
   * YENİ METOD: Sanal içeriğin toplam piksel boyutunu döndürür.
   * Bu, scroll barlarının doğru şekilde oluşması için gereklidir.
   * @returns {{width: number, height: number}}
   */
  getTotalSize() {
    const width = this.totalBars * (MUSIC_CONFIG.TICKS_PER_QUARTER_NOTE * 4) * this.zoomX;
    // Excel tarzı infinite scroll - çok büyük sanal yükseklik
    const height = 100000; // Sabit yüksek değer - infinite scroll simülasyonu
    return { width, height };
  }

  /**
   * YENİ METOD: Scroll pozisyonunu günceller ve dünya koordinatlarını ayarlar.
   */
  setScroll(scrollLeft, scrollTop) {
    this.scrollLeft = scrollLeft;
    this.scrollTop = scrollTop;

    // Scroll pozisyonuna göre dünya koordinatlarını güncelle
    this.x = scrollLeft / this.zoomX;

    // Excel tarzı infinite scroll - Y koordinatını sınırlamadan ayarla
    this.y = scrollTop / this.zoomY;
  }
}