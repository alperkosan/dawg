// src/store/usePanelsStore.js
// Ses motorundan bağımsız, sadece UI panellerini yönetir.
import { create } from 'zustand';
import { panelDefinitions } from '@/config/panelConfig';
import { getNextCascadePosition } from '@/lib/utils/windowManager';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { INSTRUMENT_TYPES, PANEL_IDS } from '@/config/constants';

// Başlangıç durumunu panel tanımlarından dinamik olarak oluştur.
const initialPanelsState = Object.keys(panelDefinitions).reduce((acc, id) => {
  const def = panelDefinitions[id];
  acc[id] = {
    id,
    title: def.title,
    isOpen: id === PANEL_IDS.CHANNEL_RACK || id === PANEL_IDS.MIXER_2, // Channel Rack ve Mixer_2 açık
    isMinimized: false,
    position: def.initialPos,
    size: def.initialSize
  };
  return acc;
}, {});

export const usePanelsStore = create((set, get) => ({
  panels: initialPanelsState,
  panelStack: [PANEL_IDS.CHANNEL_RACK, PANEL_IDS.MIXER_2], // Hangi panelin en üstte olduğunu takip eder
  fullscreenPanel: null,
  minimizedPanels: [],
  
  // Editörler için özel state'ler
  editingInstrumentId: null, // Hangi enstrümanın düzenlendiği
  editingClipId: null, // Hangi audio clip'in düzenlendiği (arrangement'tan)
  editorBuffer: null,      // Sample Editor için anlık AudioBuffer
  editorClipData: null, // Sample Editor için clip metadata (name, color, etc.)
  pianoRollInstrumentId: null,

  // --- EYLEMLER (ACTIONS) ---

  setEditorBuffer: (buffer) => set({ editorBuffer: buffer }),
  setEditorClipData: (clipData) => set({ editorClipData: clipData }),
  
  // Minimize edilmiş panellerin listesini güncelleyen özel fonksiyon.
  _updateMinimizedPanels: () => {
      const minimized = Object.values(get().panels).filter(p => p.isMinimized);
      set({ minimizedPanels: minimized });
  },

  bringPanelToFront: (panelId) => {
    set(state => {
      // Zaten en üstteyse bir şey yapma.
      if (state.panelStack.length > 0 && state.panelStack[state.panelStack.length - 1] === panelId) {
        return {}; 
      }
      // Paneli yığının en üstüne taşı.
      return { panelStack: [...state.panelStack.filter(p => p !== panelId), panelId] };
    });
  },

  togglePanel: (panelId) => {
    const panel = get().panels[panelId];
    if (!panel) return;

    if (panel.isOpen) {
      if (get().fullscreenPanel === panelId) set({ fullscreenPanel: null });
      const newState = { panels: { ...get().panels, [panelId]: { ...panel, isOpen: false } } };
      // Panel kapanırsa, ilgili enstrüman ID'sini de temizle.
      if (panelId === PANEL_IDS.PIANO_ROLL) newState.pianoRollInstrumentId = null;
      if (panelId === PANEL_IDS.SAMPLE_EDITOR) newState.editingInstrumentId = null;
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
  
  // Bir paneli tam ekran yapar veya eski haline getirir.
  handleMaximize: (panelId) => {
    set(state => ({ fullscreenPanel: state.fullscreenPanel === panelId ? null : panelId }));
    if (get().fullscreenPanel === panelId) get().bringPanelToFront(panelId);
  },

  // Bir paneli görev çubuğuna küçültür.
  handleMinimize: (panelId, title) => {
      set(state => ({ panels: { ...state.panels, [panelId]: { ...state.panels[panelId], isOpen: false, isMinimized: true, title } } }));
      get()._updateMinimizedPanels();
  },

  // Görev çubuğundan bir paneli geri yükler.
  handleRestore: (panelId) => {
      set(state => ({ panels: { ...state.panels, [panelId]: { ...state.panels[panelId], isOpen: true, isMinimized: false } } }));
      get().bringPanelToFront(panelId);
      get()._updateMinimizedPanels();
  },

  // Bir panelin pozisyonunu veya boyutunu günceller (DraggableWindow'dan gelir).
  updatePanelState: (panelId, newState) => {
    set(state => ({
      panels: { ...state.panels, [panelId]: { ...state.panels[panelId], ...newState } }
    }));
  },

  // Bir enstrümanı düzenlemek için ilgili editör panelini açar.
  handleEditInstrument: async (instrument) => {
    if (!instrument) return;

    // ✅ NEW: Use unified Instrument Editor Panel
    const { default: useInstrumentEditorStore } = await import('./useInstrumentEditorStore');
    const editorStore = useInstrumentEditorStore.getState();

    // Open the instrument editor with this instrument
    editorStore.openEditor(instrument.id, instrument);

    console.log('🎹 Opening Instrument Editor for:', instrument.name);
    return;

    // ⚠️ LEGACY CODE BELOW (kept for reference, but not executed)
    /*
    let panelId;
    switch (instrument.type) {
        case INSTRUMENT_TYPES.SYNTH:
            panelId = 'instrument-editor-forgesynth';
            break;
        case INSTRUMENT_TYPES.SAMPLE:
            panelId = PANEL_IDS.SAMPLE_EDITOR;
            break;
        default:
            console.warn(`Bilinmeyen enstrüman tipi için editör açılamadı: ${instrument.type}`);
            return;
    }

    const state = get();
    if (!state.panels[panelId]) {
        console.error(`Panel tanımı bulunamadı: ${panelId}`);
        return;
    }

    const isAlreadyOpenAndFocused = state.editingInstrumentId === instrument.id && state.panels[panelId]?.isOpen;

    if (isAlreadyOpenAndFocused) {
      get().bringPanelToFront(panelId);
      return;
    }
    */
    
    // Eğer bir sample ise, ses motorundan buffer'ını iste.
    if (instrument.type === INSTRUMENT_TYPES.SAMPLE) {
        const buffer = await AudioContextService.requestInstrumentBuffer(instrument.id);
        if (!buffer) {
            console.error(`"${instrument.name}" için ses verisi bulunamadı.`);
            return;
        }
        set({ editorBuffer: buffer });
    }

    const newPosition = getNextCascadePosition(get().panels);
    set(state => ({
      editingInstrumentId: instrument.id,
      panels: {
        ...state.panels,
        [panelId]: { ...state.panels[panelId], title: `Editor: ${instrument.name}`, isOpen: true, isMinimized: false, position: newPosition }
      }
    }));
    get().bringPanelToFront(panelId);
  },

  // Bir enstrüman için Piano Roll panelini açar.
  openPianoRollForInstrument: (instrument) => {
    if (!instrument) return;
    const state = get();
    const { panels, pianoRollInstrumentId } = state;
    const panel = panels[PANEL_IDS.PIANO_ROLL];

    if (panel.isOpen && pianoRollInstrumentId === instrument.id) {
      get().bringPanelToFront(PANEL_IDS.PIANO_ROLL);
      return;
    }

    const newPosition = getNextCascadePosition(panels);
    set({
      pianoRollInstrumentId: instrument.id,
      panels: {
        ...panels,
        [PANEL_IDS.PIANO_ROLL]: {
          ...panel,
          title: `Piano Roll: ${instrument.name}`,
          isOpen: true,
          isMinimized: false,
          position: newPosition,
        },
      },
    });
    get().bringPanelToFront(PANEL_IDS.PIANO_ROLL);
  },

  // Plugin/Effect panel toggle fonksiyonu
  togglePluginPanel: (effect, track) => {
    console.log('🔌 togglePluginPanel:', effect, track);

    // For now, just log the action - this would typically open a plugin UI
    // In a full implementation, this would:
    // 1. Check if plugin panel is already open for this effect
    // 2. Create/update plugin panel state
    // 3. Open the appropriate plugin UI component

    // Temporary implementation - could open a generic effect editor
    const panelId = `effect-${effect.id}`;
    const state = get();

    if (state.panels[panelId]?.isOpen) {
      // Close if already open
      set(state => ({
        panels: {
          ...state.panels,
          [panelId]: { ...state.panels[panelId], isOpen: false }
        }
      }));
    } else {
      // Open new plugin panel
      const newPosition = getNextCascadePosition(state.panels);
      set(state => ({
        panels: {
          ...state.panels,
          [panelId]: {
            id: panelId,
            type: 'plugin', // ✅ CRITICAL: This type is needed for WorkspacePanel routing
            title: `${effect.type} - ${track.name || 'Track'}`,
            isOpen: true,
            isMinimized: false,
            position: newPosition,
            size: { width: 400, height: 300 },
            effectId: effect.id,
            trackId: track.id
          }
        }
      }));

      get().bringPanelToFront(panelId);
    }
  },
}));
