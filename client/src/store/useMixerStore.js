// src/store/useMixerStore.js - YENİDEN YAZILMIŞ VE GÜÇLENDİRİLMİŞ VERSİYON

import { create } from 'zustand';
import { initialMixerTracks } from '../config/initialData';
import { pluginRegistry } from '../config/pluginConfig'; // Varsayılan ayarlar için

export const useMixerStore = create((set, get) => ({
  // ============================================
  // STATE - Tek Gerçeklik Kaynağı
  // ============================================
  mixerTracks: initialMixerTracks,
  focusedEffect: null, // Sample Editor'da hangi efektin açık olduğunu tutar

  soloedChannels: new Set(),
  mutedChannels: new Set(),

  // ============================================
  // ANLIK EYLEMLER (SES MOTORUNU DOĞRUDAN TETİKLEYENLER)
  // ============================================

  /**
   * Bir kanalın temel parametresini (volume, pan) günceller.
   * Bu fonksiyon, ÖNCE state'i günceller, SONRA anında ses motoruna komut gönderir.
   * Bu sayede UI ve ses arasında gecikme olmaz.
   */
  handleMixerParamChange: (trackId, param, value, audioEngine) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => 
        track.id === trackId ? { ...track, [param]: value } : track
      )
    }));
    audioEngine?.updateMixerParam(trackId, param, value);
  },

  /**
   * Bir efektin parametresini günceller. A/B state'ini de yönetir.
   * Bu da anında ses motoruna komut gönderir.
   */
  handleMixerEffectChange: (trackId, effectId, paramOrSettings, value, audioEngine) => {
    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const newEffects = track.insertEffects.map(fx => {
            if (fx.id === effectId) {
              let newSettings;
              // Eğer gelen 'paramOrSettings' bir string ise (tekil parametre)
              if (typeof paramOrSettings === 'string') {
                newSettings = { ...fx.settings, [paramOrSettings]: value };
              } 
              // Değilse, bir preset objesi gelmiştir (tüm ayarlar)
              else {
                newSettings = { ...fx.settings, ...paramOrSettings };
              }
              return { ...fx, settings: newSettings };
            }
            return fx;
          });
          return { ...track, insertEffects: newEffects };
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });

    // Ses motorunu anında güncelle
    const updatedTrack = get().mixerTracks.find(t => t.id === trackId);
    const updatedEffect = updatedTrack?.insertEffects.find(fx => fx.id === effectId);
    if (audioEngine && updatedEffect) {
       if (typeof paramOrSettings === 'string') {
          audioEngine.updateEffectParam(trackId, effectId, paramOrSettings, value);
       } else {
         // Preset yüklendiğinde tüm parametreleri tek tek gönder
         Object.entries(paramOrSettings).forEach(([p, v]) => {
            audioEngine.updateEffectParam(trackId, effectId, p, v);
         });
       }
    }
  },

  toggleSolo: (trackId, audioEngine) => {
    const { soloedChannels, mixerTracks } = get();
    const newSoloed = new Set(soloedChannels);
    if (newSoloed.has(trackId)) {
      newSoloed.delete(trackId);
    } else {
      newSoloed.add(trackId);
    }
    set({ soloedChannels: newSoloed });

    // Ses motoruna tüm kanalların yeni durumunu bildir
    const hasSolo = newSoloed.size > 0;
    mixerTracks.forEach(track => {
      const shouldPlay = !hasSolo || newSoloed.has(track.id);
      audioEngine?.setTrackSolo(track.id, shouldPlay);
    });
  },

  toggleMute: (trackId, audioEngine) => {
    const { mutedChannels } = get();
    const newMuted = new Set(mutedChannels);
    if (newMuted.has(trackId)) {
      newMuted.delete(trackId);
    } else {
      newMuted.add(trackId);
    }
    set({ mutedChannels: newMuted });
    
    // Ses motoruna bu kanalın yeni mute durumunu bildir
    audioEngine?.setTrackMute(trackId, newMuted.has(trackId));
  },
  
  // ============================================
  // YAPISAL EYLEMLER (TAM SENKRONİZASYON GEREKTİRENLER)
  // ============================================

  setTrackName: (trackId, newName) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, name: newName } : track
      )
    }));
  },

  handleMixerEffectAdd: (trackId, effectType) => {
    const pluginDef = pluginRegistry[effectType];
    if (!pluginDef) return;

    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const newEffect = {
            id: `fx-${Date.now()}`,
            type: effectType,
            settings: pluginDef.defaultSettings,
            bypass: false,
          };
          return { ...track, insertEffects: [...track.insertEffects, newEffect] };
        }
        return track;
      })
    }));
  },

  handleMixerEffectRemove: (trackId, effectId) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          return { ...track, insertEffects: track.insertEffects.filter(fx => fx.id !== effectId) };
        }
        return track;
      })
    }));
  },

  setFocusedEffect: (focus) => set({ focusedEffect: focus }),
}));