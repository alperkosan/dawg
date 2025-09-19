import { create } from 'zustand';
import { panelDefinitions } from '../config/panelConfig';
import { getNextCascadePosition } from '../lib/utils/windowManager';
import { AudioContextService } from '../lib/services/AudioContextService';
import { INSTRUMENT_TYPES, PANEL_IDS } from '../config/constants'; // GÜNCELLENDİ

const initialPanelsState = Object.keys(panelDefinitions).reduce((acc, id) => {
  const def = panelDefinitions[id];
  acc[id] = { id, title: def.title, isOpen: id === PANEL_IDS.CHANNEL_RACK, isMinimized: false, position: def.initialPos, size: def.initialSize };
  return acc;
}, {});

export const usePanelsStore = create((set, get) => ({
  panels: initialPanelsState,
  panelStack: [PANEL_IDS.CHANNEL_RACK],
  fullscreenPanel: null,
  minimizedPanels: [],
  editingInstrumentId: null,
  editorBuffer: null,
  pianoRollInstrumentId: null,

  setEditorBuffer: (buffer) => set({ editorBuffer: buffer }),
  
  _updateMinimizedPanels: () => {
      const minimized = Object.values(get().panels).filter(p => p.isMinimized);
      set({ minimizedPanels: minimized });
  },

  bringPanelToFront: (panelId) => {
    set(state => {
      if (state.panelStack.length > 0 && state.panelStack[state.panelStack.length - 1] === panelId) {
        return {};
      }
      return { panelStack: [...state.panelStack.filter(p => p !== panelId), panelId] };
    });
  },

  togglePanel: (panelId) => {
    const panel = get().panels[panelId];
    if (!panel) return;
    if (panel.isOpen) {
      if (get().fullscreenPanel === panelId) set({ fullscreenPanel: null });
      const newState = { panels: { ...get().panels, [panelId]: { ...panel, isOpen: false } } };
      if (panelId === PANEL_IDS.PIANO_ROLL) newState.pianoRollInstrumentId = null; // GÜNCELLENDİ
      if (panelId === PANEL_IDS.SAMPLE_EDITOR) newState.editingInstrumentId = null; // GÜNCELLENDİ
      set(newState);
    } else {
      const newPosition = getNextCascadePosition(get().panels);
      set(state => ({
        panels: { ...state.panels, [panelId]: { ...panel, isOpen: true, isMinimized: false, position: newPosition } }
      }));
      get().bringPanelToFront(panelId);
    }
    get()._updateMinimizedPanels();
  },

  handleMaximize: (panelId) => {
    set(state => ({ fullscreenPanel: state.fullscreenPanel === panelId ? null : panelId }));
    if (get().fullscreenPanel === panelId) get().bringPanelToFront(panelId);
  },

  handleMinimize: (panelId, title) => {
      set(state => ({ panels: { ...state.panels, [panelId]: { ...state.panels[panelId], isOpen: false, isMinimized: true, title } } }));
      get()._updateMinimizedPanels();
  },

  handleRestore: (panelId) => {
      set(state => ({ panels: { ...state.panels, [panelId]: { ...state.panels[panelId], isOpen: true, isMinimized: false } } }));
      get().bringPanelToFront(panelId);
      get()._updateMinimizedPanels();
  },

  updatePanelState: (panelId, newState) => {
    set(state => ({
      panels: { ...state.panels, [panelId]: { ...state.panels[panelId], ...newState } }
    }));
  },

  handleEditInstrument: async (instrument) => {
    if (!instrument || instrument.type !== INSTRUMENT_TYPES.SAMPLE) return; // GÜNCELLENDİ
    const state = get();
    if (state.editingInstrumentId === instrument.id && state.panels[PANEL_IDS.SAMPLE_EDITOR].isOpen) { // GÜNCELLENDİ
      get().togglePanel(PANEL_IDS.SAMPLE_EDITOR); // GÜNCELLENDİ
      return;
    }
    try {
      const buffer = await AudioContextService?.requestInstrumentBuffer(instrument.id);

      if (!buffer) {
        alert(`"${instrument.name}" için ses verisi bulunamadı.`);
        return;
      }
      const newPosition = getNextCascadePosition(get().panels);
      set({
        editorBuffer: buffer,
        editingInstrumentId: instrument.id,
        panels: {
          ...state.panels,
          [PANEL_IDS.SAMPLE_EDITOR]: { ...state.panels[PANEL_IDS.SAMPLE_EDITOR], title: `Editor: ${instrument.name}`, isOpen: true, isMinimized: false, position: newPosition } // GÜNCELLENDİ
        }
      });
      get().bringPanelToFront(PANEL_IDS.SAMPLE_EDITOR); // GÜNCELLENDİ
    } catch (error) {
      console.error(`Sample Editor açılamadı (${instrument.name}):`, error);
    }
  },

  openPianoRollForInstrument: (instrument) => {
    if (!instrument) return;
    const state = get();
    const { panels, pianoRollInstrumentId } = state;
    const panel = panels[PANEL_IDS.PIANO_ROLL]; // GÜNCELLENDİ

    if (panel.isOpen && pianoRollInstrumentId === instrument.id) {
      get().bringPanelToFront(PANEL_IDS.PIANO_ROLL); // GÜNCELLENDİ
      return;
    }

    const newPosition = getNextCascadePosition(panels);
    set({
      pianoRollInstrumentId: instrument.id,
      panels: {
        ...panels,
        [PANEL_IDS.PIANO_ROLL]: { // GÜNCELLENDİ
          ...panel,
          title: `Piano Roll: ${instrument.name}`,
          isOpen: true,
          isMinimized: false,
          position: newPosition,
        },
      },
    });
    get().bringPanelToFront(PANEL_IDS.PIANO_ROLL); // GÜNCELLENDİ
  },

  togglePluginPanel: (effect, track) => {
    const panelId = `plugin-${effect.id}`;
    const state = get();
    const existingPanel = state.panels[panelId];

    if (existingPanel?.isOpen) {
      get().bringPanelToFront(panelId);
    } else {
      const newPosition = getNextCascadePosition(state.panels);
      const newPanel = {
        id: panelId,
        title: `${effect.type} (${track.name})`,
        isOpen: true,
        isMinimized: false,
        position: newPosition,
        size: { width: 450, height: 300 },
        type: 'plugin',
        effectId: effect.id,
        trackId: track.id,
      };

      set({
        panels: { ...state.panels, [panelId]: newPanel },
        panelStack: [...state.panelStack, panelId],
      });
    }
  },

  closePluginPanel: (panelId) => {
      set(state => {
          const newPanels = { ...state.panels };
          delete newPanels[panelId];
          return {
              panels: newPanels,
              panelStack: state.panelStack.filter(pId => pId !== panelId)
          };
      });
  },
}));
