import { eventBus } from '../core/EventBus';

/**
 * Çalma (Playback) ile ilgili iş mantığını yönetir.
 * UI katmanından gelen istekleri alır ve bunları ses motorunun anlayacağı
 * olaylara dönüştürerek EventBus'a yayınlar.
 * Ayrıca ses motorundan gelen durum güncellemelerini dinleyerek
 * UI katmanının kullanabileceği bir state'i yönetir. (Örn: Zustand store'unu günceller)
 */
class PlaybackService {
  constructor() {
    this.isPlaying = false;
    this.isReady = false;

    // Ses motorundan gelen durumları dinle
    eventBus.on('playback:status', (status) => this._handlePlaybackStatus(status));
    eventBus.on('audioEngine:status', (status) => this._handleEngineStatus(status));
  }

  /**
   * UI'dan çalma komutu geldiğinde tetiklenir.
   */
  play() {
    if (this.isReady && !this.isPlaying) {
      eventBus.emit('playback:play');
    }
  }

  /**
   * UI'dan duraklatma komutu geldiğinde tetiklenir.
   */
  pause() {
    if (this.isReady && this.isPlaying) {
      eventBus.emit('playback:pause');
    }
  }

  /**
   * UI'dan durdurma komutu geldiğinde tetiklenir.
   */
  stop() {
    if (this.isReady) {
      eventBus.emit('playback:stop');
    }
  }
  
  /**
   * Ses motorunun durumunu günceller.
   * @param {object} status - { isReady: boolean, error?: string }
   * @private
   */
  _handleEngineStatus(status) {
      this.isReady = status.isReady;
      if (!this.isReady) {
          console.error("Playback Service: Audio Engine is not ready.", status.error);
      }
      // UI'ı bilgilendir (örn: Zustand store'unu güncelle)
      // useAppStore.setState({ isEngineReady: this.isReady });
  }
  
  /**
   * Çalma durumu değiştiğinde tetiklenir ve state'i günceller.
   * @param {object} status - { isPlaying: boolean, position?: number }
   * @private
   */
  _handlePlaybackStatus(status) {
    this.isPlaying = status.isPlaying;
    // Bu bilgiyi UI katmanına iletmek için global state'i (Zustand) güncelle.
    // Örneğin: usePlaybackStore.setState({ isPlaying: this.isPlaying });
    console.log(`PlaybackService: Status updated - isPlaying: ${this.isPlaying}`);
  }
}

// Singleton instance
export const playbackService = new PlaybackService();