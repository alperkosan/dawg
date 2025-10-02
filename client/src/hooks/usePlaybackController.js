// hooks/usePlaybackController.js
import { useState, useEffect, useCallback, useRef } from 'react';
import PlaybackControllerSingleton from '../lib/core/PlaybackControllerSingleton.js';

/**
 * ✅ UNIFIED PLAYBACK HOOK
 *
 * Tek hook tüm playback ihtiyaçları için:
 * - State management
 * - Position tracking
 * - User interactions
 * - Motor synchronization
 */

/**
 * Ana playback hook - Tüm bileşenler bu hook'u kullanır
 */
export const usePlaybackController = (options = {}) => {
  const {
    trackPosition = true,
    trackGhost = false
  } = options;

  const [state, setState] = useState({
    playbackState: 'stopped',
    isPlaying: false,
    currentPosition: 0,
    bpm: 140,
    loopStart: 0,
    loopEnd: 64,
    loopEnabled: true,
    ghostPosition: null,
    isUserScrubbing: false
  });

  const controllerRef = useRef(null);

  // Controller'ı initialize et
  useEffect(() => {
    let isMounted = true;

    const initController = async () => {
      try {
        const controller = await PlaybackControllerSingleton.getInstance();
        if (!controller || !isMounted) return;

        controllerRef.current = controller;

      // State changes subscription
      const unsubscribeState = controller.subscribe((data) => {
        setState(data.state);
      });

      // Position updates subscription (opsiyonel)
      let positionHandler, ghostHandler;
      if (trackPosition) {
        positionHandler = (data) => {
          setState(prev => ({
            ...prev,
            currentPosition: data.position
          }));
        };
        controller.on('position-update', positionHandler);
      }

      // Ghost position subscription (opsiyonel)
      if (trackGhost) {
        ghostHandler = (position) => {
          setState(prev => ({
            ...prev,
            ghostPosition: position
          }));
        };
        controller.on('ghost-position-change', ghostHandler);
      }

        // Cleanup for this controller
        return () => {
          unsubscribeState();
          if (positionHandler) controller.off('position-update', positionHandler);
          if (ghostHandler) controller.off('ghost-position-change', ghostHandler);
        };
      } catch (error) {
        console.error('Failed to initialize PlaybackController in hook:', error);
      }
    };

    initController();

    return () => {
      isMounted = false;
    };
  }, [trackPosition, trackGhost]);

  // =================== ACTIONS ===================

  const actions = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return {};

    return {
      // Primary controls
      play: (startPosition = null) => controller.play(startPosition),
      pause: () => controller.pause(),
      stop: () => controller.stop(),
      togglePlayPause: () => controller.togglePlayPause(),

      // Position control
      jumpToPosition: (position, options) => controller.jumpToPosition(position, options),

      // Ghost playhead
      setGhostPosition: (position) => controller.setGhostPosition(position),
      clearGhostPosition: () => controller.clearGhostPosition(),

      // Settings
      setBPM: (bpm) => controller.setBPM(bpm),
      setLoopRange: (start, end) => controller.setLoopRange(start, end),
      setLoopEnabled: (enabled) => controller.setLoopEnabled(enabled),

      // Getters
      getCurrentPosition: () => controller.getCurrentPosition(),
      getDisplayPosition: () => controller.getDisplayPosition(),
      getState: () => controller.getState()
    };
  }, []);

  const actionMethods = actions();

  return {
    // State
    ...state,

    // Actions
    ...actionMethods,

    // Computed values
    isInitialized: !!controllerRef.current
  };
};

/**
 * Lightweight hook sadece position tracking için
 */
export const usePlaybackPosition = () => {
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initController = async () => {
      try {
        const controller = await PlaybackControllerSingleton.getInstance();
        if (!controller || !isMounted) return;

        const unsubscribe = controller.subscribe((data) => {
          if (isMounted) {
            setPosition(data.state.currentPosition);
            setIsPlaying(data.state.isPlaying);
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('Failed to initialize PlaybackController in usePlaybackPosition:', error);
        return null;
      }
    };

    let cleanup;
    initController().then(unsub => {
      cleanup = unsub;
    });

    return () => {
      isMounted = false;
      if (cleanup) cleanup();
    };
  }, []);

  return { position, isPlaying };
};

/**
 * Timeline interaction hook
 */
export const useTimelineInteraction = (stepWidth = 16) => {
  const { jumpToPosition, setGhostPosition, clearGhostPosition } = usePlaybackController({
    trackGhost: true
  });

  const handleTimelineClick = useCallback((e, audioLoopLength) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetStep = Math.max(0, Math.min(audioLoopLength - 1, Math.round(clickX / stepWidth)));

    jumpToPosition(targetStep, { smooth: true });
  }, [jumpToPosition, stepWidth]);

  const handleTimelineHover = useCallback((e, audioLoopLength) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const hoverStep = Math.max(0, Math.min(audioLoopLength - 1, Math.round(hoverX / stepWidth)));

    setGhostPosition(hoverStep);
  }, [setGhostPosition, stepWidth]);

  const handleTimelineLeave = useCallback(() => {
    clearGhostPosition();
  }, [clearGhostPosition]);

  return {
    handleTimelineClick,
    handleTimelineHover,
    handleTimelineLeave
  };
};

/**
 * Transport controls hook
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
    setLoopEnabled
  } = usePlaybackController();

  return {
    // State
    isPlaying,
    playbackState,
    bpm,
    loopEnabled,

    // Actions
    play,
    pause,
    stop,
    togglePlayPause,
    setBPM,
    setLoopEnabled
  };
};