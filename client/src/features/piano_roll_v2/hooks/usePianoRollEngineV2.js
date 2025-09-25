/**
 * @file usePianoRollEngineV2.js
 * @description Piano Roll için gelişmiş, yüksek performanslı ve sanallaştırılmış bir "motor" oluşturan React hook'u.
 * Bu hook, tüm boyut, pozisyon ve koordinat dönüşüm hesaplamalarından sorumludur.
 * UI sanallaştırma teknikleri kullanarak binlerce bar'lık bir alanı bile akıcı bir şekilde yönetir.
 */
import { useState, useMemo, useLayoutEffect, useCallback, useRef } from 'react';
import { usePianoRollStoreV2, NOTES } from '../store/usePianoRollStoreV2';
import { getRectangle, releaseRectangle } from '../../../lib/utils/objectPool';
import { NativeTimeUtils } from '../../../lib/utils/NativeTimeUtils';
import { usePlaybackStore } from '../../../store/usePlaybackStore';

// --- SABİTLER ---
const KEYBOARD_WIDTH = 80; // Sol taraftaki piyano klavyesinin genişliği
const RULER_HEIGHT = 32;   // Üstteki zaman cetvelinin yüksekliği
const TOTAL_KEYS = 12 * 9; // C0'dan B8'e kadar olan toplam tuşe sayısı
const TOTAL_BARS = 1000;   // Desteklenecek maksimum bar sayısı

/**
 * Piano Roll'un tüm hesaplama ve pozisyonlama mantığını yöneten merkezi hook.
 * @param {React.RefObject} containerRef - Ana kaydırılabilir alanın referansı.
 * @returns {object} Piano Roll bileşenlerinin ihtiyaç duyduğu tüm hesaplanmış değerleri ve fonksiyonları içeren "motor" nesnesi.
 */
export const usePianoRollEngineV2 = (containerRef) => {
  // --- STATE VE REFLER ---

  // Zustand store'dan sadece zoom seviyelerini alıyoruz.
  // Bu, motorun sadece zoom değiştiğinde yeniden hesaplama yapmasını sağlar.
  const zoomX = usePianoRollStoreV2(state => state.zoomX);
  const zoomY = usePianoRollStoreV2(state => state.zoomY);
  const { bpm } = usePlaybackStore.getState();

  // Scroll pozisyonunu re-render tetiklemeden saklamak için useRef kullanıyoruz.
  // Bu, `requestAnimationFrame` içinde en güncel pozisyonu almamızı sağlar.
  const scrollRef = useRef({ x: 0, y: 0 });
  
  // Viewport (görünür alan) boyutlarını saklamak için state.
  const [size, setSize] = useState({ width: 0, height: 0 });
  
  // Tarayıcıya devasa bir kaydırma alanı olduğunu söyleyen görünmez "hayalet" div'in referansı.
  const virtualScrollerRef = useRef(null);

  // --- ANA HESAPLAMA BLOĞU ---

  /**
   * Piano Roll'un tüm temel boyutlarını hesaplar.
   * Bu `useMemo`, sadece zoom veya viewport boyutu değiştiğinde çalışır,
   * böylece her scroll olayında yeniden hesaplama yapılmaz.
   */
  const dimensions = useMemo(() => {
    const keyHeight = 20 * zoomY;
    const stepWidth = 40 * zoomX; // Bir 16'lık notanın piksel genişliği
    
    // Sanal grid'in toplam boyutları
    const totalSteps = TOTAL_BARS * 16;
    const gridWidth = totalSteps * stepWidth;
    const gridHeight = TOTAL_KEYS * keyHeight;

    return {
      keyHeight,
      stepWidth,
      gridWidth,
      gridHeight,
      totalKeys: TOTAL_KEYS,
      keyboardWidth: KEYBOARD_WIDTH,
      rulerHeight: RULER_HEIGHT,
      totalSteps,
    };
  }, [zoomX, zoomY, size.width, size.height]);

  // --- DOM ETKİLEŞİMİ VE OLAY DİNLEYİCİLERİ ---

  /**
   * Bu `useLayoutEffect`, DOM üzerinde doğrudan manipülasyonlar yapar:
   * 1. Sanal kaydırma alanının boyutunu ayarlar.
   * 2. Ana konteynerin `resize` ve `scroll` olaylarını dinler.
   */
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Sanal kaydırma div'ini oluştur veya bul.
    if (!virtualScrollerRef.current) {
      const scroller = document.createElement('div');
      scroller.className = 'prv2-virtual-scroll-area';
      scroller.style.cssText = `position: absolute; top: 0; left: 0; pointer-events: none; visibility: hidden; z-index: -1;`;
      container.appendChild(scroller);
      virtualScrollerRef.current = scroller;
    }
    
    // Sanal kaydırma div'inin boyutlarını güncelle.
    virtualScrollerRef.current.style.width = `${dimensions.gridWidth}px`;
    virtualScrollerRef.current.style.height = `${dimensions.gridHeight}px`;

    // Scroll olayını performans için `requestAnimationFrame` ile yönet.
    let rafId = null;
    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        scrollRef.current = { x: container.scrollLeft, y: container.scrollTop };
        // Not: Scroll pozisyonunu state'e yazmıyoruz! Bu, gereksiz render'ları önler.
        // Diğer bileşenler scroll pozisyonunu her zaman `engine.scroll` üzerinden alacak.
      });
    };
    
    // Viewport boyutunu `ResizeObserver` ile takip et.
    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    resizeObserver.observe(container);
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Başlangıç boyutunu ayarla.
    setSize({ width: container.clientWidth, height: container.clientHeight });

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
      if (virtualScrollerRef.current && container.contains(virtualScrollerRef.current)) {
        container.removeChild(virtualScrollerRef.current);
        virtualScrollerRef.current = null;
      }
    };
  }, [containerRef, dimensions.gridWidth, dimensions.gridHeight]);

  // --- KOORDİNAT DÖNÜŞÜM FONKSİYONLARI ---

  /**
   * Tüm koordinat dönüşüm fonksiyonlarını içeren memoize edilmiş nesne.
   * Sadece `dimensions` değiştiğinde yeniden oluşturulur.
   */
  const converters = useMemo(() => {
    // Pitch (örn: "C#4") -> MIDI index (0-127 arası)
    const pitchToIndex = (pitch) => {
      if (!pitch) return 0;
      const noteName = pitch.replace(/[\d-]/g, '');
      const octave = parseInt(pitch.replace(/[^\d-]/g, ''), 10) || 0;
      const noteIndex = NOTES.indexOf(noteName);
      return noteIndex === -1 ? 0 : octave * 12 + noteIndex;
    };

    // MIDI index -> Pitch
    const indexToPitch = (index) => {
      const noteIndex = index % 12;
      const octave = Math.floor(index / 12);
      return `${NOTES[noteIndex]}${octave}`;
    };

    // Müzik zamanı (step) -> Piksel X-koordinatı
    const timeToX = (time) => time * dimensions.stepWidth;

    // Piksel X-koordinatı -> Müzik zamanı (step)
    const xToTime = (x) => x / dimensions.stepWidth;

    // Pitch -> Piksel Y-koordinatı
    const pitchToY = (pitch) => (TOTAL_KEYS - 1 - pitchToIndex(pitch)) * dimensions.keyHeight;
    
    // Piksel Y-koordinatı -> Pitch
    const yToPitch = (y) => {
      const keyIndex = TOTAL_KEYS - 1 - Math.floor(y / dimensions.keyHeight);
      const clampedIndex = Math.max(0, Math.min(TOTAL_KEYS - 1, keyIndex));
      return indexToPitch(clampedIndex);
    };

    /**
     * Bir nota nesnesinin ekrandaki pozisyonunu ve boyutunu hesaplar.
     * Performans için "Object Pooling" tekniğini kullanır.
     */
    const getNoteRect = (note) => {
      const x = timeToX(note.time);
      const y = pitchToY(note.pitch);

      // Süreyi (örn: "8n", "4n.") step birimine çevir.
      const durationInSeconds = NativeTimeUtils.parseTime(note.duration, bpm);
      const sixteenthNoteSeconds = NativeTimeUtils.parseTime('16n', bpm);
      const durationInSteps = durationInSeconds / sixteenthNoteSeconds;
      
      const width = Math.max(4, durationInSteps * dimensions.stepWidth - 1);

      // Bellek yönetimini optimize etmek için bir nesne havuzundan geçici bir nesne al.
      const rect = getRectangle(x, y, width, dimensions.keyHeight - 1);
      
      // Kopyasını döndür, çünkü orijinal nesne havuza geri dönecek.
      const result = { ...rect };
      releaseRectangle(rect); // Nesneyi hemen havuza geri bırak.

      return result;
    };

    return { timeToX, xToTime, pitchToY, yToPitch, getNoteRect, pitchToIndex, indexToPitch };
  }, [dimensions, bpm]);

  /**
   * Fare olayının (mouse event) koordinatlarını Piano Roll grid'indeki
   * müzikal zamana ve pitch'e çevirir.
   */
  const mouseToGrid = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();

    const x = e.clientX - rect.left + scrollRef.current.x;
    const y = e.clientY - rect.top + scrollRef.current.y;

    const time = converters.xToTime(x);
    const pitch = converters.yToPitch(y);

    return { x, y, time: Math.max(0, time), pitch };
  }, [containerRef, converters]);

  // --- HOOK'UN DÖNDÜRDÜĞÜ "MOTOR" NESNESİ ---

  /**
   * Bu `useMemo`, hook'un dış dünyaya sunduğu nihai "motor" nesnesini oluşturur.
   * Bağımlılık dizisi, gereksiz yeniden render'ları önlemek için dikkatle seçilmiştir.
   * Scroll pozisyonu gibi sık değişen değerler, state yerine `scrollRef` üzerinden
   * anlık olarak sağlandığı için bu `useMemo` sürekli tetiklenmez.
   */
  return useMemo(() => ({
    // Boyutlar ve sabitler
    ...dimensions,

    // Anlık durumlar (state yerine ref'ten okunur)
    scroll: scrollRef.current,
    size,

    // Yardımcı fonksiyonlar
    ...converters,
    mouseToGrid,

    // Motorun hazır olup olmadığını belirtir
    isInitialized: size.width > 0,
    
  }), [dimensions, size, converters, mouseToGrid]);
};
