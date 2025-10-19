// src/store/useMixerUIStore.js
// ✅ PERFORMANCE: Separate UI state from audio state
// This prevents unnecessary re-renders when UI changes don't affect audio

import { create } from 'zustand';

export const useMixerUIStore = create((set, get) => ({
  // ========================================================
  // === UI-ONLY STATE (doesn't affect audio engine) ===
  // ========================================================

  // Active channel selection
  activeChannelId: 'master',

  // Expanded channels (show/hide details)
  expandedChannels: new Set(),

  // Visible EQ sections
  visibleEQs: new Set(),

  // Visible send sections
  visibleSends: new Set(),

  // Scroll position (for virtual scrolling later)
  scrollPosition: 0,

  // ========================================================
  // === ACTIONS ===
  // ========================================================

  setActiveChannelId: (trackId) => set({ activeChannelId: trackId }),

  toggleChannelExpansion: (trackId) => {
    set(state => {
      const newExpanded = new Set(state.expandedChannels);
      if (newExpanded.has(trackId)) {
        newExpanded.delete(trackId);
      } else {
        newExpanded.add(trackId);
      }
      return { expandedChannels: newExpanded };
    });
  },

  toggleChannelEQ: (trackId) => {
    set(state => {
      const newVisible = new Set(state.visibleEQs);
      if (newVisible.has(trackId)) {
        newVisible.delete(trackId);
      } else {
        newVisible.add(trackId);
      }
      return { visibleEQs: newVisible };
    });
  },

  toggleChannelSends: (trackId) => {
    set(state => {
      const newVisible = new Set(state.visibleSends);
      if (newVisible.has(trackId)) {
        newVisible.delete(trackId);
      } else {
        newVisible.add(trackId);
      }
      return { visibleSends: newVisible };
    });
  },

  setScrollPosition: (position) => set({ scrollPosition: position }),

  // Reset all UI state
  resetUIState: () => set({
    activeChannelId: 'master',
    expandedChannels: new Set(),
    visibleEQs: new Set(),
    visibleSends: new Set(),
    scrollPosition: 0
  })
}));
