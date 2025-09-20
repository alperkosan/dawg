// src/store/useMixerStore.js - YENİDEN YAPILANDIRILMIŞ (Olay Tabanlı Mimari)

import { create } from 'zustand';
import { AudioContextService } from '../lib/services/AudioContextService';
import { initialMixerTracks } from '../config/initialData';
import { pluginRegistry } from '../config/pluginConfig';
import { v4 as uuidv4 } from 'uuid';

export const useMixerStore = create((set, get) => ({
  mixerTracks: initialMixerTracks,
  // YENİ: Aktif kanalı ve solo/mute durumlarını takip etmek için
  activeChannelId: 'master',
  soloedChannels: new Set(),
  mutedChannels: new Set(),

  // ========================================================
  // === EYLEMLER (ACTIONS) ===
  // ========================================================

  // Aktif (seçili) kanalı ayarlar, send kablolarının çizimi için kullanılır.
  setActiveChannelId: (trackId) => set({ activeChannelId: trackId }),

  // Bir kanalın Mute durumunu değiştirir.
  toggleMute: (trackId) => {
    const newMutedChannels = new Set(get().mutedChannels);
    if (newMutedChannels.has(trackId)) {
      newMutedChannels.delete(trackId);
    } else {
      newMutedChannels.add(trackId);
    }
    set({ mutedChannels: newMutedChannels });
    // SES MOTORUNA KOMUT GÖNDER: Mute durumunu ses motoruna bildir.
    AudioContextService?.setMuteState(trackId, newMutedChannels.has(trackId));
  },

  // Bir kanalın Solo durumunu değiştirir.
  toggleSolo: (trackId) => {
    const { soloedChannels } = get();
    const newSoloedChannels = new Set(soloedChannels);
    if (newSoloedChannels.has(trackId)) {
      newSoloedChannels.delete(trackId);
    } else {
      newSoloedChannels.add(trackId);
    }
    set({ soloedChannels: newSoloedChannels });
    // SES MOTORUNA KOMUT GÖNDER: Solo mantığı karmaşık olduğu için
    // tüm solo durumunu motora bildirerek doğru yönlendirmeyi yapmasını sağlarız.
    AudioContextService?.setSoloState(newSoloedChannels);
  },

  // Volume, Pan gibi temel parametreleri günceller.
  handleMixerParamChange: (trackId, param, value) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => 
        track.id === trackId ? { ...track, [param]: value } : track
      )
    }));
    AudioContextService?.updateMixerParam(trackId, param, value);
  },

  // Bir kanala yeni bir efekt ekler.
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

    // SES MOTORUNA KOMUT GÖNDER: Yeni efekt zincirini kurması için.
    if (AudioContextService && newTrackState) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState);
    }
    return newEffect; // Oluşturulan efekti döndürerek UI'ın focus yapmasını sağlar
  },

  // Bir efekti kanaldan kaldırır.
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
  
  // Efekt parametrelerini günceller.
  handleMixerEffectChange: (trackId, effectId, paramOrSettings, value) => {
    let newTrackState; // YENİ: Güncellenmiş track state'ini tutmak için
    let needsRebuild = false; // YENİ: Sinyal zincirinin yeniden kurulması gerekip gerekmediğini belirtir

    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const newTrack = {
            ...track,
            insertEffects: track.insertEffects.map(fx => {
              if (fx.id === effectId) {
                // Eğer gelen bir string ise (tek parametre)
                if (typeof paramOrSettings === 'string') {
                    // Bypass veya sidechainSource değişirse sinyal zinciri yeniden kurulmalı
                    if (paramOrSettings === 'bypass' || paramOrSettings === 'sidechainSource') {
                        needsRebuild = true;
                    }
                    const newSettings = { ...fx.settings, [paramOrSettings]: value };
                    return paramOrSettings === 'bypass' ? { ...fx, bypass: value } : { ...fx, settings: newSettings };
                }
                // Eğer gelen bir obje ise (tüm ayarlar)
                else {
                    // Sidechain kaynağı değişiyorsa, zinciri yeniden kur
                    if (fx.settings.sidechainSource !== paramOrSettings.sidechainSource) {
                        needsRebuild = true;
                    }
                    return { ...fx, settings: { ...fx.settings, ...paramOrSettings } };
                }
              }
              return fx;
            })
          };
          newTrackState = newTrack; // Güncellenmiş state'i yakala
          return newTrack;
        }
        return track;
      })
    }));
    
    // SES MOTORUNA KOMUT GÖNDER
    if (needsRebuild) {
        // Bypass veya Sidechain kaynağı değiştiyse, tüm sinyal zincirini yeniden kur
        AudioContextService?.rebuildSignalChain(trackId, newTrackState); 
    } else {
        // Diğer parametreler için anlık güncelleme yeterli
        AudioContextService?.updateEffectParam(trackId, effectId, paramOrSettings, value);
    }
  },

  // YENİ: Efektleri sürükle-bırak ile yeniden sıralamak için eylem
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

    // SES MOTORUNA KOMUT GÖNDER: Sinyal zincirini yeni sıraya göre yeniden kurması için.
    if (AudioContextService && newTrackState) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState);
    }
  },

  // YENİ: Bir kanalın rengini değiştirir.
  setTrackColor: (trackId, color) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => 
        track.id === trackId ? { ...track, color } : track
      )
    }));
  },

  // YENİ: Bir kanalın çıkışını başka bir bus'a veya master'a yönlendirir.
  setTrackOutput: (trackId, outputBusId) => {
    let newTrackState;
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          // outputBusId null ise Master'a yönlendir.
          const updatedTrack = { ...track, output: outputBusId };
          newTrackState = updatedTrack;
          return updatedTrack;
        }
        return track;
      })
    }));
    // SES MOTORUNA KOMUT: Sinyal zincirini yeni yönlendirmeye göre yeniden kur.
    if (AudioContextService && newTrackState) {
      AudioContextService.rebuildSignalChain(trackId, newTrackState);
    }
  },

  // YENİ: Bir kanalı varsayılan ayarlarına sıfırlar.
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

  // YENİ: Bir kanala yeni bir send ekler.
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

  // YENİ: Bir kanaldan bir send'i kaldırır.
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

  // YENİ: Bir send'in seviyesini günceller.
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
