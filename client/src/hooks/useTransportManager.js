// hooks/useTransportManager.js
/**
 * 🎚️ UNIFIED TRANSPORT HOOK
 *
 * Tüm transport operations için tek hook
 * Maximum coordination - tüm UI'lar bu hook'u kullanacak
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import TransportManagerSingleton from '../lib/core/TransportManagerSingleton.js';

/**
 * ✅ MAIN TRANSPORT HOOK
 */
export const useTransportManager = (options = {}) => {
  const {
    trackPosition = true,
    trackGhost = false,
    registerUI = true
  } = options;

  // State from transport manager
  const [state, setState] = useState({
    isPlaying: false,
    playbackState: 'stopped',
    currentPosition: 0,
    ghostPosition: null,
    bpm: 140,
    loopEnabled: true,
    loopStart: 0,
    loopEnd: 64,
    isReady: false
  });

  const transportManagerRef = useRef(null);

  // Initialize transport manager and subscribe
  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    const initTransport = async () => {
      try {
        const transportManager = await TransportManagerSingleton.getInstance();
        if (!transportManager || !isMounted) return;

        transportManagerRef.current = transportManager;

        // Subscribe to all events
        unsubscribe = transportManager.subscribe((event) => {
          if (!isMounted) return;

          if (event.type === 'state-change') {
            setState(prev => ({
              ...prev,
              ...event.state,
              isReady: true
            }));
          } else if (event.type === 'position-update' && trackPosition) {
            setState(prev => ({
              ...prev,
              currentPosition: event.position
            }));
          } else if (event.type === 'ghost-position-change' && trackGhost) {
            setState(prev => ({
              ...prev,
              ghostPosition: event.ghostPosition
            }));
          }
        });

        console.log('🎚️ useTransportManager initialized');
      } catch (error) {
        console.error('🎚️ Failed to initialize transport manager:', error);
      }
    };

    initTransport();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [trackPosition, trackGhost]);

  // =================== TRANSPORT ACTIONS ===================

  // ✅ DEFENSIVE ACTIONS - Return safe defaults when not ready
  const createSafeActions = useCallback(() => {
    const transportManager = transportManagerRef.current;

    const safeAction = (actionName) => {
      return async (...args) => {
        if (!transportManager) {
          console.warn(`🎚️ TransportManager not ready for ${actionName}`);
          return false;
        }
        return transportManager[actionName](...args);
      };
    };

    return {
      // Primary controls - safe defaults
      play: safeAction('play'),
      pause: safeAction('pause'),
      stop: safeAction('stop'),
      togglePlayPause: safeAction('togglePlayPause'),

      // Position control
      jumpToPosition: safeAction('jumpToPosition'),

      // Ghost playhead
      setGhostPosition: (position) => {
        if (!transportManager) return;
        transportManager.setGhostPosition(position);
      },

      clearGhostPosition: () => {
        if (!transportManager) return;
        transportManager.clearGhostPosition();
      },

      // Settings
      setBPM: (bpm) => {
        if (!transportManager) return;
        transportManager.setBPM(bpm);
      },

      setLoopRange: (start, end) => {
        if (!transportManager) return;
        transportManager.setLoopRange(start, end);
      },

      setLoopEnabled: (enabled) => {
        if (!transportManager) return;
        transportManager.setLoopEnabled(enabled);
      },

      // UI Registration
      registerTransportButton: (id, element, type) => {
        if (!transportManager) return;
        transportManager.registerTransportButton(id, element, type);
      },

      registerPlayhead: (id, element, stepWidth) => {
        if (!transportManager) return;
        transportManager.registerPlayhead(id, element, stepWidth);
      },

      registerTimeline: (id, element, config) => {
        if (!transportManager) return;
        transportManager.registerTimeline(id, element, config);
      },

      unregisterElement: (id) => {
        if (!transportManager) return;
        transportManager.unregisterElement(id);
      }
    };
  }, []);

  return {
    // State
    ...state,

    // Actions
    ...createSafeActions(),

    // Utilities
    getCurrentPosition: () => {
      const transportManager = transportManagerRef.current;
      return transportManager?.getCurrentPosition() || 0;
    },

    getGhostPosition: () => {
      const transportManager = transportManagerRef.current;
      return transportManager?.getGhostPosition() || null;
    },

    isReady: state.isReady
  };
};

/**
 * ✅ TRANSPORT CONTROLS HOOK - For UI components
 */
export const useTransportControls = () => {
  const {
    isPlaying,
    playbackState,
    bpm,
    loopEnabled,
    play,
    pause,
    stop,
    togglePlayPause,
    setBPM,
    setLoopEnabled,
    isReady
  } = useTransportManager();

  return {
    // State
    isPlaying,
    playbackState,
    bpm: bpm || 140, // Safe default BPM
    loopEnabled,
    isReady,

    // Actions
    play,
    pause,
    stop,
    togglePlayPause,
    setBPM,
    setLoopEnabled
  };
};

/**
 * ✅ TRANSPORT POSITION HOOK - For position tracking
 */
export const useTransportPosition = () => {
  const { currentPosition, playbackState, isPlaying, isReady, getCurrentPosition } = useTransportManager({
    trackPosition: true,
    trackGhost: false
  });

  return {
    position: currentPosition || 0, // Safe default position
    displayPosition: currentPosition || 0, // Use state value directly to avoid race condition
    playbackState: playbackState || 'stopped', // Safe default state
    isPlaying: isPlaying || false, // Safe default
    isReady
  };
};

/**
 * ✅ TRANSPORT TIMELINE HOOK - For timeline interactions
 */
export const useTransportTimeline = (stepWidth = 16, audioLoopLength = 64) => {
  const {
    jumpToPosition,
    setGhostPosition,
    clearGhostPosition,
    registerTimeline,
    unregisterElement
  } = useTransportManager({
    trackGhost: true
  });

  const registerTimelineElement = useCallback((id, element) => {
    registerTimeline(id, element, { stepWidth, audioLoopLength });
  }, [registerTimeline, stepWidth, audioLoopLength]);

  return {
    jumpToPosition,
    setGhostPosition,
    clearGhostPosition,
    registerTimelineElement,
    unregisterElement
  };
};

/**
 * ✅ TRANSPORT PLAYHEAD HOOK - For playhead components
 */
export const useTransportPlayhead = (stepWidth = 16) => {
  const {
    currentPosition,
    ghostPosition,
    isPlaying,
    playbackState,
    registerPlayhead,
    unregisterElement,
    getCurrentPosition,
    getGhostPosition
  } = useTransportManager({
    trackPosition: true,
    trackGhost: true
  });

  const registerPlayheadElement = useCallback((id, element) => {
    registerPlayhead(id, element, stepWidth);
  }, [registerPlayhead, stepWidth]);

  return {
    currentPosition,
    ghostPosition: getGhostPosition(),
    actualPosition: getCurrentPosition(),
    isPlaying,
    playbackState,
    registerPlayheadElement,
    unregisterElement
  };
};

/**
 * ✅ TRANSPORT BUTTON HOOK - For transport buttons
 */
export const useTransportButton = (buttonType) => {
  const {
    isPlaying,
    playbackState,
    play,
    pause,
    stop,
    togglePlayPause,
    registerTransportButton,
    unregisterElement
  } = useTransportManager();

  const registerButtonElement = useCallback((id, element) => {
    registerTransportButton(id, element, buttonType);
  }, [registerTransportButton, buttonType]);

  // ✅ OPTIMIZED - Fire-and-forget pattern for 0ms UI latency
  const handleClick = useCallback(() => {
    switch (buttonType) {
      case 'play':
        play(); // No await - immediate return
        break;
      case 'pause':
        pause(); // No await - immediate return
        break;
      case 'stop':
        stop(); // No await - immediate return
        break;
      case 'toggle':
      default:
        togglePlayPause(); // No await - immediate return
        break;
    }
  }, [buttonType, play, pause, stop, togglePlayPause]);

  return {
    isPlaying,
    playbackState,
    handleClick,
    registerButtonElement,
    unregisterElement
  };
};