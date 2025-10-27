/**
 * useInstrumentEditorStore.js
 *
 * Zustand store for instrument editor with smart history.
 * Optimized for performance - only tracks changed paths.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ParameterRegistry } from '../../../lib/audio/v2/core/ParameterRegistry.js';
import { DEFAULT_VASYNTH_CONFIG } from '../../../lib/audio/v2/core/ParameterSchema.js';

/**
 * History entry structure
 */
class HistoryEntry {
  constructor(changes, timestamp) {
    this.changes = changes; // Map of parameterId -> value
    this.timestamp = timestamp;
  }
}

/**
 * Maximum history entries
 */
const MAX_HISTORY = 100;

/**
 * Instrument editor store with smart history
 */
export const useInstrumentEditorStore = create(
  immer((set, get) => ({
    // Current instrument data
    instrumentData: null,
    instrumentId: null,

    // Parameter values (flat map for fast access)
    parameters: new Map(),

    // History
    history: [],
    historyIndex: -1,
    maxHistory: MAX_HISTORY,

    // State flags
    isDirty: false,
    isModified: false,

    // A/B comparison slots
    slotA: null,
    slotB: null,
    activeSlot: null,

    // UI state
    selectedTab: 'main',
    searchQuery: '',
    expandedGroups: new Set(['tonal', 'filter', 'dynamics']),

    // Performance metrics
    metrics: {
      totalUpdates: 0,
      historySize: 0,
      lastUpdateTime: 0,
    },

    /**
     * Initialize instrument editor with data
     */
    initInstrument: (instrumentData) => {
      set((state) => {
        state.instrumentData = instrumentData;
        state.instrumentId = instrumentData.id;
        state.isDirty = false;
        state.isModified = false;

        // Initialize parameter map from instrument data
        state.parameters = new Map();

        // Load parameters from config or use defaults
        const config = instrumentData.config || DEFAULT_VASYNTH_CONFIG;
        _flattenConfig(config, state.parameters);

        // Clear history
        state.history = [];
        state.historyIndex = -1;
      });
    },

    /**
     * Update a single parameter (smart history)
     */
    updateParameter: (parameterId, value) => {
      set((state) => {
        const oldValue = state.parameters.get(parameterId);

        // Only update if value changed
        if (oldValue === value) return;

        // Update parameter
        state.parameters.set(parameterId, value);

        // Create history entry (only changed parameter)
        const changes = new Map([[parameterId, { old: oldValue, new: value }]]);
        const entry = new HistoryEntry(changes, Date.now());

        // Trim history if at non-end position
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1);
        }

        // Add to history
        state.history.push(entry);
        state.historyIndex = state.history.length - 1;

        // Limit history size
        if (state.history.length > state.maxHistory) {
          state.history.shift();
          state.historyIndex--;
        }

        // Mark as dirty
        state.isDirty = true;
        state.isModified = true;

        // Metrics
        state.metrics.totalUpdates++;
        state.metrics.historySize = state.history.length;
        state.metrics.lastUpdateTime = Date.now();
      });
    },

    /**
     * Update multiple parameters at once
     */
    updateParameters: (updates) => {
      set((state) => {
        const changes = new Map();

        // Apply all updates
        for (const [parameterId, value] of Object.entries(updates)) {
          const oldValue = state.parameters.get(parameterId);

          if (oldValue !== value) {
            state.parameters.set(parameterId, value);
            changes.set(parameterId, { old: oldValue, new: value });
          }
        }

        // Only create history if there were changes
        if (changes.size === 0) return;

        // Create history entry
        const entry = new HistoryEntry(changes, Date.now());

        // Trim history if at non-end position
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1);
        }

        // Add to history
        state.history.push(entry);
        state.historyIndex = state.history.length - 1;

        // Limit history size
        if (state.history.length > state.maxHistory) {
          state.history.shift();
          state.historyIndex--;
        }

        // Mark as dirty
        state.isDirty = true;
        state.isModified = true;

        // Metrics
        state.metrics.totalUpdates += changes.size;
        state.metrics.historySize = state.history.length;
        state.metrics.lastUpdateTime = Date.now();
      });
    },

    /**
     * Get parameter value
     */
    getParameter: (parameterId) => {
      return get().parameters.get(parameterId);
    },

    /**
     * Get all parameters as object
     */
    getAllParameters: () => {
      return Object.fromEntries(get().parameters);
    },

    /**
     * Undo last change
     */
    undo: () => {
      set((state) => {
        if (state.historyIndex < 0) return;

        const entry = state.history[state.historyIndex];

        // Revert changes
        for (const [parameterId, change] of entry.changes) {
          state.parameters.set(parameterId, change.old);
        }

        state.historyIndex--;
        state.isDirty = true;
      });

      // Return updated parameters for audio engine sync
      return get().getAllParameters();
    },

    /**
     * Redo last undone change
     */
    redo: () => {
      set((state) => {
        if (state.historyIndex >= state.history.length - 1) return;

        state.historyIndex++;
        const entry = state.history[state.historyIndex];

        // Apply changes
        for (const [parameterId, change] of entry.changes) {
          state.parameters.set(parameterId, change.new);
        }

        state.isDirty = true;
      });

      // Return updated parameters for audio engine sync
      return get().getAllParameters();
    },

    /**
     * Can undo?
     */
    canUndo: () => {
      return get().historyIndex >= 0;
    },

    /**
     * Can redo?
     */
    canRedo: () => {
      const state = get();
      return state.historyIndex < state.history.length - 1;
    },

    /**
     * Clear history
     */
    clearHistory: () => {
      set((state) => {
        state.history = [];
        state.historyIndex = -1;
        state.metrics.historySize = 0;
      });
    },

    /**
     * Save current state to A/B slot
     */
    saveToSlot: (slot) => {
      set((state) => {
        const snapshot = new Map(state.parameters);

        if (slot === 'A') {
          state.slotA = snapshot;
        } else if (slot === 'B') {
          state.slotB = snapshot;
        }
      });
    },

    /**
     * Load state from A/B slot
     */
    loadFromSlot: (slot) => {
      set((state) => {
        const snapshot = slot === 'A' ? state.slotA : state.slotB;

        if (!snapshot) return;

        // Create history entry for all changes
        const changes = new Map();

        for (const [parameterId, value] of snapshot) {
          const oldValue = state.parameters.get(parameterId);
          if (oldValue !== value) {
            changes.set(parameterId, { old: oldValue, new: value });
          }
        }

        // Apply snapshot
        state.parameters = new Map(snapshot);

        // Add to history
        if (changes.size > 0) {
          const entry = new HistoryEntry(changes, Date.now());
          state.history.push(entry);
          state.historyIndex = state.history.length - 1;
        }

        state.activeSlot = slot;
        state.isDirty = true;
      });

      // Return updated parameters for audio engine sync
      return get().getAllParameters();
    },

    /**
     * Toggle between A/B slots
     */
    toggleSlots: () => {
      const state = get();

      if (!state.slotA || !state.slotB) return null;

      const targetSlot = state.activeSlot === 'A' ? 'B' : 'A';
      return get().loadFromSlot(targetSlot);
    },

    /**
     * Reset to default values
     */
    resetToDefaults: () => {
      set((state) => {
        const changes = new Map();

        // Reset all parameters to defaults
        const allParams = ParameterRegistry.getAll();

        for (const param of allParams) {
          const oldValue = state.parameters.get(param.id);
          const newValue = param.defaultValue;

          if (oldValue !== newValue) {
            state.parameters.set(param.id, newValue);
            changes.set(param.id, { old: oldValue, new: newValue });
          }
        }

        // Add to history
        if (changes.size > 0) {
          const entry = new HistoryEntry(changes, Date.now());
          state.history.push(entry);
          state.historyIndex = state.history.length - 1;
        }

        state.isDirty = true;
      });

      // Return updated parameters for audio engine sync
      return get().getAllParameters();
    },

    /**
     * Mark as saved (clear dirty flag)
     */
    markAsSaved: () => {
      set((state) => {
        state.isDirty = false;
        state.isModified = false;
      });
    },

    /**
     * UI: Set selected tab
     */
    setSelectedTab: (tab) => {
      set((state) => {
        state.selectedTab = tab;
      });
    },

    /**
     * UI: Set search query
     */
    setSearchQuery: (query) => {
      set((state) => {
        state.searchQuery = query;
      });
    },

    /**
     * UI: Toggle group expansion
     */
    toggleGroup: (group) => {
      set((state) => {
        if (state.expandedGroups.has(group)) {
          state.expandedGroups.delete(group);
        } else {
          state.expandedGroups.add(group);
        }
      });
    },

    /**
     * Get performance metrics
     */
    getMetrics: () => {
      return get().metrics;
    },

    /**
     * Reset store
     */
    reset: () => {
      set((state) => {
        state.instrumentData = null;
        state.instrumentId = null;
        state.parameters = new Map();
        state.history = [];
        state.historyIndex = -1;
        state.isDirty = false;
        state.isModified = false;
        state.slotA = null;
        state.slotB = null;
        state.activeSlot = null;
        state.selectedTab = 'main';
        state.searchQuery = '';
        state.expandedGroups = new Set(['tonal', 'filter', 'dynamics']);
        state.metrics = {
          totalUpdates: 0,
          historySize: 0,
          lastUpdateTime: 0,
        };
      });
    },
  }))
);

/**
 * Helper: Flatten config object to parameter map
 */
function _flattenConfig(config, paramMap, prefix = '') {
  for (const [key, value] of Object.entries(config)) {
    const parameterId = prefix ? `${prefix}_${key}` : key;

    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      // Recursively flatten nested objects
      _flattenConfig(value, paramMap, parameterId);
    } else {
      // Leaf value - add to map
      paramMap.set(parameterId, value);
    }
  }
}

export default useInstrumentEditorStore;
