/**
 * @file usePanelsStore.js
 * @description Arayüzdeki tüm panellerin (pencerelerin) durumunu yönetir.
 * Panellerin açık/kapalı durumu, pozisyonları, boyutları, z-index sıralaması
 * ve hangi enstrümanın hangi editörde açık olduğu gibi bilgileri tutar.
 */
import { create } from 'zustand';
import { panelDefinitions } from '../config/panelConfig';
import { getNextCascadePosition } from '../lib/utils/windowManager';
import { useInstrumentsStore } from './useInstrumentsStore';

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

  /**
   * --- YENİ VE DÜZELTİLMİŞ FONKSİYON ---
   * Belirtilen enstrüman için Piyano Rulosu'nu açar veya öne getirir.
   * 'Toggle' mantığının yarattığı belirsizlik ortadan kaldırıldı.
   */
  openPianoRollForInstrument: (instrument) => {
    if (!instrument) return;
    const state = get();
    const { panels } = state;
    const panel = panels['piano-roll'];

    // Eğer panel zaten aynı enstrüman için açıksa, sadece öne getir.
    if (panel.isOpen && state.pianoRollInstrumentId === instrument.id) {
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
          title: `Piano Roll: ${instrument.name}`,
          isOpen: true,
          isMinimized: false,
          position: newPosition,
        },
      },
    });
    get().bringPanelToFront('piano-roll');
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

  handleEditInstrument: async (instrument, audioEngine) => {
    if (!instrument || instrument.type !== 'sample') return;
    
    const state = get();
    if (state.editingInstrumentId === instrument.id && state.panels['sample-editor'].isOpen) {
      get().togglePanel('sample-editor');
      return;
    }
    
    try {
      const buffer = await audioEngine?.requestInstrumentBuffer(instrument.id);
      
      // --- GÜÇLENDİRİLMİŞ KONTROL ---
      // Eğer ses motoru bir buffer bulamazsa (dosya bozuk, yüklenememiş vb.),
      // editörü hiç açma ve kullanıcıya bilgi ver.
      if (!buffer) {
        alert(`"${instrument.name}" için ses verisi bulunamadı veya yüklenemedi. Lütfen dosya yolunu kontrol edin.`);
        return;
      }
      
      const newPosition = getNextCascadePosition(get().panels);
      set({
        editorBuffer: buffer,
        editingInstrumentId: instrument.id,
        panels: {
          ...state.panels,
          'sample-editor': { 
              ...state.panels['sample-editor'], 
              title: `Editor: ${instrument.name}`, 
              isOpen: true, 
              isMinimized: false, 
              position: newPosition 
          }
        }
      });
      get().bringPanelToFront('sample-editor');

    } catch (error) {
      // Promise'in reject olması (örn: ağ hatası) durumunda hatayı yakala.
      console.error(`Sample Editor açılamadı (${instrument.name}):`, error);
      alert(`"${instrument.name}" enstrümanı yüklenirken bir hata oluştu. Lütfen konsolu kontrol edin.`);
    }
  },
}));