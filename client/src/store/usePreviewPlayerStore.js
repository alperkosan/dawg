// src/store/usePreviewPlayerStore.js
// Tone.js bağımlılığı kaldırıldı, Native Web Audio API ve kendi audioUtils'lerimiz kullanılıyor.
import { create } from 'zustand';
import { decodeAudioData, setGlobalAudioContext } from '@/lib/utils/audioUtils';

let audioContext = null;
let previewSource = null;
const waveformCache = new Map();

const getAudioContext = () => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    setGlobalAudioContext(audioContext); // audioUtils'in de bu context'i kullanmasını sağla
  }
  return audioContext;
};

/**
 * Verilen URL'den ses dosyasını yükler, AudioBuffer'a çevirir ve cache'ler.
 * @param {string} url - Yüklenecek ses dosyasının URL'si.
 * @param {Function} set - Zustand set fonksiyonu.
 */
const loadAudioBuffer = async (url, set) => {
    if (waveformCache.has(url)) {
        set({ waveformBuffer: waveformCache.get(url), error: null, loadingUrl: null });
        return;
    }
    
    // AbortController, kullanıcı başka bir dosyaya tıkladığında
    // devam eden indirme işlemini iptal etmek için kullanılır.
    const controller = new AbortController();
    const signal = controller.signal;
    set(state => ({ ...state, abortController: controller }));

    try {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        
        const context = getAudioContext();
        const audioBuffer = await decodeAudioData(arrayBuffer.slice(0)); // slice(0) ile kopyasını oluşturuyoruz

        waveformCache.set(url, audioBuffer);
        
        set(state => {
            if (state.loadingUrl === url) {
                return { waveformBuffer: audioBuffer, error: null, loadingUrl: null };
            }
            return {};
        });
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log(`Yükleme bilinçli olarak iptal edildi: ${url}`);
            return;
        }
        
        console.error("AudioBuffer yüklenemedi:", url, err);
        let errorMessage = 'Ses dosyası yüklenemedi veya bozuk.';
        
        set(state => {
            if (state.loadingUrl === url) {
                return { error: errorMessage, waveformBuffer: null, loadingUrl: null };
            }
            return {};
        });
    }
};

export const usePreviewPlayerStore = create((set, get) => ({
  isPlaying: false,
  playingUrl: null,
  loadingUrl: null,
  waveformBuffer: null,
  error: null,
  abortController: null,

  selectFileForPreview: (url) => {
    const { loadingUrl, abortController } = get();

    // Devam eden bir yükleme varsa iptal et.
    if (abortController) {
      abortController.abort();
    }

    if (!url) {
        set({ waveformBuffer: null, error: null, loadingUrl: null, abortController: null });
        return;
    }
    
    set({ loadingUrl: url, waveformBuffer: null, error: null });
    loadAudioBuffer(url, set);
  },

  playPreview: (url) => {
    const { isPlaying, playingUrl, waveformBuffer } = get();
    const context = getAudioContext();

    if (context.state === 'suspended') {
      context.resume();
    }
    
    // Mevcut sesi durdur.
    if (previewSource) {
      previewSource.stop();
      previewSource.disconnect();
      previewSource = null;
    }

    if (isPlaying && playingUrl === url) {
      set({ isPlaying: false, playingUrl: null });
      return;
    }

    if (waveformBuffer && waveformCache.has(url)) {
        previewSource = context.createBufferSource();
        previewSource.buffer = waveformBuffer;
        previewSource.connect(context.destination);
        previewSource.onended = () => {
            if (get().playingUrl === url) {
                set({ isPlaying: false, playingUrl: null });
            }
        };
        previewSource.start(0);
        set({ isPlaying: true, playingUrl: url });
    } else {
        console.warn("Önizleme için buffer henüz hazır değil, bekleniyor...");
        // Buffer yüklendiğinde otomatik olarak çalmasını sağlayabiliriz.
    }
  },

  stopPreview: () => {
    if (previewSource) {
      previewSource.stop();
    }
  },
}));
