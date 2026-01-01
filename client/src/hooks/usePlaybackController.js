// hooks/usePlaybackController.js
import { useCallback } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';

/**
 * ✅ UNIFIED PLAYBACK HOOK (ADAPTER)
 * 
 * Adapts legacy usePlaybackController API to use the Unified Playback Store (SSOT).
 * 
 * Benefits:
 * - Eliminates redundant state (uses global Zustand store)
 * - Syncs with TransportController via store
 * - Removes PlaybackControllerSingleton dependency
 */

export const usePlaybackController = (options = {}) => {
  const {
    trackPosition = true,
    trackGhost = false
  } = options;

  // Use the unified store
  const playbackState = usePlaybackStore();

  // Actions
  const {
    play,
    pause,
    stop,
    togglePlayPause,
    setBPM,
    setLoopPoints,
    setLoopEnabled,
    jumpToStep,
    setGhostPosition,
    // Note: PlaybackStore manages isScrubbing internally or exposes via getters if needed
  } = playbackState;

  // Map store state to expected hook format
  // Note: Store uses 'currentStep' (steps), legacy might expect 'currentPosition' (could be bars or steps?)
  // Checking original file: initController used state.currentPosition.
  // Assuming 1:1 mapping for now.

  const state = {
    playbackState: playbackState.isPlaying ? 'playing' : (playbackState.isPaused ? 'paused' : 'stopped'),
    isPlaying: playbackState.isPlaying,
    currentPosition: trackPosition ? playbackState.currentStep : 0, // Should this be steps? Yes.
    bpm: playbackState.bpm,
    loopStart: playbackState.loopStart,
    loopEnd: playbackState.loopEnd,
    loopEnabled: playbackState.loopEnabled,
    ghostPosition: trackGhost ? playbackState.ghostPosition : null,
    isUserScrubbing: false // Store might not expose this reactively yet, defaulting false
  };

  const actions = useCallback(() => {
    return {
      // Primary controls
      play: (startPosition = null) => play(startPosition),
      pause: () => pause(),
      stop: () => stop(),
      togglePlayPause: () => togglePlayPause(),

      // Position control
      jumpToPosition: (position, options) => jumpToStep(position, options),

      // Ghost playhead
      setGhostPosition: (position) => setGhostPosition(position),
      clearGhostPosition: () => setGhostPosition(null),

      // Settings
      setBPM: (bpm) => setBPM(bpm),
      setLoopRange: (start, end) => setLoopPoints(start, end),
      setLoopEnabled: (enabled) => setLoopEnabled(enabled),

      // Getters - accessing current state directly
      getCurrentPosition: () => usePlaybackStore.getState().currentStep,
      getDisplayPosition: () => usePlaybackStore.getState().currentStep, // formatting needed?
      getState: () => ({
        isPlaying: usePlaybackStore.getState().isPlaying,
        currentStep: usePlaybackStore.getState().currentStep,
        // ... other state
      })
    };
  }, [play, pause, stop, togglePlayPause, jumpToStep, setGhostPosition, setBPM, setLoopPoints, setLoopEnabled]);

  return {
    state, // Legacy wrapper expected flattened state? Original returned ...state
    ...state, // Spread state properties
    ...actions(), // Spread actions
    isInitialized: true
  };
};



/**
 * Lightweight hook sadece position tracking için
 */
export const usePlaybackPosition = () => {
  const currentStep = usePlaybackStore(state => state.currentStep);
  const isPlaying = usePlaybackStore(state => state.isPlaying);

  return { position: currentStep, isPlaying };
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