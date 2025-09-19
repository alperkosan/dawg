/**
 * @file usePanelsStore.js
 * @description Arayüzdeki tüm panellerin (pencerelerin) durumunu yönetir.
 * YENİLİK: Artık sadece ana panelleri değil, her bir efekt plug-in'i için
 * açılan pencereleri de dinamik olarak yönetir.
 */
import { create } from 'zustand';
import { panelDefinitions } from '../config/panelConfig';
import { getNextCascadePosition } from '../lib/utils/windowManager';
import { AudioContextService } from '../lib/services/AudioContextService';

const initialPanelsState = Object.keys(panelDefinitions).reduce((acc, id) => {
  const def = panelDefinitions[id];
  acc[id] = { id, title: def.title, isOpen: id === 'channel-rack', isMinimized: false, position: def.initialPos, size: def.initialSize };
  return acc;
}, {});

export const usePanelsStore = create((set, get) => ({
  // --- STATE ---
  panels: initialPanelsState,
  panelStack: ['channel-rack'],
  fullscreenPanel: null,
  minimizedPanels: [],
  editingInstrumentId: null,
  editorBuffer: null,
  pianoRollInstrumentId: null,

  setEditorBuffer: (buffer) => set({ editorBuffer: buffer }),
  
  // --- ACTIONS ---
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
      if (panelId === 'piano-roll') newState.pianoRollInstrumentId = null;
      if (panelId === 'sample-editor') newState.editingInstrumentId = null; // Kapanınca ID'yi temizle
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
    if (!instrument || instrument.type !== 'sample') return;
    const state = get();
    if (state.editingInstrumentId === instrument.id && state.panels['sample-editor'].isOpen) {
      get().togglePanel('sample-editor');
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
          'sample-editor': { ...state.panels['sample-editor'], title: `Editor: ${instrument.name}`, isOpen: true, isMinimized: false, position: newPosition }
        }
      });
      get().bringPanelToFront('sample-editor');
    } catch (error) {
      console.error(`Sample Editor açılamadı (${instrument.name}):`, error);
    }
  },

  openPianoRollForInstrument: (instrument) => {
    if (!instrument) return;
    const state = get();
    const { panels, pianoRollInstrumentId } = state;
    const panel = panels['piano-roll'];

    // Eğer panel zaten aynı enstrüman için açıksa, sadece öne getir.
    if (panel.isOpen && pianoRollInstrumentId === instrument.id) {
      get().bringPanelToFront('piano-roll');
      return;
    }

    // Değilse, paneli bu enstrüman için aç ve state'i güncelle.
    const newPosition = getNextCascadePosition(panels);
    set({
      pianoRollInstrumentId: instrument.id, // Önce ID'yi ayarla
      panels: {
        ...panels,
        'piano-roll': {
          ...panel,
          title: `Piano Roll: ${instrument.name}`, // Başlığı dinamik olarak ayarla
          isOpen: true,
          isMinimized: false,
          position: newPosition,
        },
      },
    });
    get().bringPanelToFront('piano-roll');
  },

  // YENİ VE GELİŞMİŞ: Efekt pencerelerini açan/kapatan/öne getiren fonksiyon
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
        size: { width: 450, height: 300 }, // Varsayılan plugin pencere boyutu
        type: 'plugin', // Bu bir plugin penceresi
        effectId: effect.id, // Hangi efekte ait
        trackId: track.id,   // Hangi kanala ait
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