/**
 * Global Media Player Store
 * Manages audio playback state for media panel
 * Only one project can play at a time
 */

import { create } from 'zustand';

export const useMediaPlayerStore = create((set, get) => ({
  // Current playing project
  playingProjectId: null,
  audioUrl: null,
  duration: null,
  isPlaying: false,
  currentTime: 0,
  volume: 1,
  isMuted: false,

  // Actions
  setPlayingProject: (projectId, audioUrl, duration) => {
    const state = get();
    
    // If another project is playing, stop it first
    if (state.playingProjectId && state.playingProjectId !== projectId) {
      set({
        playingProjectId: null,
        isPlaying: false,
        currentTime: 0,
      });
    }

    set({
      playingProjectId: projectId,
      audioUrl,
      duration,
      isPlaying: false,
      currentTime: 0,
    });
  },

  play: () => {
    set({ isPlaying: true });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  stop: () => {
    set({
      isPlaying: false,
      currentTime: 0,
      playingProjectId: null,
      audioUrl: null,
      duration: null,
    });
  },

  setCurrentTime: (time) => {
    set({ currentTime: time });
  },

  setVolume: (volume) => {
    set({ volume });
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  clear: () => {
    set({
      playingProjectId: null,
      audioUrl: null,
      duration: null,
      isPlaying: false,
      currentTime: 0,
    });
  },
}));

