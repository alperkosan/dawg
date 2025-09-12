import { create } from 'zustand';
import * as Tone from 'tone';

let player = null;
const waveformCache = new Map();

const getPlayer = (set) => {
    if (!player) {
        player = new Tone.Player().toDestination();
        player.onstop = () => {
            set({ isPlaying: false, playingUrl: null });
        };
    }
    return player;
};

const loadWaveform = async (url, set) => {
    if (waveformCache.has(url)) {
        set({ waveformBuffer: waveformCache.get(url), error: null, loadingUrl: null });
        return;
    }
    try {
        // --- GÜNCELLEME: new Tone.ToneAudioBuffer(url).load() yerine
        // Tone.Buffer.load(url) kullanarak daha güvenilir bir yükleme yapıyoruz.
        const buffer = await Tone.Buffer.load(url);
        // Tone.Buffer.load, standart bir AudioBuffer döndürür, bunu
        // WaveformDisplay'in beklediği ToneAudioBuffer'a çeviriyoruz.
        const toneAudioBuffer = new Tone.ToneAudioBuffer(buffer);
        waveformCache.set(url, toneAudioBuffer);
        
        set(state => {
            if (state.loadingUrl === url) {
                return { waveformBuffer: toneAudioBuffer, error: null, loadingUrl: null };
            }
            return {};
        });
    } catch (err) {
        console.error("Dalga formu yüklenemedi:", url, err);
        
        // --- GÜNCELLEME: Hata mesajını daha anlaşılır hale getiriyoruz ---
        let errorMessage = 'Dalga formu yüklenemedi.';
        if (err instanceof Error && err.name === 'EncodingError') {
            errorMessage = 'Ses dosyası bozuk veya desteklenmiyor.';
        }

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

  selectFileForPreview: (url) => {
    const state = get();
    if (state.loadingUrl === url) return;
    if (!url) {
        set({ waveformBuffer: null, error: null, loadingUrl: null });
        return;
    }

    if (waveformCache.has(url)) {
        set({ waveformBuffer: waveformCache.get(url), error: null, loadingUrl: null });
        return;
    }
    
    set({ loadingUrl: url, waveformBuffer: null, error: null });
    loadWaveform(url, set);
  },

  playPreview: (url) => {
    const previewPlayer = getPlayer(set);
    const { playingUrl } = get();

    if (previewPlayer.state === 'started' && playingUrl === url) {
      previewPlayer.stop();
      return;
    }
    
    if (previewPlayer.state === 'started') {
      previewPlayer.stop();
    }

    if (waveformCache.has(url)) {
        // Tone.Player hem AudioBuffer hem de ToneAudioBuffer ile çalışabilir.
        previewPlayer.buffer = waveformCache.get(url).get(); 
        previewPlayer.start();
        set({ isPlaying: true, playingUrl: url });
    } else {
        console.warn("Önizleme için buffer yükleniyor, lütfen bekleyin:", url);
        loadWaveform(url, set).then(() => {
            if (waveformCache.has(url)) {
                previewPlayer.buffer = waveformCache.get(url).get();
                previewPlayer.start();
                set({ isPlaying: true, playingUrl: url });
            }
        });
    }
  },

  stopPreview: () => {
    const previewPlayer = getPlayer(set);
    if (previewPlayer && previewPlayer.state === 'started') {
      previewPlayer.stop();
    }
  },
}));

