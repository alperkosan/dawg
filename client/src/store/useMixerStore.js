// src/store/useMixerStore.js
// NativeAudioEngine ile tam entegre, olay tabanlı ve UI state yönetimli modern mixer store.
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AudioContextService } from '../lib/services/AudioContextService';
import { initialMixerTracks } from '../config/initialData';
import { pluginRegistry } from '../config/pluginConfig';

export const useMixerStore = create((set, get) => ({
  mixerTracks: initialMixerTracks,
  activeChannelId: 'master',
  soloedChannels: new Set(),
  mutedChannels: new Set(),

  // Mikser arayüzünün durumunu (örn. hangi kanalın genişletildiği) tutan ayrı bir nesne.
  // Bu, ses state'i ile UI state'ini birbirinden ayırır.
  mixerUIState: {
    expandedChannels: new Set(),
    visibleEQs: new Set(),
    visibleSends: new Set(),
  },

  // ========================================================
  // === EYLEMLER (ACTIONS) ===
  // ========================================================

  // --- UI EYLEMLERİ ---
  setActiveChannelId: (trackId) => set({ activeChannelId: trackId }),
  
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

  // --- SES MOTORU EYLEMLERİ ---

  toggleMute: (trackId) => {
    const newMutedChannels = new Set(get().mutedChannels);
    newMutedChannels.has(trackId) ? newMutedChannels.delete(trackId) : newMutedChannels.add(trackId);
    set({ mutedChannels: newMutedChannels });
    // SES MOTORUNA KOMUT GÖNDER
    AudioContextService.setMuteState(trackId, newMutedChannels.has(trackId));
  },

  toggleSolo: (trackId) => {
    const { soloedChannels } = get();
    const newSoloedChannels = new Set(soloedChannels);
    newSoloedChannels.has(trackId) ? newSoloedChannels.delete(trackId) : newSoloedChannels.add(trackId);
    set({ soloedChannels: newSoloedChannels });
    // SES MOTORUNA KOMUT GÖNDER
    AudioContextService.setSoloState(newSoloedChannels);
  },

  handleMixerParamChange: (trackId, param, value) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, [param]: value } : track
      )
    }));
    // SES MOTORUNA KOMUT GÖNDER
    AudioContextService.updateMixerParam(trackId, param, value);
  },

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

    // SES MOTORUNA KOMUT GÖNDER: Sinyal zincirini yeniden kur.
    if (newTrackState) {
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
    // SES MOTORUNA KOMUT GÖNDER
    if (newTrackState) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState);
    }
  },

  handleMixerEffectChange: (trackId, effectId, paramOrSettings, value) => {
    let needsRebuild = false;

    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          return {
            ...track,
            insertEffects: track.insertEffects.map(fx => {
              if (fx.id === effectId) {
                let newFx = { ...fx };
                if (typeof paramOrSettings === 'string') {
                  if (paramOrSettings === 'bypass' || paramOrSettings === 'sidechainSource') {
                    needsRebuild = true;
                  }
                  if (paramOrSettings === 'bypass') {
                    newFx.bypass = value;
                  } else {
                    newFx.settings = { ...fx.settings, [paramOrSettings]: value };
                  }
                } else {
                  newFx.settings = { ...fx.settings, ...paramOrSettings };
                }
                return newFx;
              }
              return fx;
            })
          };
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });
    
    const updatedTrack = get().mixerTracks.find(t => t.id === trackId);

    if (needsRebuild) {
        AudioContextService.rebuildSignalChain(trackId, updatedTrack); 
    } else {
        AudioContextService.updateEffectParam(trackId, effectId, paramOrSettings, value);
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
          newTrackState = { ...track, insertEffects: effects };
          return newTrackState;
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });
    
    // SES MOTORUNA KOMUT GÖNDER
    if (newTrackState) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState);
    }
  },

  setTrackName: (trackId, newName) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, name: newName } : track
      )
    }));
  },
}));
