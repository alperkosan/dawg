// hooks/useGlobalPlayhead.js
import { useState, useEffect } from 'react';
import { AudioContextService } from '../lib/services/AudioContextService';

// Tüm güncellemeleri yönetecek tekil (singleton) bir sınıf
class PlayheadManager {
  constructor() {
    this.subscribers = new Set();
    this.isInitialized = false;
    this.currentStep = 0;
    this.playbackState = 'stopped';
    this.transport = null;
    this.rafId = null;
  }

  init() {
    if (this.isInitialized) return;
    const audioEngine = AudioContextService.getAudioEngine();
    this.transport = audioEngine?.transport;
    if (!this.transport) return;

    this.transport.on('start', () => this.updatePlaybackState('playing'));
    this.transport.on('stop', () => this.updatePlaybackState('stopped'));
    this.transport.on('pause', () => this.updatePlaybackState('paused'));

    // Sadece çalma durumunda `requestAnimationFrame` kullan
    this.isInitialized = true;
  }

  startLoop() {
      if (this.rafId) return;
      const loop = () => {
          if (this.playbackState !== 'playing') {
              this.stopLoop();
              return;
          }
          const step = this.transport.ticksToSteps(this.transport.currentTick);
          if (Math.abs(step - this.currentStep) > 0.01) {
              this.currentStep = step;
              this.notifySubscribers();
          }
          this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
  }
  
  stopLoop() {
      if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
      }
  }

  updatePlaybackState(state) {
    this.playbackState = state;
    if (state === 'playing') {
        this.startLoop();
    } else {
        this.stopLoop();
        if (state === 'stopped') {
            this.currentStep = 0;
        }
    }
    this.notifySubscribers();
  }

  notifySubscribers() {
    const data = { currentStep: this.currentStep, playbackState: this.playbackState };
    this.subscribers.forEach(callback => callback(data));
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    if (!this.isInitialized) this.init();
    callback({ currentStep: this.currentStep, playbackState: this.playbackState });
    return () => this.subscribers.delete(callback);
  }
}

const playheadManager = new PlayheadManager();

export const useGlobalPlayhead = () => {
  const [playheadState, setPlayheadState] = useState({
    currentStep: 0,
    playbackState: 'stopped'
  });

  useEffect(() => {
    const unsubscribe = playheadManager.subscribe(setPlayheadState);
    return unsubscribe;
  }, []);

  return playheadState;
};