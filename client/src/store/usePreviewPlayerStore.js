// src/store/usePreviewPlayerStore.js
// Yeniden programlanmış preview player - buffer management ve cache optimizasyonları
import { create } from 'zustand';
import { decodeAudioData, setGlobalAudioContext } from '@/lib/utils/audioUtils';
import { apiClient } from '@/services/api.js';

// Audio context singleton
let audioContext = null;
let previewSource = null;

// Cache management - max 50 dosya, LRU mantığı
const MAX_CACHE_SIZE = 50;
const bufferCache = new Map(); // url -> { buffer, lastAccess, size }
let totalCacheSize = 0; // bytes

const getAudioContext = () => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    setGlobalAudioContext(audioContext);
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(err => console.warn('AudioContext resume failed:', err));
  }
  return audioContext;
};

/**
 * Cache'ten en az kullanılan buffer'ı sil (LRU eviction)
 */
const evictOldestBuffer = () => {
  if (bufferCache.size === 0) return;

  let oldestUrl = null;
  let oldestTime = Infinity;

  for (const [url, data] of bufferCache.entries()) {
    if (data.lastAccess < oldestTime) {
      oldestTime = data.lastAccess;
      oldestUrl = url;
    }
  }

  if (oldestUrl) {
    const evicted = bufferCache.get(oldestUrl);
    totalCacheSize -= evicted.size;
    bufferCache.delete(oldestUrl);
    console.log(`[PreviewCache] Evicted: ${oldestUrl} (${(evicted.size / 1024).toFixed(1)}KB)`);
  }
};

/**
 * Cache boyutunu kontrol et ve gerekirse temizle
 */
const manageCacheSize = () => {
  while (bufferCache.size >= MAX_CACHE_SIZE) {
    evictOldestBuffer();
  }
};

/**
 * Buffer'ı cache'e ekle ve access time güncelle
 * @param {string} cacheKey - Cache key (url veya url:preview veya url:full)
 * @param {AudioBuffer} buffer - Audio buffer to cache
 */
const addToCache = (cacheKey, buffer) => {
  const size = buffer.length * buffer.numberOfChannels * 4; // 32-bit float
  manageCacheSize();

  bufferCache.set(cacheKey, {
    buffer,
    lastAccess: Date.now(),
    size
  });
  totalCacheSize += size;

  console.log(`[PreviewCache] Cached: ${cacheKey} (${(size / 1024).toFixed(1)}KB) - Total: ${bufferCache.size} files, ${(totalCacheSize / 1024 / 1024).toFixed(2)}MB`);
};

/**
 * Cache'ten buffer al ve access time güncelle
 * @param {string} cacheKey - Cache key (url veya url:preview veya url:full)
 */
const getFromCache = (cacheKey) => {
  const cached = bufferCache.get(cacheKey);
  if (cached) {
    cached.lastAccess = Date.now();
    return cached.buffer;
  }
  return null;
};

/**
 * Preview için Range Request ile sadece ilk 2 saniye yükle
 * @param {string} url - Audio file URL
 * @param {number} duration - Preview duration in seconds (default: 2)
 * @returns {Promise<ArrayBuffer>}
 */
/**
 * ✅ FIX: Normalize URL to use backend proxy for system assets and user assets (avoids CORS)
 */
function normalizePreviewUrl(url) {
  // If already an API endpoint, return as is
  if (url.includes('/api/assets/')) {
    return url;
  }
  
  // ✅ FIX: System assets from CDN -> use backend proxy endpoint
  // Extract assetId from CDN URL pattern: .../system-assets/.../{assetId}/filename
  if (url.includes('dawg.b-cdn.net/system-assets') || url.includes('system-assets/')) {
    // Try to extract assetId from URL
    // Pattern: .../system-assets/.../{assetId}/filename
    const match = url.match(/system-assets\/[^/]+\/[^/]+\/([a-f0-9-]{36})\//);
    if (match && match[1]) {
      const assetId = match[1];
      return `${apiClient.baseURL}/assets/system/${assetId}/file`;
    }
  }
  
  // ✅ FIX: User assets from CDN -> use backend proxy endpoint
  // Extract assetId from CDN URL pattern: .../user-assets/.../{year-month}/{assetId}/filename
  if (url.includes('dawg.b-cdn.net/user-assets') || url.includes('user-assets/')) {
    // Try to extract assetId from URL
    // Pattern: .../user-assets/{userId}/{year-month}/{assetId}/filename
    const match = url.match(/user-assets\/[^/]+\/[^/]+\/([a-f0-9-]{36})\//);
    if (match && match[1]) {
      const assetId = match[1];
      return `${apiClient.baseURL}/assets/${assetId}/file`;
    }
  }
  
  return url;
}

const loadPreviewRange = async (url, duration = 2, signal) => {
  // ✅ FIX: Normalize URL to use backend proxy for system assets
  const normalizedUrl = normalizePreviewUrl(url);
  
  const sampleRate = 44100;
  const bytesPerSample = 2; // 16-bit
  const channels = 2; // stereo
  const bytesPerSecond = sampleRate * bytesPerSample * channels;
  const previewSize = bytesPerSecond * duration; // ~352KB for 2 seconds
  
  // ✅ FIX: For small files (< 1MB), load full file instead of Range request
  // This is more reliable and avoids WAV header issues
  const MAX_PREVIEW_SIZE = 1024 * 1024; // 1MB
  
  const headers = {};
  if (normalizedUrl.includes('/api/assets/')) {
    const { useAuthStore } = await import('@/store/useAuthStore.js');
    const token = useAuthStore.getState().accessToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  // ✅ FIX: Try Range request first, but validate WAV header
  // If preview size is small enough, just load full file
  if (previewSize < MAX_PREVIEW_SIZE) {
    // Try Range request for preview
    headers['Range'] = `bytes=0-${previewSize - 1}`;
  
    try {
  const response = await fetch(normalizedUrl, { 
    signal,
    headers
  });
  
  if (response.status === 206) {
    // Partial Content - Range request başarılı
        const arrayBuffer = await response.arrayBuffer();
        
        // ✅ FIX: Validate that we got WAV header (first 4 bytes should be "RIFF")
        if (arrayBuffer.byteLength >= 4) {
          const view = new Uint8Array(arrayBuffer);
          const isWav = view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46; // "RIFF"
          
          if (isWav) {
            console.log(`[PreviewCache] Range request successful: ${arrayBuffer.byteLength} bytes with valid WAV header`);
            return arrayBuffer;
          } else {
            console.warn('[PreviewCache] Range request response does not start with WAV header, loading full file');
          }
        }
  } else if (response.status === 200) {
        // Full content - Range request desteklenmiyor
        console.log('[PreviewCache] Range request not supported, got full file');
    return await response.arrayBuffer();
      }
    } catch (error) {
      console.warn('[PreviewCache] Range request failed, falling back to full load:', error);
    }
  }
  
  // ✅ FIX: Fallback to full file load (more reliable for preview)
  console.log('[PreviewCache] Loading full file for preview');
  const fullResponse = await fetch(normalizedUrl, { 
    signal,
    headers: headers['Authorization'] ? { 'Authorization': headers['Authorization'] } : {}
  });
  
  if (!fullResponse.ok) {
    throw new Error(`HTTP ${fullResponse.status}: ${fullResponse.statusText}`);
  }
  
  return await fullResponse.arrayBuffer();
};

/**
 * Desteklenen audio uzantıları
 */
const SUPPORTED_AUDIO_EXTENSIONS = ['wav', 'wave', 'mp3', 'ogg', 'oga', 'm4a', 'aac', 'flac'];

const getFileExtension = (url = '') => {
  try {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const parts = cleanUrl.split('.');
    if (parts.length <= 1) return '';
    return parts.pop().toLowerCase();
  } catch (error) {
    return '';
  }
};

const isLikelyWavBuffer = (arrayBuffer) => {
  if (!arrayBuffer || arrayBuffer.byteLength < 4) return false;
  const view = new Uint8Array(arrayBuffer, 0, 4);
  return view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46; // RIFF
};

/**
 * Full audio buffer yükle (projeye eklenen sample'lar için)
 * @param {string} url - Audio file URL
 * @returns {Promise<ArrayBuffer>}
 */
const loadFullBuffer = async (url, signal) => {
  // ✅ FIX: Normalize URL to use backend proxy for system assets
  const normalizedUrl = normalizePreviewUrl(url);
  
  const headers = {};
  if (normalizedUrl.includes('/api/assets/')) {
    const { useAuthStore } = await import('@/store/useAuthStore.js');
    const token = useAuthStore.getState().accessToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  const response = await fetch(normalizedUrl, { 
    signal,
    headers
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return await response.arrayBuffer();
};

/**
 * Ses dosyasını yükle ve decode et
 * @param {boolean} fullLoad - Full buffer yükle (false = preview için 2 saniye)
 */
const loadAudioBuffer = async (url, set, get, fullLoad = false) => {
    // Cache'te var mı kontrol et
    const cacheKey = fullLoad ? `${url}:full` : `${url}:preview`;
    const cachedBuffer = getFromCache(cacheKey);
    if (cachedBuffer) {
      console.log(`[PreviewCache] Hit: ${cacheKey}`);
      set({
        waveformBuffer: cachedBuffer,
        error: null,
        loadingUrl: null,
        currentFileUrl: url
      });
      await Promise.resolve();
      return;
    }

    console.log(`[PreviewCache] Miss: ${cacheKey} - Loading ${fullLoad ? 'full' : 'preview'}...`);

    // AbortController ile iptal edilebilir fetch
    const controller = new AbortController();
    set({ abortController: controller });

    try {
        // ✅ Always load full file (Range request causes decode issues with some formats)
        const arrayBuffer = await loadFullBuffer(url, controller.signal);
        
        // ✅ FIX: Validate arrayBuffer before decoding
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error('Empty audio buffer received');
        }
        
        console.log(`[PreviewCache] Decoding audio buffer: ${arrayBuffer.byteLength} bytes`);
        
        const fileExtension = getFileExtension(url);
        const shouldBeWav = ['wav', 'wave'].includes(fileExtension);
        const bufferLooksWav = isLikelyWavBuffer(arrayBuffer);
        
        const context = getAudioContext();
        
        // ✅ FIX: Decode with better error handling and validation
        let audioBuffer;
        try {
          // ✅ FIX: Create a copy of the buffer to avoid any potential issues
          const bufferCopy = arrayBuffer.slice(0);
          
          // ✅ WAV yapısını yalnızca gerçekten WAV dosyası beklediğimizde doğrula
          if (shouldBeWav && bufferCopy.byteLength >= 44) {
            const view = new Uint8Array(bufferCopy);
            const riffBytes = [view[0], view[1], view[2], view[3]];
            const waveBytes = [view[8], view[9], view[10], view[11]];
            const riff = String.fromCharCode(...riffBytes);
            const wave = String.fromCharCode(...waveBytes);
            
            if (riff !== 'RIFF' || wave !== 'WAVE') {
              console.warn(`[PreviewCache] Invalid WAV structure for ${url}: RIFF=${riff}, WAVE=${wave}`);
              console.warn(`[PreviewCache] First 44 bytes: ${Array.from(view.slice(0, 44)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
            }
          }
          
          audioBuffer = await decodeAudioData(bufferCopy);
        } catch (decodeError) {
          console.error(`[PreviewCache] Decode error details:`, {
            error: decodeError.message,
            errorName: decodeError.name,
            bufferSize: arrayBuffer.byteLength,
            firstBytes: arrayBuffer.byteLength >= 44 
              ? Array.from(new Uint8Array(arrayBuffer.slice(0, 44))).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
              : 'too small',
            extension: fileExtension || 'unknown',
            looksLikeWav: bufferLooksWav
          });
          
          if (decodeError.name === 'EncodingError') {
            const baseMessage = `Failed to decode audio: ${decodeError.message}.`;
            if (shouldBeWav || bufferLooksWav) {
              throw new Error(`${baseMessage} This might be due to incomplete WAV data. Buffer size: ${arrayBuffer.byteLength} bytes`);
            }
            throw new Error(`${baseMessage} File type: ${fileExtension || 'unknown'}.`);
          }
          throw decodeError;
        }

        // Cache'e ekle (preview ve full ayrı cache'lenir)
        addToCache(cacheKey, audioBuffer);

        // State güncelle (sadece hala aynı dosya yükleniyorsa)
        const currentState = get();
        if (currentState.loadingUrl === url) {
          set({
            waveformBuffer: audioBuffer,
            error: null,
            loadingUrl: null,
            currentFileUrl: url
          });
        }
    } catch (err) {
        if (err.name === 'AbortError') {
          console.log(`[PreviewCache] Aborted: ${url}`);
          return;
        }

        console.error('[PreviewCache] Load failed:', url, err);

        const currentState = get();
        if (currentState.loadingUrl === url) {
          set({
            error: 'Failed to load audio file',
            waveformBuffer: null,
            loadingUrl: null,
            currentFileUrl: null
          });
        }
    }
};

export const usePreviewPlayerStore = create((set, get) => ({
  // State
  isPlaying: false,
  playingUrl: null,
  loadingUrl: null,
  currentFileUrl: null,
  waveformBuffer: null,
  error: null,
  abortController: null,

  /**
   * Dosya seçildiğinde buffer'ı yükle
   * @param {string} url - Audio file URL
   * @param {boolean} fullLoad - Full buffer yükle (default: false = preview için 2 saniye)
   */
  selectFileForPreview: (url, fullLoad = false) => {
    const state = get();

    // Önceki yüklemeyi iptal et
    if (state.abortController) {
      state.abortController.abort();
      set({ abortController: null });
    }

    // Eğer çalan ses varsa durdur
    if (previewSource) {
      previewSource.stop();
      previewSource.disconnect();
      previewSource = null;
    }

    // Dosya seçilmemişse temizle
    if (!url) {
      set({
        waveformBuffer: null,
        error: null,
        loadingUrl: null,
        currentFileUrl: null,
        isPlaying: false,
        playingUrl: null
      });
      return;
    }

    // Aynı dosya zaten yüklüyse skip et (full load isteniyorsa ve preview yüklüyse tekrar yükle)
    if (state.currentFileUrl === url && state.waveformBuffer) {
      // Full load isteniyorsa ama preview yüklüyse tekrar yükle
      if (fullLoad) {
        const cacheKey = `${url}:full`;
        const fullBuffer = getFromCache(cacheKey);
        if (!fullBuffer) {
          // Full buffer yok, yükle
          set({
            loadingUrl: url,
            error: null,
            isPlaying: false,
            playingUrl: null
          });
          loadAudioBuffer(url, set, get, true);
        }
      }
      return;
    }

    // Yeni dosya yükle
    set({
      loadingUrl: url,
      error: null,
      isPlaying: false,
      playingUrl: null
    });

    loadAudioBuffer(url, set, get, fullLoad);
  },

  /**
   * Preview'ı çal/durdur
   */
  playPreview: (url) => {
    const state = get();
    const context = getAudioContext();

    // Toggle: Aynı dosya çalıyorsa durdur
    if (state.isPlaying && state.playingUrl === url) {
      if (previewSource) {
        previewSource.stop();
        previewSource.disconnect();
        previewSource = null;
      }
      set({ isPlaying: false, playingUrl: null });
      return;
    }

    // Farklı bir dosya çalıyorsa önce onu durdur
    if (previewSource) {
      previewSource.stop();
      previewSource.disconnect();
      previewSource = null;
    }

    // Buffer hazır değilse cache'ten al veya yükle
    let bufferToPlay = state.waveformBuffer;

    // Eğer farklı dosya çalınmak isteniyorsa cache'ten al
    if (state.currentFileUrl !== url) {
      // Önce full cache'inden kontrol et (daha iyi kalite), yoksa preview cache'inden
      bufferToPlay = getFromCache(`${url}:full`) || getFromCache(`${url}:preview`);

      if (!bufferToPlay) {
        console.log('[PreviewPlayer] Buffer not ready, loading preview first...');
        // ✅ FIX: Load and auto-play WITHOUT recursive call
        set({ loadingUrl: url, error: null });
        loadAudioBuffer(url, set, get, false).then(() => {
          // Yükleme bitince otomatik çal (direkt, recursive call yok!)
          const newState = get();
          const loadedBuffer = newState.waveformBuffer;

          console.log('[PreviewPlayer] Load complete:', {
            requestedUrl: url,
            currentUrl: newState.currentFileUrl,
            hasBuffer: !!loadedBuffer,
            match: newState.currentFileUrl === url
          });

          // ✅ FIX: Distinguish between load failure and URL change
          if (!loadedBuffer) {
            console.error('[PreviewPlayer] Buffer load failed for:', url);
            return;
          }

          if (newState.currentFileUrl !== url) {
            console.log('[PreviewPlayer] URL changed during load, skipping auto-play for:', url);
            return;
          }

          // Direkt çal - playPreview'i tekrar çağırma!
          try {
            const context = getAudioContext();

            // Önceki preview'ı durdur
            if (previewSource) {
              previewSource.stop();
              previewSource.disconnect();
              previewSource = null;
            }

            previewSource = context.createBufferSource();
            previewSource.buffer = loadedBuffer;
            previewSource.connect(context.destination);

            previewSource.onended = () => {
              const currentState = get();
              if (currentState.playingUrl === url) {
                set({ isPlaying: false, playingUrl: null });
              }
              previewSource = null;
            };

            previewSource.start(0);
            set({ isPlaying: true, playingUrl: url });
            console.log(`[PreviewPlayer] Auto-playing after load: ${url}`);
          } catch (err) {
            console.error('[PreviewPlayer] Auto-play failed:', err);
            set({ error: 'Playback failed', isPlaying: false });
          }
        }).catch(err => {
          console.error('[PreviewPlayer] Load failed:', err);
        });
        return;
      }
    }

    // Buffer yoksa çalma
    if (!bufferToPlay) {
      console.warn('[PreviewPlayer] Buffer not available');
      return;
    }

    // Çalmaya başla
    try {
      previewSource = context.createBufferSource();
      previewSource.buffer = bufferToPlay;
      previewSource.connect(context.destination);

      previewSource.onended = () => {
        const currentState = get();
        if (currentState.playingUrl === url) {
          set({ isPlaying: false, playingUrl: null });
        }
        previewSource = null;
      };

      previewSource.start(0);
      set({ isPlaying: true, playingUrl: url });
      console.log(`[PreviewPlayer] Playing: ${url}`);
    } catch (err) {
      console.error('[PreviewPlayer] Playback error:', err);
      set({ error: 'Playback failed', isPlaying: false });
    }
  },

  /**
   * Preview'ı durdur
   */
  stopPreview: () => {
    if (previewSource) {
      previewSource.stop();
      previewSource.disconnect();
      previewSource = null;
    }
    set({ isPlaying: false, playingUrl: null });
  },

  /**
   * Cache'i temizle (development/debug için)
   */
  clearCache: () => {
    bufferCache.clear();
    totalCacheSize = 0;
    console.log('[PreviewCache] Cache cleared');
  },

  /**
   * Cache istatistiklerini al
   */
  getCacheStats: () => {
    return {
      size: bufferCache.size,
      totalBytes: totalCacheSize,
      totalMB: (totalCacheSize / 1024 / 1024).toFixed(2),
      files: Array.from(bufferCache.keys())
    };
  }
}));

// Development helper - console'dan erişim için
if (typeof window !== 'undefined') {
  window.__previewPlayer = {
    getStats: () => {
      const stats = usePreviewPlayerStore.getState().getCacheStats();
      console.table(Array.from(bufferCache.entries()).map(([url, data]) => ({
        File: url.split('/').pop(),
        'Size (KB)': (data.size / 1024).toFixed(1),
        'Last Access': new Date(data.lastAccess).toLocaleTimeString()
      })));
      console.log(`Total: ${stats.size} files, ${stats.totalMB} MB`);
      return stats;
    },
    clearCache: () => {
      usePreviewPlayerStore.getState().clearCache();
      console.log('✅ Preview cache cleared');
    }
  };
}
