// src/store/useMixerStore.js - YENİDEN YAPILANDIRILMIŞ (Olay Tabanlı Mimari + UI State)

import { create } from 'zustand';
import { AudioContextService } from '../lib/services/AudioContextService';
import { initialMixerTracks } from '../config/initialData';
import { pluginRegistry } from '../config/pluginConfig';
import { v4 as uuidv4 } from 'uuid';

// REHBER ADIM 2.2: Varsayılan EQ ayarları eklendi [cite: 227-229]
const DEFAULT_EQ_SETTINGS = {
  hi: { frequency: 8000, gain: 0, q: 0.7, type: 'highshelf' },
  hiMid: { frequency: 3000, gain: 0, q: 1.0, type: 'peaking'},
  loMid: { frequency: 800, gain: 0, q: 1.0, type: 'peaking' },
  lo: {frequency: 120, gain: 0, q: 0.7, type: 'lowshelf'}
};


export const useMixerStore = create((set, get) => ({
  mixerTracks: initialMixerTracks,
  activeChannelId: 'master',
  soloedChannels: new Set(),
  mutedChannels: new Set(),

  // REHBER ADIM 2.1: Yeni UI state yönetimi nesnesi eklendi [cite: 151-157]
  mixerUIState: {
    expandedChannels: new Set(),
    visibleEQs: new Set(),
    visibleSends: new Set(),
    masterEQVisible: false,
    masterCompressorVisible: false,
  },

  // ========================================================
  // === EYLEMLER (ACTIONS) ===
  // ========================================================

  // --- Mevcut Eylemler (Değişiklik Yok) ---
  setActiveChannelId: (trackId) => set({ activeChannelId: trackId }),
  toggleMute: (trackId) => {
    const newMutedChannels = new Set(get().mutedChannels);
    newMutedChannels.has(trackId) ? newMutedChannels.delete(trackId) : newMutedChannels.add(trackId);
    set({ mutedChannels: newMutedChannels });
    AudioContextService?.setMuteState(trackId, newMutedChannels.has(trackId));
  },
  toggleSolo: (trackId) => {
    const { soloedChannels } = get();
    const newSoloedChannels = new Set(soloedChannels);
    newSoloedChannels.has(trackId) ? newSoloedChannels.delete(trackId) : newSoloedChannels.add(trackId);
    set({ soloedChannels: newSoloedChannels });
    AudioContextService?.setSoloState(newSoloedChannels);
  },
  handleMixerParamChange: (trackId, param, value) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, [param]: value } : track
      )
    }));
    AudioContextService?.updateMixerParam(trackId, param, value);
  },
   // ... Diğer mevcut eylemleriniz ...


  // REHBER ADIM 2.1: Yeni UI Eylemleri [cite: 159, 175, 192, 208, 216]
  toggleChannelExpansion: (trackId) => {
    set(state => {
      const newExpanded = new Set(state.mixerUIState.expandedChannels);
      newExpanded.has(trackId) ? newExpanded.delete(trackId) : newExpanded.add(trackId);
      return { mixerUIState: { ...state.mixerUIState, expandedChannels: newExpanded } };
    });
  },

  toggleChannelEQ: (trackId) => {
    set(state => {
      const newVisible = new Set(state.mixerUIState.visibleEQs);
      newVisible.has(trackId) ? newVisible.delete(trackId) : newVisible.add(trackId);
      return { mixerUIState: { ...state.mixerUIState, visibleEQs: newVisible } };
    });
  },

  toggleChannelSends: (trackId) => {
    set(state => {
      const newVisible = new Set(state.mixerUIState.visibleSends);
      newVisible.has(trackId) ? newVisible.delete(trackId) : newVisible.add(trackId);
      return { mixerUIState: { ...state.mixerUIState, visibleSends: newVisible } };
    });
  },
  
  // REHBER ADIM 2.2: Yeni EQ güncelleme fonksiyonu [cite: 230-251]
  updateChannelEQ: (trackId, band, param, value) => {
      set(state => ({
          mixerTracks: state.mixerTracks.map(track => {
              if (track.id === trackId) {
                  const currentEQ = track.eq || { ...DEFAULT_EQ_SETTINGS };
                  const updatedBand = { ...currentEQ[band], [param]: value };
                  return { ...track, eq: { ...currentEQ, [band]: updatedBand } };
              }
              return track;
          })
      }));
      // Değişikliği ses motoruna bildir
      AudioContextService?.updateChannelEQ(trackId, band, param, value);
  },


  // ... (handleMixerEffectAdd, remove, change, reorder vb. diğer fonksiyonlarınız burada yer alacak) ...

  handleMixerEffectAdd: (trackId, effectType) => {
    const pluginDef = pluginRegistry[effectType];
    if (!pluginDef) return null;

    const newEffect = {
      id: `fx-${uuidv4()}`,
      type: effectType,
      settings: { ...pluginDef.defaultSettings },
      bypass: false,
    };

    let newTrackState;
    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const updatedTrack = { ...track, insertEffects: [...track.insertEffects, newEffect] };
          newTrackState = updatedTrack;
          return updatedTrack;
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });

    if (AudioContextService && newTrackState) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState);
    }
    return newEffect;
  },

  handleMixerEffectRemove: (trackId, effectId) => {
    let newTrackState;
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const updatedTrack = { ...track, insertEffects: track.insertEffects.filter(fx => fx.id !== effectId) };
          newTrackState = updatedTrack;
          return updatedTrack;
        }
        return track;
      })
    }));
    if (AudioContextService && newTrackState) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState);
    }
  },

  handleMixerEffectChange: (trackId, effectId, paramOrSettings, value) => {
    let newTrackState;
    let needsRebuild = false;

    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const newTrack = {
            ...track,
            insertEffects: track.insertEffects.map(fx => {
              if (fx.id === effectId) {
                if (typeof paramOrSettings === 'string') {
                    if (paramOrSettings === 'bypass' || paramOrSettings === 'sidechainSource') {
                        needsRebuild = true;
                    }
                    const newSettings = { ...fx.settings, [paramOrSettings]: value };
                    return paramOrSettings === 'bypass' ? { ...fx, bypass: value } : { ...fx, settings: newSettings };
                }
                else {
                    if (fx.settings.sidechainSource !== paramOrSettings.sidechainSource) {
                        needsRebuild = true;
                    }
                    return { ...fx, settings: { ...fx.settings, ...paramOrSettings } };
                }
              }
              return fx;
            })
          };
          newTrackState = newTrack;
          return newTrack;
        }
        return track;
      })
    }));

    if (needsRebuild) {
        AudioContextService?.rebuildSignalChain(trackId, newTrackState);
    } else {
        AudioContextService?.updateEffectParam(trackId, effectId, paramOrSettings, value);
    }
  },

  reorderEffect: (trackId, sourceIndex, destinationIndex) => {
    let newTrackState;
    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const effects = Array.from(track.insertEffects);
          const [removed] = effects.splice(sourceIndex, 1);
          effects.splice(destinationIndex, 0, removed);
          const updatedTrack = { ...track, insertEffects: effects };
          newTrackState = updatedTrack;
          return updatedTrack;
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });

    if (AudioContextService && newTrackState) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState);
    }
  },

  setTrackColor: (trackId, color) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, color } : track
      )
    }));
  },

  setTrackOutput: (trackId, outputBusId) => {
    let newTrackState;
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const updatedTrack = { ...track, output: outputBusId };
          newTrackState = updatedTrack;
          return updatedTrack;
        }
        return track;
      })
    }));
    if (AudioContextService && newTrackState) {
      AudioContextService.rebuildSignalChain(trackId, newTrackState);
    }
  },

  resetTrack: (trackId) => {
    const originalTrack = initialMixerTracks.find(t => t.id === trackId);
    if (originalTrack) {
        let newTrackState;
        set(state => ({
            mixerTracks: state.mixerTracks.map(track => {
                if (track.id === trackId) {
                    newTrackState = { ...originalTrack };
                    return newTrackState;
                }
                return track;
            })
        }));
        if (AudioContextService && newTrackState) {
            AudioContextService.rebuildSignalChain(trackId, newTrackState);
        }
    }
  },

  addSend: (trackId, busId) => {
    let newTrackState;
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId && !track.sends.some(s => s.busId === busId)) {
           const updatedTrack = { ...track, sends: [...track.sends, { busId, level: -6 }] };
           newTrackState = updatedTrack;
           return updatedTrack;
        }
        return track;
      })
    }));
    if(AudioContextService && newTrackState) AudioContextService.rebuildSignalChain(trackId, newTrackState);
  },

  removeSend: (trackId, busId) => {
      let newTrackState;
      set(state => ({
        mixerTracks: state.mixerTracks.map(track => {
          if (track.id === trackId) {
            const updatedTrack = { ...track, sends: track.sends.filter(s => s.busId !== busId) };
            newTrackState = updatedTrack;
            return updatedTrack;
          }
          return track;
        })
      }));
      if (AudioContextService && newTrackState) AudioContextService.rebuildSignalChain(trackId, newTrackState);
  },

  updateSendLevel: (trackId, busId, level) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          return { ...track, sends: track.sends.map(s => s.busId === busId ? { ...s, level } : s) };
        }
        return track;
      })
    }));
    AudioContextService?.updateSendLevel(trackId, busId, level);
  },

  setTrackName: (trackId, newName) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, name: newName } : track
      )
    }));
  },
}));