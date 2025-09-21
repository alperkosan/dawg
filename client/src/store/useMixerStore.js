// src/store/useMixerStore.js - YENİDEN YAPILANDIRILMIŞ (Olay Tabanlı Mimari + UI State)
/**
 * Bir efektin A/B durumunu değiştirir.
 * @param {object} fx - Mevcut efekt objesi.
 * @returns {object} - Güncellenmiş efekt objesi.
 */
const _handleABToggle = (fx) => {
  const abState = fx.abState || { isB: false, a: { ...fx.settings }, b: { ...fx.settings } };
  const nextIsB = !abState.isB;
  
  // Geçiş yapmadan önce mevcut, değiştirilmiş ayarları doğru slota kaydet.
  const stateToSave = { ...fx.settings };
  if (abState.isB) {
    abState.b = stateToSave;
  } else {
    abState.a = stateToSave;
  }

  // Yeni durumu yükle.
  const newStateToLoad = nextIsB ? abState.b : abState.a;
  return { ...fx, settings: newStateToLoad, abState: { ...abState, isB: nextIsB } };
};

/**
 * Bir efektin A durumunu B durumuna kopyalar.
 * @param {object} fx - Mevcut efekt objesi.
 * @returns {object} - Güncellenmiş efekt objesi.
 */
const _handleABCopy = (fx) => {
    const abState = fx.abState || { isB: false, a: { ...fx.settings }, b: { ...fx.settings } };
    // A/B'nin hangi durumda olduğuna bakmaksızın, o anki aktif ayarları (fx.settings) A'ya,
    // sonra da A'yı B'ye kopyalamak en güvenli yoldur.
    abState.a = { ...fx.settings };
    abState.b = { ...fx.settings };
    return { ...fx, abState: { ...abState } };
};

/**
 * Normal bir parametre değişikliğini yönetir.
 * @param {object} fx - Mevcut efekt objesi.
 * @param {string|object} paramOrSettings - Değişecek parametre veya ayarlar objesi.
 * @param {*} value - Parametrenin yeni değeri.
 * @returns {{updatedFx: object, needsRebuild: boolean}} - Güncellenmiş efekt ve sinyal zincirinin yeniden kurulup kurulmayacağı.
 */
const _handleParamChange = (fx, paramOrSettings, value) => {
    let needsRebuild = false;
    let newSettings = { ...fx.settings };
    let newFx = { ...fx };

    if (typeof paramOrSettings === 'string') {
        if (paramOrSettings === 'bypass' || paramOrSettings === 'sidechainSource') {
            needsRebuild = true;
        }
        if (paramOrSettings === 'bypass') {
            newFx.bypass = value;
        } else {
            // === HATA DÜZELTMESİ BURADA ===
            // Gelen 'value' bir fonksiyon mu diye kontrol et (örn: setBands(prevBands => ...))
            // Eğer öyleyse, mevcut state'i (newSettings[paramOrSettings]) argüman olarak kullanarak çalıştır.
            // Değilse, değeri doğrudan ata.
            const previousValue = newSettings[paramOrSettings];
            newSettings[paramOrSettings] = typeof value === 'function' ? value(previousValue) : value;
            newFx.settings = newSettings;
        }
    } else { // Gelen bir obje ise (tüm ayarlar, yani bir PRESET)
        if (fx.settings.sidechainSource !== paramOrSettings.sidechainSource) {
            needsRebuild = true;
        }
        newSettings = paramOrSettings;
        newFx.settings = newSettings;
    }
    
    return { updatedFx: newFx, needsRebuild };
};

import { create } from 'zustand';
import { AudioContextService } from '../lib/services/AudioContextService';
import { initialMixerTracks } from '../config/initialData';
import { pluginRegistry } from '../config/pluginConfig';
import { v4 as uuidv4 } from 'uuid';

// REHBER ADIM 2.2: Varsayılan EQ ayarları eklendi
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

  // REHBER ADIM 2.1: Yeni UI state yönetimi nesnesi eklendi
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

  // REHBER ADIM 2.1: Yeni UI Eylemleri
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
  
  // REHBER ADIM 2.2: Yeni EQ güncelleme fonksiyonu
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

    // --- DEĞİŞİKLİK BURADA: Yeni özel komutu yakala ---
    if (paramOrSettings === '__update_band_param') {
      const { bandId, param, newValue } = value;
      
      // 1. State'i verimli bir şekilde güncelle
      set(state => ({
        mixerTracks: state.mixerTracks.map(track => {
          if (track.id === trackId) {
            return {
              ...track,
              insertEffects: track.insertEffects.map(fx => {
                if (fx.id === effectId) {
                  const newBands = fx.settings.bands.map(b => 
                    b.id === bandId ? { ...b, [param]: newValue } : b
                  );
                  return { ...fx, settings: { ...fx.settings, bands: newBands } };
                }
                return fx;
              })
            };
          }
          return track;
        })
      }));
      
      // 2. Ses motoruna spesifik komutu gönder
      AudioContextService?.updateEffectBandParam(trackId, effectId, bandId, param, newValue);
      return; // Fonksiyonu burada sonlandır.
    }
    // --- DEĞİŞİKLİK SONU ---

    // Geri kalan normal parametre değişiklikleri için mevcut mantık devam eder
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const newTrack = { ...track,
            insertEffects: track.insertEffects.map(fx => {
              if (fx.id === effectId) {
                if (paramOrSettings === '__toggle_ab_state') return _handleABToggle(fx);
                if (paramOrSettings === '__copy_a_to_b') return _handleABCopy(fx);
                
                const result = _handleParamChange(fx, paramOrSettings, value);
                needsRebuild = needsRebuild || result.needsRebuild;
                return result.updatedFx;
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