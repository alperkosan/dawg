import { create } from 'zustand';
import { initialMixerTracks } from '../config/initialData';
import { pluginRegistry } from '../config/pluginConfig'; 

export const useMixerStore = create((set) => ({
  mixerTracks: initialMixerTracks,
  focusedEffect: null,

  setFocusedEffect: (effect) => set({ focusedEffect: effect }),

  handleMixerParamChange: (trackId, param, value, audioEngine) => {
    // 1. Adım: Her zamanki gibi Zustand state'ini güncelle (Bu, arayüzün güncel kalmasını sağlar).
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, [param]: value } : track
      )
    }));

    // 2. Adım (YENİ): Tüm motoru yeniden senkronize etmek yerine, 
    // AudioEngine'e sadece bu spesifik parametreyi güncellemesi için doğrudan komut gönder.
    // Bu, çok daha hızlı ve verimlidir.
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
    // 1. Adım: Her zamanki gibi Zustand state'ini güncelle.
    // Bu, arayüzün (örn: knob'un pozisyonu) anında güncel kalmasını sağlar.
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const newEffects = track.insertEffects.map(effect => {
            if (effect.id === effectId) {
              // Preset değişikliği gibi tüm ayarları değiştiren durumlar
              if (typeof param === 'object' && param !== null) {
                return { ...effect, settings: { ...param } };
              }
              // Bypass veya tekil parametre değişikliği
              if (param === 'bypass') {
                  return { ...effect, bypass: value };
              }
               let newSettings = { ...effect.settings };
               if (param.startsWith('bands.')) { // EQ gibi özel durumlar için
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

    // 2. Adım (YENİ): Eğer bu bir preset değişikliği değilse,
    // AudioEngine'e sadece bu spesifik efekt parametresini güncellemesi için komut gönder.
    if (typeof param === 'string') {
        audioEngine?.updateEffectParam(trackId, effectId, param, value);
    } else {
        // Eğer bir preset değişikliği ise (tüm ayarlar değiştiyse),
        // güvenlik için tam bir senkronizasyon tetiklemek daha iyidir.
        // Bu kod, state değiştiği için otomatik olarak sync'i tetikleyecektir.
    }
  },
}));
