/**
 * @file config.js
 * @description Piano Roll V4 için tüm statik konfigürasyonları ve "sihirli sayıları" barındırır.
 */

// Müzik ve Zaman Sabitleri
export const MUSIC_CONFIG = {
  TICKS_PER_QUARTER_NOTE: 480, // Bir dörtlük notanın tick karşılığı (standart)
  // Excel tarzı infinite scroll - MIDI sınırları yok
  MAX_MIDI_NOTE: 999,  // Sonsuz scroll için yüksek limit
  MIN_MIDI_NOTE: -999, // Sonsuz scroll için düşük limit
};

// Çizim ve Görsel Ayarlar
export const RENDER_CONFIG = {
  NOTE_COLOR: "#5e92cc",
  NOTE_SELECTED_COLOR: "#4a9eff",
  NOTE_BORDER_COLOR: "rgba(0,0,0,0.3)",
  GRID_PRIMARY_COLOR: "#555",      // Yatay grid çizgileri (MIDI notaları arası)
  GRID_SECONDARY_COLOR: "#444",    // Dikey grid çizgileri (zaman tick'leri)
  GRID_TERTIARY_COLOR: "#666",     // Ana ölçü çizgileri
  BACKGROUND_COLOR: '#3a3a3a',
  WHITE_KEY_COLOR: '#4a4a4a', // Beyaz tuşların arka plan rengi (hafif koyu gri)
  BLACK_KEY_COLOR: '#2a2a2a',   // Siyah tuşların rengi

  // Grid kalınlık ayarları
  GRID_LINE_WIDTH_PRIMARY: 1.0,   // Yatay çizgiler
  GRID_LINE_WIDTH_SECONDARY: 0.7, // Dikey çizgiler
};

// Viewport ve Etkileşim Ayarları
export const VIEWPORT_CONFIG = {
  INITIAL_ZOOM_X: 0.2,   // Başlangıç yatay zoom (1 tick = 0.2 piksel)
  INITIAL_ZOOM_Y: 20,    // Başlangıç dikey zoom (1 MIDI notası = 20 piksel)
  MIN_ZOOM_X: 0.005,
  MAX_ZOOM_X: 50.0,    // Yatay zoom sınırsıza yakın
  MIN_ZOOM_Y: 5,
  MAX_ZOOM_Y: 120,     // Keyboard width ile eşit (1 MIDI = 120px)
  INITIAL_MIDI_Y_POSITION: 50, // C5 (MIDI 72) civarını ortalamak için (C10=120 üstte, C0=12 altta)
};

// LOD (Level of Detail) Ayarları - Grid çizimi için
export const LOD_CONFIG = {
  // 1 tick'in kaç piksel kapladığına göre detay seviyeleri
  ZOOM_THRESHOLDS: {
    DETAILED: 1.0,     // 1/16'lık çizgiler görünür
    NORMAL: 0.2,       // 1/4'lük çizgiler görünür
    SIMPLIFIED: 0.05,  // Sadece ölçü çizgileri görünür
  },
};

// Snap Değerleri (TICK cinsinden)
// "1/4" => Bir dörtlük nota, "1/8" => Bir sekizlik nota etc.
export const SNAP_CONFIG = {
  '1/4': MUSIC_CONFIG.TICKS_PER_QUARTER_NOTE,
  '1/8': MUSIC_CONFIG.TICKS_PER_QUARTER_NOTE / 2,
  '1/16': MUSIC_CONFIG.TICKS_PER_QUARTER_NOTE / 4,
  '1/32': MUSIC_CONFIG.TICKS_PER_QUARTER_NOTE / 8,
};