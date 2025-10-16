/**
 * PROJECT AUDIO STORE
 *
 * Manages project-specific exported/frozen audio samples
 * Separate from FileBrowser (which is for user's file system)
 *
 * This store holds:
 * - Frozen patterns (pattern-to-audio exports)
 * - Rendered stems
 * - Bounced audio clips
 * - Any other project-generated audio
 */

import { create } from 'zustand';

export const useProjectAudioStore = create((set, get) => ({
  // Collection of project audio samples (array for stable references)
  samples: [],

  // Version counter to detect changes
  _version: 0,

  /**
   * Add exported/frozen sample to project collection
   */
  addSample: (sampleData) => {
    set(state => {
      const newSample = {
        id: sampleData.id,
        name: sampleData.name,
        assetId: sampleData.assetId,
        durationBeats: sampleData.durationBeats,
        durationSeconds: sampleData.durationSeconds,
        type: sampleData.type || 'frozen', // frozen, stem, bounce, etc.
        originalPattern: sampleData.originalPattern,
        createdAt: sampleData.createdAt || Date.now(),
        metadata: sampleData.metadata || {}
      };

      console.log(`📦 Added project audio: ${sampleData.name} (${sampleData.type})`);

      // Check if sample already exists
      const existingIndex = state.samples.findIndex(s => s.id === sampleData.id);
      if (existingIndex >= 0) {
        // Update existing
        const newSamples = [...state.samples];
        newSamples[existingIndex] = newSample;
        return { samples: newSamples, _version: state._version + 1 };
      } else {
        // Add new
        return { samples: [...state.samples, newSample], _version: state._version + 1 };
      }
    });
  },

  /**
   * Remove sample from project collection
   */
  removeSample: (sampleId) => {
    set(state => {
      const newSamples = state.samples.filter(s => s.id !== sampleId);

      if (newSamples.length < state.samples.length) {
        console.log(`🗑️ Removed project audio: ${sampleId}`);
      }

      return { samples: newSamples, _version: state._version + 1 };
    });
  },

  /**
   * Get samples by type
   */
  getSamplesByType: (type) => {
    return get().samples.filter(s => s.type === type);
  },

  /**
   * Clear all samples
   */
  clearAll: () => {
    set({ samples: [], _version: 0 });
    console.log('🗑️ Cleared all project audio samples');
  }
}));
