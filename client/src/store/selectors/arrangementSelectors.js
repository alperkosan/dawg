/**
 * Optimized Zustand Selectors for Arrangement Store
 * 
 * These selectors use shallow equality checking and memoization
 * to prevent unnecessary re-renders.
 */

import { shallow } from 'zustand/shallow';

/**
 * Select active pattern ID only
 */
export const selectActivePatternId = (state) => state.activePatternId;

/**
 * Select active pattern data
 */
export const selectActivePattern = (state) => {
    const { patterns, activePatternId } = state;
    return patterns[activePatternId] || null;
};

/**
 * Select pattern by ID
 */
export const selectPatternById = (patternId) => (state) =>
    state.patterns[patternId];

/**
 * Select pattern order (for pattern list)
 */
export const selectPatternOrder = (state) => state.patternOrder;

/**
 * Select all patterns as array (for iteration)
 */
export const selectPatternsArray = (state) =>
    state.patternOrder.map(id => state.patterns[id]).filter(Boolean);

/**
 * Select pattern count
 */
export const selectPatternCount = (state) => state.patternOrder.length;

/**
 * Select pattern options (for dropdowns)
 */
export const selectPatternOptions = (state) =>
    state.patternOrder.map(id => ({
        id,
        name: state.patterns[id]?.name || id
    }));

/**
 * Select notes for a specific instrument in active pattern
 */
export const selectActivePatternNotes = (instrumentId) => (state) => {
    const activePattern = state.patterns[state.activePatternId];
    return activePattern?.data?.[instrumentId] || [];
};

/**
 * Select arrangement tracks
 */
export const selectArrangementTracks = (state) => state.arrangementTracks;

/**
 * Select arrangement clips
 */
export const selectArrangementClips = (state) => state.arrangementClips;

/**
 * Select clips for a specific track
 */
export const selectClipsByTrack = (trackId) => (state) =>
    state.arrangementClips.filter(clip => clip.trackId === trackId);

/**
 * Select selected clip IDs
 */
export const selectSelectedClipIds = (state) => state.selectedClipIds;

/**
 * Select song length
 */
export const selectSongLength = (state) => state.songLength;

/**
 * Select zoom level
 */
export const selectZoomX = (state) => state.zoomX;

/**
 * Select pattern management actions only
 */
export const selectPatternActions = (state) => ({
    createPattern: state.createPattern,
    deletePattern: state.deletePattern,
    duplicatePattern: state.duplicatePattern,
    renamePattern: state.renamePattern,
    setActivePatternId: state.setActivePatternId,
    updatePatternNotes: state.updatePatternNotes,
    setPatternLength: state.setPatternLength
});

/**
 * Select arrangement clip actions only
 */
export const selectClipActions = (state) => ({
    addArrangementClip: state.addArrangementClip,
    updateArrangementClip: state.updateArrangementClip,
    removeArrangementClip: state.removeArrangementClip,
    addAudioClip: state.addAudioClip
});

// Export shallow for convenience
export { shallow };
