/**
 * Instrument Editor Store
 * Manages state for the instrument editor panel
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useInstrumentEditorStore = create(
  devtools(
    (set, get) => ({
      // =================== STATE ===================

      // Panel state
      isOpen: false,
      instrumentId: null,
      instrumentData: null,

      // Editor state
      activeTab: 'main', // 'main' | 'effects' | 'modulation'
      isDirty: false,

      // Preview state
      previewNote: null,
      isPreviewActive: false,

      // History (for undo/redo)
      history: [],
      historyIndex: -1,
      maxHistorySize: 50,

      // =================== ACTIONS ===================

      /**
       * Open editor for instrument
       */
      openEditor: (instrumentId, instrumentData) => {
        set({
          isOpen: true,
          instrumentId,
          instrumentData,
          activeTab: 'main',
          isDirty: false,
          history: [instrumentData],
          historyIndex: 0,
        });
      },

      /**
       * Close editor
       */
      closeEditor: () => {
        const { isDirty } = get();

        // TODO: Add confirmation dialog if dirty
        if (isDirty) {
          const confirm = window.confirm('You have unsaved changes. Close anyway?');
          if (!confirm) return;
        }

        set({
          isOpen: false,
          instrumentId: null,
          instrumentData: null,
          activeTab: 'main',
          isDirty: false,
          previewNote: null,
          isPreviewActive: false,
          history: [],
          historyIndex: -1,
        });
      },

      /**
       * Switch active tab
       */
      setActiveTab: (tab) => {
        set({ activeTab: tab });
      },

      /**
       * Update instrument parameter
       * Supports nested paths (e.g., 'oscillators.0.waveform')
       */
      updateParameter: (path, value) => {
        const { instrumentData, history, historyIndex, maxHistorySize } = get();

        if (!instrumentData) return;

        // Deep clone instrument data
        const newData = JSON.parse(JSON.stringify(instrumentData));

        // Navigate to nested property
        const keys = path.split('.');
        let target = newData;

        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (target[key] === undefined) {
            target[key] = {};
          }
          target = target[key];
        }

        // Set value
        const finalKey = keys[keys.length - 1];
        target[finalKey] = value;

        // Update history (remove future if we're not at the end)
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newData);

        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        }

        set({
          instrumentData: newData,
          isDirty: true,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });

        // Notify listeners (for real-time audio updates)
        get()._notifyParameterChange(path, value);
      },

      /**
       * Undo parameter change
       */
      undo: () => {
        const { history, historyIndex } = get();

        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          set({
            instrumentData: history[newIndex],
            historyIndex: newIndex,
            isDirty: newIndex > 0,
          });
        }
      },

      /**
       * Redo parameter change
       */
      redo: () => {
        const { history, historyIndex } = get();

        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          set({
            instrumentData: history[newIndex],
            historyIndex: newIndex,
            isDirty: true,
          });
        }
      },

      /**
       * Preview a note
       */
      previewNote: (pitch) => {
        set({
          previewNote: pitch,
          isPreviewActive: true,
        });
      },

      /**
       * Stop preview
       */
      stopPreview: () => {
        set({
          previewNote: null,
          isPreviewActive: false,
        });
      },

      /**
       * Save current state
       */
      save: () => {
        const { instrumentData, instrumentId } = get();

        if (!instrumentData || !instrumentId) return;

        // TODO: Integrate with useInstrumentsStore to persist changes
        console.log('💾 Saving instrument:', instrumentId, instrumentData);

        set({ isDirty: false });
      },

      /**
       * Revert to saved state
       */
      revert: () => {
        const { history } = get();

        if (history.length > 0) {
          set({
            instrumentData: history[0],
            historyIndex: 0,
            isDirty: false,
          });
        }
      },

      /**
       * Load preset
       */
      loadPreset: (presetData) => {
        const { history, maxHistorySize } = get();

        const newHistory = [...history, presetData];

        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        }

        set({
          instrumentData: presetData,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          isDirty: true,
        });
      },

      // =================== INTERNAL ===================

      /**
       * Notify parameter change listeners
       * @private
       */
      _notifyParameterChange: (path, value) => {
        // Dispatch custom event for real-time audio updates
        window.dispatchEvent(new CustomEvent('instrumentParameterChange', {
          detail: {
            instrumentId: get().instrumentId,
            path,
            value,
          },
        }));
      },

      // =================== GETTERS ===================

      /**
       * Get parameter value by path
       */
      getParameter: (path) => {
        const { instrumentData } = get();

        if (!instrumentData) return undefined;

        const keys = path.split('.');
        let value = instrumentData;

        for (const key of keys) {
          if (value === undefined || value === null) return undefined;
          value = value[key];
        }

        return value;
      },

      /**
       * Check if can undo
       */
      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex > 0;
      },

      /**
       * Check if can redo
       */
      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },

    }),
    { name: 'InstrumentEditor' }
  )
);

export default useInstrumentEditorStore;
