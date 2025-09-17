// src/store/useMixerStore.js - YENİDEN YAZILMIŞ (Olay Tabanlı Mimari)

import { create } from 'zustand';
import { initialMixerTracks } from '../config/initialData';
import { pluginRegistry } from '../config/pluginConfig';
import { v4 as uuidv4 } from 'uuid';

export const useMixerStore = create((set, get) => ({
  mixerTracks: initialMixerTracks,

  // ========================================================
  // === DOĞRUDAN SES MOTORUNU TETİKLEYEN EYLEMLER      ===
  // ========================================================
  // Bu eylemler, state'i güncelledikten sonra anında ses motoruna
  // "ne yapması gerektiğini" söylerler.

  handleMixerParamChange: (trackId, param, value, audioEngine) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => 
        track.id === trackId ? { ...track, [param]: value } : track
      )
    }));
    // SES MOTORUNA KOMUT GÖNDER
    audioEngine?.updateMixerParam(trackId, param, value);
  },
  
  handleMixerEffectChange: (trackId, effectId, paramOrSettings, value, audioEngine) => {
    let changedEffect = null;
    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const newEffects = track.insertEffects.map(fx => {
            if (fx.id === effectId) {
              const newSettings = typeof paramOrSettings === 'string'
                ? { ...fx.settings, [paramOrSettings]: value }
                : { ...fx.settings, ...paramOrSettings };
              changedEffect = { ...fx, settings: newSettings };
              return changedEffect;
            }
            return fx;
          });
          return { ...track, insertEffects: newEffects };
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });

    // SES MOTORUNA KOMUT GÖNDER
    if (audioEngine && changedEffect) {
       if (typeof paramOrSettings === 'string') {
          audioEngine.updateEffectParam(trackId, effectId, paramOrSettings, value);
       } else {
         Object.entries(paramOrSettings).forEach(([p, v]) => {
            audioEngine.updateEffectParam(trackId, effectId, p, v);
         });
       }
    }
  },

  toggleMute: (trackId, audioEngine) => {
    let isMuted = false;
    set(state => ({
        mixerTracks: state.mixerTracks.map(track => {
            if (track.id === trackId) {
                isMuted = !track.isMuted;
                return { ...track, isMuted };
            }
            return track;
        })
    }));
    // SES MOTORUNA KOMUT GÖNDER
    audioEngine?.toggleMute(trackId, isMuted);
  },

  // ========================================================
  // === YAPISAL DEĞİŞİKLİK YARATAN EYLEMLER            ===
  // ========================================================
  
  handleMixerEffectAdd: (trackId, effectType, audioEngine) => {
    const pluginDef = pluginRegistry[effectType];
    if (!pluginDef) return;

    const newEffect = {
      id: `fx-${uuidv4()}`,
      type: effectType,
      settings: { ...pluginDef.defaultSettings },
      bypass: false,
    };

    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          return { ...track, insertEffects: [...track.insertEffects, newEffect] };
        }
        return track;
      })
    }));
    
    // SES MOTORUNA KOMUT GÖNDER
    // Not: Motor, en güncel track verisini store'dan kendisi okuyacak.
    audioEngine?.addEffectToTrack(trackId, newEffect);
  },

  handleMixerEffectRemove: (trackId, effectId, audioEngine) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          return { ...track, insertEffects: track.insertEffects.filter(fx => fx.id !== effectId) };
        }
        return track;
      })
    }));
    
    // SES MOTORUNA KOMUT GÖNDER
    audioEngine?.removeEffectFromTrack(trackId, effectId);
  },

  setTrackName: (trackId, newName) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, name: newName } : track
      )
    }));
  },
}));
