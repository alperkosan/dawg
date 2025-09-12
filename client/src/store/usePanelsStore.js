/**
 * @file usePanelsStore.js
 * @description Arayüzdeki tüm panellerin (pencerelerin) durumunu yönetir.
 * Panellerin açık/kapalı durumu, pozisyonları, boyutları, z-index sıralaması
 * ve hangi enstrümanın hangi editörde açık olduğu gibi bilgileri tutar.
 */
import { create } from 'zustand';
import { panelDefinitions } from '../config/panelConfig';
import { getNextCascadePosition } from '../lib/utils/windowManager';

const initialPanelsState = Object.keys(panelDefinitions).reduce((acc, id) => {
  const def = panelDefinitions[id];
  acc[id] = {
    id: id,
    title: def.title,
    isOpen: id === 'channel-rack', // Sadece channel rack başlangıçta açık
    isMinimized: false,
    position: def.initialPos,
    size: def.initialSize,
  };
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
    const panels = get().panels;
    const panel = panels[panelId];
    if (!panel) return;

    if (panel.isOpen) {
      if (get().fullscreenPanel === panelId) set({ fullscreenPanel: null });
      set(state => ({ panels: { ...state.panels, [panelId]: { ...panel, isOpen: false } } }));
    } else {
      const newPosition = getNextCascadePosition(panels);
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

  handleEditInstrument: (instrument, audioEngine) => {
    if (!instrument || instrument.type !== 'sample') return;
    const state = get();
    if (state.editingInstrumentId === instrument.id && state.panels['sample-editor'].isOpen) {
      get().togglePanel('sample-editor');
      return;
    }
    
    const buffer = audioEngine?.processedAudioBuffers?.get(instrument.id);
    if (!buffer) {
      console.error(`Buffer yüklenemedi: ${instrument.id}. AudioEngine'de bulunamadı.`);
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
  },

  /**
   * --- GÜNCELLENDİ: Sorumluluk alanı netleştirildi ---
   * Bu fonksiyon artık SADECE Piano Roll panelinin durumunu yönetir.
   * Enstrümanın 'pianoRoll' modunu değiştirmek artık bu fonksiyonun görevi DEĞİLDİR.
   */
  handleTogglePianoRoll: (instrument) => {
    const { pianoRollInstrumentId, panels } = get();
    const isOpening = pianoRollInstrumentId !== instrument.id;

    if (isOpening) {
      const newPosition = getNextCascadePosition(panels);
      set(state => ({
        pianoRollInstrumentId: instrument.id,
        panels: { ...state.panels, 'piano-roll': { ...state.panels['piano-roll'], title: `Piano Roll: ${instrument.name}`, isOpen: true, isMinimized: false, position: newPosition } }
      }));
      get().bringPanelToFront('piano-roll');
    } else {
      set(state => ({
        pianoRollInstrumentId: null,
        panels: { ...state.panels, 'piano-roll': { ...state.panels['piano-roll'], isOpen: false } }
      }));
    }
  },
}));