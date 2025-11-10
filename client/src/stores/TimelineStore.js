/**
 * TimelineStore - Single Source of Truth for Timeline State
 *
 * Manages:
 * - Time signatures
 * - Tempo markers
 * - Section markers & bookmarks
 * - Loop regions (multiple)
 * - Timeline display settings
 *
 * Architecture:
 * - Zustand store for reactive state management
 * - Immutable updates with produce (immer)
 * - Performance optimized with selectors
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';

// ═══════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════

export const MarkerType = {
  SECTION: 'section',
  LOOP: 'loop',
  BOOKMARK: 'bookmark',
  ARRANGEMENT: 'arrangement'
};

export const DEFAULT_TIME_SIGNATURE = {
  numerator: 4,
  denominator: 4
};

export const DEFAULT_TEMPO = 140;

// ═══════════════════════════════════════════════════════════
// TIMELINE STORE
// ═══════════════════════════════════════════════════════════

export const useTimelineStore = create(
  subscribeWithSelector(
    immer((set, get) => ({
      // ═══════════════════════════════════════════════════════
      // STATE
      // ═══════════════════════════════════════════════════════

      // Time signature changes throughout the timeline
      timeSignatures: [
        {
          id: 'ts_0',
          position: 0, // Step position where this time signature starts
          numerator: 4,
          denominator: 4
        }
      ],

      // Tempo changes throughout the timeline
      tempoMarkers: [
        {
          id: 'tempo_0',
          position: 0, // Step position where this tempo starts
          bpm: DEFAULT_TEMPO
        }
      ],

      // Section markers & bookmarks
      markers: [
        // {
        //   id: 'marker_1',
        //   position: 0,
        //   name: 'Intro',
        //   color: '#3b82f6',
        //   type: MarkerType.SECTION
        // }
      ],

      // Loop regions (multiple)
      loopRegions: [
        // {
        //   id: 'loop_1',
        //   start: 0,
        //   end: 16,
        //   name: 'Loop A',
        //   color: '#10b981',
        //   isActive: false
        // }
      ],

      // Active loop region ID (null = no active loop)
      activeLoopRegionId: null,

      // Timeline display settings
      displaySettings: {
        showTimeSignature: true,
        showTempo: true,
        showMarkers: true,
        showLoopRegions: true,
        snapToMarkers: true,
        rulerHeight: 30,
        showBars: true,
        showBeats: true,
        showSubdivisions: true
      },

      // ═══════════════════════════════════════════════════════
      // TIME SIGNATURE METHODS
      // ═══════════════════════════════════════════════════════

      /**
       * Add time signature change
       */
      addTimeSignature: (position, numerator, denominator) => {
        const id = `ts_${Date.now()}`;
        set((state) => {
          state.timeSignatures.push({
            id,
            position,
            numerator,
            denominator
          });
          // Sort by position
          state.timeSignatures.sort((a, b) => a.position - b.position);
        });
        return id;
      },

      /**
       * Remove time signature
       */
      removeTimeSignature: (id) => {
        set((state) => {
          const index = state.timeSignatures.findIndex((ts) => ts.id === id);
          if (index !== -1 && index !== 0) {
            // Don't allow removing the first time signature
            state.timeSignatures.splice(index, 1);
          }
        });
      },

      /**
       * Update time signature
       */
      updateTimeSignature: (id, updates) => {
        set((state) => {
          const ts = state.timeSignatures.find((t) => t.id === id);
          if (ts) {
            Object.assign(ts, updates);
            // Re-sort if position changed
            if (updates.position !== undefined) {
              state.timeSignatures.sort((a, b) => a.position - b.position);
            }
          }
        });
      },

      /**
       * Get time signature at position
       */
      getTimeSignatureAt: (position) => {
        const { timeSignatures } = get();

        // Find the last time signature before or at this position
        let current = timeSignatures[0];
        for (const ts of timeSignatures) {
          if (ts.position <= position) {
            current = ts;
          } else {
            break;
          }
        }

        return current;
      },

      /**
       * Get all time signature regions
       */
      getTimeSignatureRegions: () => {
        const { timeSignatures } = get();
        const regions = [];

        for (let i = 0; i < timeSignatures.length; i++) {
          const current = timeSignatures[i];
          const next = timeSignatures[i + 1];

          regions.push({
            ...current,
            startPosition: current.position,
            endPosition: next ? next.position : Infinity
          });
        }

        return regions;
      },

      // ═══════════════════════════════════════════════════════
      // TEMPO METHODS
      // ═══════════════════════════════════════════════════════

      /**
       * Add tempo marker
       */
      addTempoMarker: (position, bpm) => {
        const id = `tempo_${Date.now()}`;
        set((state) => {
          state.tempoMarkers.push({
            id,
            position,
            bpm
          });
          // Sort by position
          state.tempoMarkers.sort((a, b) => a.position - b.position);
        });
        return id;
      },

      /**
       * Remove tempo marker
       */
      removeTempoMarker: (id) => {
        set((state) => {
          const index = state.tempoMarkers.findIndex((t) => t.id === id);
          if (index !== -1 && index !== 0) {
            // Don't allow removing the first tempo marker
            state.tempoMarkers.splice(index, 1);
          }
        });
      },

      /**
       * Update tempo marker
       */
      updateTempoMarker: (id, updates) => {
        set((state) => {
          const tempo = state.tempoMarkers.find((t) => t.id === id);
          if (tempo) {
            Object.assign(tempo, updates);
            // Re-sort if position changed
            if (updates.position !== undefined) {
              state.tempoMarkers.sort((a, b) => a.position - b.position);
            }
          }
        });
      },

      /**
       * Get tempo at position
       */
      getTempoAt: (position) => {
        const { tempoMarkers } = get();

        // Find the last tempo marker before or at this position
        let current = tempoMarkers[0];
        for (const tempo of tempoMarkers) {
          if (tempo.position <= position) {
            current = tempo;
          } else {
            break;
          }
        }

        return current.bpm;
      },

      /**
       * Get all tempo regions
       */
      getTempoRegions: () => {
        const { tempoMarkers } = get();
        const regions = [];

        for (let i = 0; i < tempoMarkers.length; i++) {
          const current = tempoMarkers[i];
          const next = tempoMarkers[i + 1];

          regions.push({
            ...current,
            startPosition: current.position,
            endPosition: next ? next.position : Infinity
          });
        }

        return regions;
      },

      // ═══════════════════════════════════════════════════════
      // MARKER METHODS
      // ═══════════════════════════════════════════════════════

      /**
       * Add marker
       */
      addMarker: (position, name, options = {}) => {
        const id = `marker_${Date.now()}`;
        set((state) => {
          state.markers.push({
            id,
            position,
            name,
            color: options.color || '#3b82f6',
            type: options.type || MarkerType.BOOKMARK
          });
          // Sort by position
          state.markers.sort((a, b) => a.position - b.position);
        });
        return id;
      },

      /**
       * Remove marker
       */
      removeMarker: (id) => {
        set((state) => {
          const index = state.markers.findIndex((m) => m.id === id);
          if (index !== -1) {
            state.markers.splice(index, 1);
          }
        });
      },

      /**
       * Update marker
       */
      updateMarker: (id, updates) => {
        set((state) => {
          const marker = state.markers.find((m) => m.id === id);
          if (marker) {
            Object.assign(marker, updates);
            // Re-sort if position changed
            if (updates.position !== undefined) {
              state.markers.sort((a, b) => a.position - b.position);
            }
          }
        });
      },

      /**
       * Get nearest marker to position
       */
      getNearestMarker: (position, threshold = 4) => {
        const { markers } = get();

        let nearest = null;
        let minDistance = threshold;

        for (const marker of markers) {
          const distance = Math.abs(marker.position - position);
          if (distance < minDistance) {
            minDistance = distance;
            nearest = marker;
          }
        }

        return nearest;
      },

      /**
       * Get markers in range
       */
      getMarkersInRange: (startPosition, endPosition) => {
        const { markers } = get();
        return markers.filter(
          (m) => m.position >= startPosition && m.position <= endPosition
        );
      },

      // ═══════════════════════════════════════════════════════
      // LOOP REGION METHODS
      // ═══════════════════════════════════════════════════════

      /**
       * Add loop region
       */
      addLoopRegion: (start, end, name = 'Loop', options = {}) => {
        const id = `loop_${Date.now()}`;
        set((state) => {
          state.loopRegions.push({
            id,
            start,
            end,
            name,
            color: options.color || '#10b981',
            isActive: options.isActive || false
          });
        });
        return id;
      },

      /**
       * Remove loop region
       */
      removeLoopRegion: (id) => {
        set((state) => {
          const index = state.loopRegions.findIndex((lr) => lr.id === id);
          if (index !== -1) {
            state.loopRegions.splice(index, 1);

            // If this was the active loop, clear activeLoopRegionId
            if (state.activeLoopRegionId === id) {
              state.activeLoopRegionId = null;
            }
          }
        });
      },

      /**
       * Update loop region
       */
      updateLoopRegion: (id, updates) => {
        set((state) => {
          const loopRegion = state.loopRegions.find((lr) => lr.id === id);
          if (loopRegion) {
            Object.assign(loopRegion, updates);
          }
        });
      },

      /**
       * Set active loop region
       */
      setActiveLoopRegion: (id) => {
        set((state) => {
          // Deactivate all loop regions
          state.loopRegions.forEach((lr) => {
            lr.isActive = false;
          });

          // Activate the selected one
          if (id) {
            const loopRegion = state.loopRegions.find((lr) => lr.id === id);
            if (loopRegion) {
              loopRegion.isActive = true;
              state.activeLoopRegionId = id;
            }
          } else {
            state.activeLoopRegionId = null;
          }
        });
      },

      /**
       * Get active loop region
       */
      getActiveLoopRegion: () => {
        const { loopRegions, activeLoopRegionId } = get();
        if (!activeLoopRegionId) return null;
        return loopRegions.find((lr) => lr.id === activeLoopRegionId) || null;
      },

      /**
       * Clear active loop region
       */
      clearActiveLoopRegion: () => {
        set((state) => {
          state.loopRegions.forEach((lr) => {
            lr.isActive = false;
          });
          state.activeLoopRegionId = null;
        });
      },

      // ═══════════════════════════════════════════════════════
      // DISPLAY SETTINGS METHODS
      // ═══════════════════════════════════════════════════════

      /**
       * Update display settings
       */
      updateDisplaySettings: (updates) => {
        set((state) => {
          Object.assign(state.displaySettings, updates);
        });
      },

      // ═══════════════════════════════════════════════════════
      // UTILITY METHODS
      // ═══════════════════════════════════════════════════════

      /**
       * Calculate steps per bar at position
       */
      getStepsPerBarAt: (position) => {
        const ts = get().getTimeSignatureAt(position);
        // Assuming 4 steps per beat (16th note resolution)
        return (ts.numerator * 4) * (4 / ts.denominator);
      },

      /**
       * Calculate beats per bar at position
       */
      getBeatsPerBarAt: (position) => {
        const ts = get().getTimeSignatureAt(position);
        return ts.numerator;
      },

      /**
       * Convert step position to bar/beat/subdivision
       */
      stepToBarBeat: (step) => {
        const { timeSignatures } = get();

        let currentBar = 0;
        let currentStep = 0;

        for (let i = 0; i < timeSignatures.length; i++) {
          const ts = timeSignatures[i];
          const nextTs = timeSignatures[i + 1];
          const regionEnd = nextTs ? nextTs.position : Infinity;

          if (step < regionEnd) {
            // Step is in this time signature region
            const stepsPerBar = (ts.numerator * 4) * (4 / ts.denominator);
            const stepsInRegion = step - ts.position;
            const barsInRegion = Math.floor(stepsInRegion / stepsPerBar);
            const remainingSteps = stepsInRegion - (barsInRegion * stepsPerBar);

            currentBar += barsInRegion;
            const beat = Math.floor(remainingSteps / 4); // 4 steps per beat
            const subdivision = remainingSteps % 4;

            return {
              bar: currentBar,
              beat,
              subdivision,
              timeSignature: ts
            };
          } else {
            // Step is beyond this region, accumulate bars
            const stepsPerBar = (ts.numerator * 4) * (4 / ts.denominator);
            const stepsInRegion = regionEnd - ts.position;
            currentBar += Math.floor(stepsInRegion / stepsPerBar);
          }
        }

        return {
          bar: currentBar,
          beat: 0,
          subdivision: 0,
          timeSignature: timeSignatures[timeSignatures.length - 1]
        };
      },

      /**
       * Convert bar/beat/subdivision to step position
       */
      barBeatToStep: (bar, beat = 0, subdivision = 0) => {
        const { timeSignatures } = get();

        let step = 0;
        let currentBar = 0;

        for (let i = 0; i < timeSignatures.length; i++) {
          const ts = timeSignatures[i];
          const nextTs = timeSignatures[i + 1];
          const stepsPerBar = (ts.numerator * 4) * (4 / ts.denominator);

          // Calculate how many bars in this region
          let barsInRegion;
          if (nextTs) {
            barsInRegion = Math.floor((nextTs.position - ts.position) / stepsPerBar);
          } else {
            barsInRegion = Infinity;
          }

          if (currentBar + barsInRegion > bar) {
            // Target bar is in this region
            const barsToAdd = bar - currentBar;
            step = ts.position + (barsToAdd * stepsPerBar) + (beat * 4) + subdivision;
            break;
          } else {
            // Target bar is beyond this region
            step = nextTs.position;
            currentBar += barsInRegion;
          }
        }

        return step;
      },

      /**
       * Reset to defaults
       */
      reset: () => {
        set((state) => {
          state.timeSignatures = [
            {
              id: 'ts_0',
              position: 0,
              numerator: 4,
              denominator: 4
            }
          ];
          state.tempoMarkers = [
            {
              id: 'tempo_0',
              position: 0,
              bpm: DEFAULT_TEMPO
            }
          ];
          state.markers = [];
          state.loopRegions = [];
          state.activeLoopRegionId = null;
        });
      }
    }))
  )
);

// ═══════════════════════════════════════════════════════════
// SELECTORS (for performance optimization)
// ═══════════════════════════════════════════════════════════

export const selectTimeSignatures = (state) => state.timeSignatures;
export const selectTempoMarkers = (state) => state.tempoMarkers;
export const selectMarkers = (state) => state.markers;
export const selectLoopRegions = (state) => state.loopRegions;
export const selectActiveLoopRegion = (state) => state.getActiveLoopRegion();
export const selectDisplaySettings = (state) => state.displaySettings;

export default useTimelineStore;
