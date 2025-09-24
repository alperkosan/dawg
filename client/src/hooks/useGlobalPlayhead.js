// hooks/useGlobalPlayhead.js
// Single transport listener with multiple subscribers - PERFORMANCE OPTIMIZED
import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioContextService } from '../lib/services/AudioContextService';
import { usePlaybackStore } from '../store/usePlaybackStore';

// Global singleton for playhead tracking
class PlayheadManager {
  constructor() {
    this.subscribers = new Set();
    this.isInitialized = false;
    this.currentStep = 0;
    this.playbackState = 'stopped';
    this.transport = null;
    this.updateThrottled = false;
  }

  init() {
    if (this.isInitialized) return;

    const audioEngine = AudioContextService.getAudioEngine();
    this.transport = audioEngine?.transport;

    if (!this.transport) {
      return;
    }

    // Single transport listener for ALL components
    this.transport.on('tick', this.handleTick);
    this.transport.on('start', () => this.updatePlaybackState('playing'));
    this.transport.on('stop', () => this.updatePlaybackState('stopped'));
    this.transport.on('pause', () => this.updatePlaybackState('paused'));

    this.isInitialized = true;
  }

  handleTick = (tickData) => {
    // Transport sends object with step property, not raw number
    let step;
    if (typeof tickData === 'object' && tickData.step !== undefined) {
      step = tickData.step;
    } else if (typeof tickData === 'number') {
      step = tickData;
    } else {
      return; // Skip invalid data silently
    }

    // Safety check for valid step values
    if (typeof step !== 'number' || isNaN(step)) {
      return; // Skip invalid step silently
    }

    // Only update if step changed significantly (sub-pixel optimization)
    const stepDelta = Math.abs(step - this.currentStep);
    if (stepDelta < 0.01) return; // Skip micro-movements

    this.currentStep = step;

    // EXTREMELY aggressive throttling - max 15fps for Piano Roll playback performance
    if (this.updateThrottled) return;
    this.updateThrottled = true;

    // Use setTimeout instead of RAF for more predictable throttling
    setTimeout(() => {
      this.notifySubscribers();
      this.updateThrottled = false;
    }, 66); // ~15fps max - critical for Piano Roll performance
  };

  updatePlaybackState = (state) => {
    this.playbackState = state;
    this.notifySubscribers();
  };

  notifySubscribers() {
    const data = {
      currentStep: this.currentStep,
      playbackState: this.playbackState
    };

    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        // Silently handle subscription errors
      }
    });
  }

  subscribe(callback) {
    this.subscribers.add(callback);

    // Initialize if first subscriber
    if (this.subscribers.size === 1) {
      this.init();
    }

    // Send current state immediately
    callback({
      currentStep: this.currentStep,
      playbackState: this.playbackState
    });

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);

      // Cleanup if no subscribers
      if (this.subscribers.size === 0) {
        this.cleanup();
      }
    };
  }

  cleanup() {
    if (this.transport) {
      this.transport.off('tick', this.handleTick);
      this.transport.off('start', this.updatePlaybackState);
      this.transport.off('stop', this.updatePlaybackState);
      this.transport.off('pause', this.updatePlaybackState);
    }
    this.isInitialized = false;
  }
}

// Global singleton instance
const playheadManager = new PlayheadManager();

/**
 * Optimized hook for playhead tracking with global singleton
 * Prevents multiple transport listeners - MASSIVE performance gain
 */
export const useGlobalPlayhead = () => {
  const [playheadState, setPlayheadState] = useState({
    currentStep: 0,
    playbackState: 'stopped'
  });

  const fallbackPlaybackState = usePlaybackStore(state => state.playbackState);
  const fallbackTransportStep = usePlaybackStore(state => state.transportStep);

  useEffect(() => {
    // Subscribe to global playhead manager with aggressive throttling
    let lastUpdate = 0;
    let pendingUpdate = null;
    const throttleMs = 100; // ~10fps max for Piano Roll UI updates - critical performance fix

    const unsubscribe = playheadManager.subscribe((data) => {
      const now = Date.now();

      // Clear any pending update
      if (pendingUpdate) {
        clearTimeout(pendingUpdate);
      }

      // If we're updating too frequently, queue the update
      if (now - lastUpdate < throttleMs) {
        pendingUpdate = setTimeout(() => {
          lastUpdate = Date.now();
          setPlayheadState(prevState => {
            // Only update if values actually changed significantly
            const stepDelta = Math.abs(prevState.currentStep - data.currentStep);
            if (stepDelta > 0.1 || prevState.playbackState !== data.playbackState) {
              return data;
            }
            return prevState;
          });
          pendingUpdate = null;
        }, throttleMs - (now - lastUpdate));
        return;
      }

      lastUpdate = now;
      setPlayheadState(prevState => {
        // Only update if values actually changed significantly
        const stepDelta = Math.abs(prevState.currentStep - data.currentStep);
        if (stepDelta > 0.1 || prevState.playbackState !== data.playbackState) {
          return data;
        }
        return prevState;
      });
    });

    return unsubscribe;
  }, []);

  // Fallback to store values if transport is not available
  const effectiveState = {
    currentStep: playheadState.currentStep || fallbackTransportStep || 0,
    playbackState: playheadState.playbackState || fallbackPlaybackState || 'stopped'
  };

  // Safety check for NaN values
  if (isNaN(effectiveState.currentStep) || effectiveState.currentStep === undefined) {
    effectiveState.currentStep = 0;
  }

  return effectiveState;
};

// Export manager for advanced use cases
export { playheadManager };