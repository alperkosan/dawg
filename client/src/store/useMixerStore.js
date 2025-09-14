import { create } from 'zustand';
import { initialMixerTracks } from '../config/initialData';
import { pluginRegistry } from '../config/pluginConfig'; 

export const useMixerStore = create((set, get) => ({ // 'get' parametresini ekliyoruz
  mixerTracks: initialMixerTracks,
  focusedEffect: null,

  setFocusedEffect: (effect) => set({ focusedEffect: effect }),

  setTrackName: (trackId, newName) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, name: newName } : track
      )
    }));
  },

  handleMixerParamChange: (trackId, param, value, audioEngine) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, [param]: value } : track
      )
    }));
    audioEngine?.updateMixerParam(trackId, param, value);
  },
  
  handleMixerEffectAdd: (trackId, effectType) => {
    const pluginDefinition = pluginRegistry[effectType];
    if (!pluginDefinition) return;
    const newEffect = {
      id: `fx-${Date.now()}`,
      type: effectType,
      settings: { ...pluginDefinition.defaultSettings },
      bypass: false,
    };
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => 
          track.id === trackId 
          ? { ...track, insertEffects: [...track.insertEffects, newEffect] } 
          : track
      )
    }));
  },
  
  handleMixerEffectRemove: (trackId, effectId) => {
      set(state => ({
          mixerTracks: state.mixerTracks.map(track => 
              track.id === trackId 
              ? { ...track, insertEffects: track.insertEffects.filter(fx => fx.id !== effectId) } 
              : track
          )
      }));
  },
  
  // Sizin sağladığınız, tam entegre ve doğru çalışan fonksiyon
  handleMixerEffectChange: (trackId, effectId, paramOrSettings, value, audioEngine) => {
    // 1. Adım: State'i her zamanki gibi güncelle.
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const newEffects = track.insertEffects.map(effect => {
            if (effect.id === effectId) {
              if (typeof paramOrSettings === 'object' && paramOrSettings !== null) {
                return { ...effect, settings: { ...effect.settings, ...paramOrSettings } };
              }
              if (paramOrSettings === 'bypass') {
                  return { ...effect, bypass: value };
              }
               let newSettings = { ...effect.settings };
               if (paramOrSettings === 'bands') {
                   if (typeof value === 'function') {
                       newSettings.bands = value(effect.settings.bands);
                   } else {
                       newSettings.bands = value;
                   }
               } else {
                  newSettings = { ...newSettings, [paramOrSettings]: value };
               }
               return { ...effect, settings: newSettings };
            }
            return effect;
          });
          return { ...track, insertEffects: newEffects };
        }
        return track;
      })
    }));

    // 2. Adım: Eğer bu bir bypass değilse, anlık güncelleme için ses motoruna haber ver.
    if (audioEngine && typeof paramOrSettings === 'string' && paramOrSettings !== 'bypass') {
        // ONARIM: 'set' asenkron olduğu için, motoru bilgilendirmeden önce
        // state'in güncellenmesini beklemek üzere küçük bir gecikme ekliyoruz.
        // Bu, "get is not defined" ve "stale state" hatalarını önler.
        setTimeout(() => {
            // 3. Adım: En güncel veriyi store'dan al.
            const updatedTrack = get().mixerTracks.find(t => t.id === trackId);
            const updatedEffect = updatedTrack?.insertEffects.find(fx => fx.id === effectId);
            
            if (updatedEffect) {
                // 4. Adım: Güncellenmiş parametre değerini doğrudan ses motoruna gönder.
                const updatedValue = updatedEffect.settings[paramOrSettings];

                // Bazen 'bands' gibi tüm dizi gönderilir, bazen tekil değer.
                // Ses motorundaki updateParam her ikisini de alacak şekilde tasarlanmıştı.
                const valueToSend = paramOrSettings === 'bands' ? updatedEffect.settings.bands : updatedValue;

                audioEngine.updateEffectParam(trackId, effectId, paramOrSettings, valueToSend);
            }
        }, 0); // 0ms timeout, işlemi bir sonraki event loop tick'ine erteler.
    }
  },
}));