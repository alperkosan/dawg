import { create } from 'zustand';
import { initialMixerTracks } from '../config/initialData';
import { pluginRegistry } from '../config/pluginConfig'; 

export const useMixerStore = create((set) => ({
  mixerTracks: initialMixerTracks,
  focusedEffect: null,

  setFocusedEffect: (effect) => set({ focusedEffect: effect }),

  // YENİ: Eksik olan ve hataya neden olan fonksiyonu buraya ekliyoruz
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
  
  handleMixerEffectChange: (trackId, effectId, param, value, audioEngine) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const newEffects = track.insertEffects.map(effect => {
            if (effect.id === effectId) {
              if (typeof param === 'object' && param !== null) {
                return { ...effect, settings: { ...param } };
              }
              if (param === 'bypass') {
                  return { ...effect, bypass: value };
              }
               let newSettings = { ...effect.settings };
               if (param.startsWith('bands.')) {
                   const [, bandIndex, bandParam] = param.split('.');
                   const newBands = [...newSettings.bands];
                   if (newBands[bandIndex]) newBands[bandIndex] = {...newBands[bandIndex], [bandParam]: value};
                   newSettings = { ...newSettings, bands: newBands };
               } else {
                  newSettings = { ...newSettings, [param]: value };
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

    if (typeof param === 'string') {
        audioEngine?.updateEffectParam(trackId, effectId, param, value);
    }
  },
}));