/**
 * Optimized Zustand Selectors for Mixer Store
 * 
 * These selectors use shallow equality checking and memoization
 * to prevent unnecessary re-renders.
 */

import { shallow } from 'zustand/shallow';

/**
 * Select only mixer track IDs
 */
export const selectMixerTrackIds = (state) =>
    state.mixerTracks.map(t => t.id);

/**
 * Select a single mixer track by ID
 */
export const selectMixerTrackById = (trackId) => (state) =>
    state.mixerTracks.find(t => t.id === trackId);

/**
 * Select mixer track count
 */
export const selectMixerTrackCount = (state) => state.mixerTracks.length;

/**
 * Select only track names and IDs (for dropdowns)
 */
export const selectMixerTrackOptions = (state) =>
    state.mixerTracks.map(t => ({ id: t.id, name: t.name }));

/**
 * Select master track
 */
export const selectMasterTrack = (state) =>
    state.mixerTracks.find(t => t.id === 'master');

/**
 * Select send channels
 */
export const selectSendChannels = (state) => state.sendChannels;

/**
 * Select muted track IDs
 */
export const selectMutedTrackIds = (state) =>
    state.mixerTracks.filter(t => t.muted).map(t => t.id);

/**
 * Select soloed track IDs
 */
export const selectSoloedTrackIds = (state) =>
    state.mixerTracks.filter(t => t.solo).map(t => t.id);

/**
 * Select track volume by ID
 */
export const selectTrackVolume = (trackId) => (state) => {
    const track = state.mixerTracks.find(t => t.id === trackId);
    return track?.volume ?? 0;
};

/**
 * Select track pan by ID
 */
export const selectTrackPan = (trackId) => (state) => {
    const track = state.mixerTracks.find(t => t.id === trackId);
    return track?.pan ?? 0;
};

/**
 * Select mixer actions only (no data)
 */
export const selectMixerActions = (state) => ({
    addTrack: state.addTrack,
    removeTrack: state.removeTrack,
    updateTrack: state.updateTrack,
    toggleMute: state.toggleMute,
    toggleSolo: state.toggleSolo,
    setTrackVolume: state.setTrackVolume,
    setTrackPan: state.setTrackPan,
    setTrackColor: state.setTrackColor
});

// Export shallow for convenience
export { shallow };
