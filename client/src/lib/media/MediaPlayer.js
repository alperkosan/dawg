/**
 * MediaPlayer
 * Singleton media player for URL-based audio playback
 * Ensures only one audio plays at a time across the entire application
 */

class MediaPlayer {
  constructor() {
    this.audioElement = null;
    this.currentUrl = null;
    this.isPlaying = false;
    this.isLoading = false;
    this.listeners = new Map(); // Map<url, Set<listeners>>
    this.error = null;
    
    // Audio metadata
    this.duration = 0;
    this.currentTime = 0;
    this.volume = 1;
    this.isMuted = false;
    
    // Create audio element
    this._createAudioElement();
  }

  _createAudioElement() {
    if (this.audioElement) {
      this.audioElement.removeEventListener('play', this._handlePlay);
      this.audioElement.removeEventListener('pause', this._handlePause);
      this.audioElement.removeEventListener('ended', this._handleEnded);
      this.audioElement.removeEventListener('timeupdate', this._handleTimeUpdate);
      this.audioElement.removeEventListener('loadedmetadata', this._handleLoadedMetadata);
      this.audioElement.removeEventListener('error', this._handleError);
      this.audioElement.removeEventListener('loadstart', this._handleLoadStart);
    }

    this.audioElement = new Audio();
    this.audioElement.preload = 'metadata';
    this.audioElement.crossOrigin = 'anonymous';
    
    // Bind handlers
    this._handlePlay = () => {
      this.isPlaying = true;
      this._notifyListeners('play');
    };
    
    this._handlePause = () => {
      this.isPlaying = false;
      this._notifyListeners('pause');
    };
    
    this._handleEnded = () => {
      this.isPlaying = false;
      this.currentTime = 0;
      this._notifyListeners('ended');
    };
    
    this._handleTimeUpdate = () => {
      this.currentTime = this.audioElement.currentTime;
      this._notifyListeners('timeupdate');
    };
    
    this._handleLoadedMetadata = () => {
      this.duration = this.audioElement.duration;
      this.isLoading = false;
      this.error = null;
      this._notifyListeners('loadedmetadata');
    };
    
    this._handleError = (e) => {
      this.isLoading = false;
      this.isPlaying = false;
      const audioError = this.audioElement.error;
      let errorMsg = 'Failed to load audio';
      
      if (audioError) {
        switch (audioError.code) {
          case audioError.MEDIA_ERR_ABORTED:
            errorMsg = 'Audio loading aborted';
            break;
          case audioError.MEDIA_ERR_NETWORK:
            errorMsg = 'Network error loading audio';
            break;
          case audioError.MEDIA_ERR_DECODE:
            errorMsg = 'Audio decode error';
            break;
          case audioError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = 'Audio format not supported';
            break;
        }
      }
      
      this.error = errorMsg;
      this._notifyListeners('error', { error: errorMsg });
    };
    
    this._handleLoadStart = () => {
      this.isLoading = true;
      this.error = null;
      this._notifyListeners('loadstart');
    };

    // Attach listeners
    this.audioElement.addEventListener('play', this._handlePlay);
    this.audioElement.addEventListener('pause', this._handlePause);
    this.audioElement.addEventListener('ended', this._handleEnded);
    this.audioElement.addEventListener('timeupdate', this._handleTimeUpdate);
    this.audioElement.addEventListener('loadedmetadata', this._handleLoadedMetadata);
    this.audioElement.addEventListener('error', this._handleError);
    this.audioElement.addEventListener('loadstart', this._handleLoadStart);
    
    // Set initial volume
    this.audioElement.volume = this.volume;
  }

  /**
   * Subscribe to player events
   * @param {string} url - URL to listen for (null = all URLs)
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(url, callback) {
    const key = url || '__all__';
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Notify listeners of an event
   * @private
   */
  _notifyListeners(event, data = {}) {
    // Notify URL-specific listeners
    if (this.currentUrl) {
      const urlListeners = this.listeners.get(this.currentUrl);
      if (urlListeners) {
        urlListeners.forEach(cb => {
          try {
            cb(event, { ...data, url: this.currentUrl });
          } catch (err) {
            console.error('MediaPlayer listener error:', err);
          }
        });
      }
    }
    
    // Notify global listeners
    const globalListeners = this.listeners.get('__all__');
    if (globalListeners) {
      globalListeners.forEach(cb => {
        try {
          cb(event, { ...data, url: this.currentUrl });
        } catch (err) {
          console.error('MediaPlayer listener error:', err);
        }
      });
    }
  }

  /**
   * Load a URL (stops current playback if different URL)
   * @param {string} url - Audio URL to load
   */
  load(url) {
    if (!url) {
      this.stop();
      this.currentUrl = null;
      return;
    }

    // If same URL, do nothing
    if (this.currentUrl === url && this.audioElement.src) {
      return;
    }

    // Stop current playback
    this.stop();

    // Load new URL
    this.currentUrl = url;
    this.isLoading = true;
    this.error = null;
    this.audioElement.src = url;
    this.audioElement.load();
    
    this._notifyListeners('load', { url });
  }

  /**
   * Play the current URL
   * Stops any other playing audio first
   */
  async play(url = null) {
    // If URL provided and different, load it first
    if (url && url !== this.currentUrl) {
      this.load(url);
      // Wait for metadata to load
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for audio to load'));
        }, 5000);
        
        const checkReady = () => {
          if (!this.isLoading && this.duration > 0) {
            clearTimeout(timeout);
            resolve();
          } else if (this.error) {
            clearTimeout(timeout);
            reject(new Error(this.error));
          }
        };
        
        const unsubscribe = this.subscribe(null, (event) => {
          if (event === 'loadedmetadata' || event === 'error') {
            checkReady();
            unsubscribe();
          }
        });
        
        // Check immediately in case already loaded
        checkReady();
      });
    }

    if (!this.currentUrl) {
      throw new Error('No URL loaded');
    }

    try {
      await this.audioElement.play();
      this.isPlaying = true;
    } catch (err) {
      console.error('MediaPlayer play error:', err);
      this.error = err.message;
      this._notifyListeners('error', { error: err.message });
      throw err;
    }
  }

  /**
   * Pause playback
   */
  pause() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.isPlaying = false;
    }
  }

  /**
   * Toggle play/pause
   */
  toggle(url = null) {
    if (url && url !== this.currentUrl) {
      // Load and play new URL
      return this.play(url);
    } else if (this.isPlaying) {
      this.pause();
    } else {
      return this.play();
    }
  }

  /**
   * Stop playback and reset
   */
  stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.isPlaying = false;
      this.currentTime = 0;
    }
  }

  /**
   * Seek to a specific time
   * @param {number} time - Time in seconds
   */
  seek(time) {
    if (this.audioElement && this.duration > 0) {
      this.audioElement.currentTime = Math.max(0, Math.min(time, this.duration));
      this.currentTime = this.audioElement.currentTime;
    }
  }

  /**
   * Set volume (0-1)
   * @param {number} volume - Volume level (0-1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
    this._notifyListeners('volumechange', { volume: this.volume });
  }

  /**
   * Set muted state
   * @param {boolean} muted - Muted state
   */
  setMuted(muted) {
    this.isMuted = muted;
    if (this.audioElement) {
      this.audioElement.muted = muted;
    }
    this._notifyListeners('volumechange', { muted: this.isMuted });
  }

  /**
   * Get current state
   */
  getState() {
    return {
      url: this.currentUrl,
      isPlaying: this.isPlaying,
      isLoading: this.isLoading,
      error: this.error,
      duration: this.duration,
      currentTime: this.currentTime,
      volume: this.volume,
      isMuted: this.isMuted
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop();
    if (this.audioElement) {
      this.audioElement.removeEventListener('play', this._handlePlay);
      this.audioElement.removeEventListener('pause', this._handlePause);
      this.audioElement.removeEventListener('ended', this._handleEnded);
      this.audioElement.removeEventListener('timeupdate', this._handleTimeUpdate);
      this.audioElement.removeEventListener('loadedmetadata', this._handleLoadedMetadata);
      this.audioElement.removeEventListener('error', this._handleError);
      this.audioElement.removeEventListener('loadstart', this._handleLoadStart);
      this.audioElement.src = '';
      this.audioElement = null;
    }
    this.listeners.clear();
    this.currentUrl = null;
  }
}

// Singleton instance
let mediaPlayerInstance = null;

/**
 * Get the singleton MediaPlayer instance
 */
export function getMediaPlayer() {
  if (!mediaPlayerInstance) {
    mediaPlayerInstance = new MediaPlayer();
  }
  return mediaPlayerInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetMediaPlayer() {
  if (mediaPlayerInstance) {
    mediaPlayerInstance.destroy();
    mediaPlayerInstance = null;
  }
}

export default getMediaPlayer;

