// client/src/store/useMixerStore.js - YENİDEN YAZILMIŞ VERSİYON

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

const useMixerStore = create(
  subscribeWithSelector(
    immer((set, get) => ({
      // ============================================
      // STATE STRUCTURE - Yeniden organize edildi
      // ============================================
      
      // Ana mixer track'leri - Array yerine Map kullanıyoruz (daha performanslı)
      mixerTracks: [],
      
      // Send sistemi için ayrı state
      sends: new Map(), // sendId -> { fromTrackId, toTrackId, level, active }
      
      // UI durumları
      activeChannelId: null,
      soloedChannels: new Set(),
      mutedChannels: new Set(),

      // ============================================
      // REAL-TIME PARAMETER UPDATES
      // ============================================
      
      /**
       * Track parametrelerini günceller ve hemen ses motoruna bildirir
       * ÖNCEDEN: Değişiklik → Store → AudioEngine sync döngüsü → Gecikme
       * SONRA: Değişiklik → Store + Immediate Audio Engine → Anında tepki
       */
      updateTrackParam: (trackId, param, value, audioEngineRef) => {
        set((state) => {
          // Store'u güncelle
          const track = state.mixerTracks.find(t => t.id === trackId);
          if (track) {
            track[param] = value;
          }
        });

        // Hemen ses motoruna bildir - UI gecikmeleri olmadan!
        if (audioEngineRef?.current) {
          audioEngineRef.current.updateMixerParam(trackId, param, value);
        }
      },

      /**
       * Effect parametrelerini günceller
       * Bu yeni fonksiyon sayesinde knob döndürünce anında ses değişir
       */
      updateEffectParam: (trackId, effectId, param, value, audioEngineRef) => {
        set((state) => {
          const track = state.mixerTracks.find(t => t.id === trackId);
          if (track) {
            const effect = track.insertEffects.find(fx => fx.id === effectId);
            if (effect) {
              // A/B state yönetimi - hangi state'deyse onu güncelle
              if (effect.abState?.isB) {
                effect.abState.stateB = { ...effect.abState.stateB, [param]: value };
                effect.settings = effect.abState.stateB;
              } else {
                if (!effect.abState) {
                  effect.abState = { isB: false, stateA: effect.settings, stateB: effect.settings };
                }
                effect.abState.stateA = { ...effect.abState.stateA, [param]: value };
                effect.settings = effect.abState.stateA;
              }
            }
          }
        });

        // Ses motoruna anında bildir
        if (audioEngineRef?.current) {
          audioEngineRef.current.updateEffectParam(trackId, effectId, param, value);
        }
      },

      // ============================================
      // A/B COMPARISON SYSTEM - Tamamen yeni!
      // ============================================
      
      /**
       * Effect'in A ve B state'leri arasında geçiş yapar
       * Profesyonel stüdyo yazılımlarındaki gibi
       */
      toggleEffectAB: (trackId, effectId, audioEngineRef) => {
        set((state) => {
          const track = state.mixerTracks.find(t => t.id === trackId);
          if (track) {
            const effect = track.insertEffects.find(fx => fx.id === effectId);
            if (effect) {
              // İlk kez A/B kullanıyorsa initialize et
              if (!effect.abState) {
                effect.abState = {
                  isB: false,
                  stateA: { ...effect.settings },
                  stateB: { ...effect.settings }
                };
              }

              // Mevcut ayarları kaydet
              if (effect.abState.isB) {
                effect.abState.stateB = { ...effect.settings };
              } else {
                effect.abState.stateA = { ...effect.settings };
              }

              // State'i değiştir ve yeni ayarları yükle
              effect.abState.isB = !effect.abState.isB;
              effect.settings = effect.abState.isB ? 
                { ...effect.abState.stateB } : 
                { ...effect.abState.stateA };
            }
          }
        });

        // Tüm parametreleri ses motoruna gönder
        const state = get();
        const track = state.mixerTracks.find(t => t.id === trackId);
        const effect = track?.insertEffects.find(fx => fx.id === effectId);
        if (effect && audioEngineRef?.current) {
          Object.entries(effect.settings).forEach(([param, value]) => {
            audioEngineRef.current.updateEffectParam(trackId, effectId, param, value);
          });
        }
      },

      /**
       * A state'ini B'ye kopyalar
       */
      copyAToB: (trackId, effectId, audioEngineRef) => {
        set((state) => {
          const track = state.mixerTracks.find(t => t.id === trackId);
          if (track) {
            const effect = track.insertEffects.find(fx => fx.id === effectId);
            if (effect?.abState) {
              effect.abState.stateB = { ...effect.abState.stateA };
              if (effect.abState.isB) {
                effect.settings = { ...effect.abState.stateB };
              }
            }
          }
        });
      },

      // ============================================
      // SEND/BUS SYSTEM - Tamamen yeni mimari!
      // ============================================
      
      /**
       * Send oluşturur (örn: Vocal -> Reverb Bus)
       */
      createSend: (fromTrackId, toTrackId, level = -20) => {
        set((state) => {
          const sendId = `${fromTrackId}->${toTrackId}`;
          state.sends.set(sendId, {
            id: sendId,
            fromTrackId,
            toTrackId,
            level,
            active: true
          });
          
          // Ana track'e de send'i ekle
          const fromTrack = state.mixerTracks.find(t => t.id === fromTrackId);
          if (fromTrack) {
            if (!fromTrack.sends) fromTrack.sends = [];
            fromTrack.sends.push({
              busId: toTrackId,
              level: level
            });
          }
        });
      },

      /**
       * Send seviyesini günceller
       */
      updateSendLevel: (sendId, level, audioEngineRef) => {
        set((state) => {
          const send = state.sends.get(sendId);
          if (send) {
            send.level = level;
            
            // Ana track'teki send'i de güncelle
            const fromTrack = state.mixerTracks.find(t => t.id === send.fromTrackId);
            if (fromTrack) {
              const trackSend = fromTrack.sends?.find(s => s.busId === send.toTrackId);
              if (trackSend) {
                trackSend.level = level;
              }
            }
          }
        });

        // Ses motoruna bildir
        if (audioEngineRef?.current) {
          const send = get().sends.get(sendId);
          if (send) {
            audioEngineRef.current.updateSendLevel(send.fromTrackId, send.toTrackId, level);
          }
        }
      },

      // ============================================
      // SOLO/MUTE SYSTEM - İyileştirilmiş
      // ============================================
      
      /**
       * Solo sistemi - sadece solo'lanan track'ler çalar
       */
      toggleSolo: (trackId, audioEngineRef) => {
        set((state) => {
          if (state.soloedChannels.has(trackId)) {
            state.soloedChannels.delete(trackId);
          } else {
            state.soloedChannels.add(trackId);
          }
        });

        // Ses motoruna tüm track'lerin yeni solo durumunu bildir
        const { soloedChannels, mixerTracks } = get();
        const hasSolo = soloedChannels.size > 0;
        
        if (audioEngineRef?.current) {
          mixerTracks.forEach(track => {
            const shouldPlay = !hasSolo || soloedChannels.has(track.id);
            audioEngineRef.current.setTrackSolo(track.id, shouldPlay);
          });
        }
      },

      /**
       * Mute sistemi
       */
      toggleMute: (trackId, audioEngineRef) => {
        set((state) => {
          if (state.mutedChannels.has(trackId)) {
            state.mutedChannels.delete(trackId);
          } else {
            state.mutedChannels.add(trackId);
          }
        });

        // Ses motoruna bildir
        if (audioEngineRef?.current) {
          const isMuted = get().mutedChannels.has(trackId);
          audioEngineRef.current.setTrackMute(trackId, isMuted);
        }
      },

      // ============================================
      // EFFECT MANAGEMENT - Geliştirilmiş
      // ============================================
      
      /**
       * Effect bypass'ını toggle eder
       */
      toggleEffectBypass: (trackId, effectId, audioEngineRef) => {
        set((state) => {
          const track = state.mixerTracks.find(t => t.id === trackId);
          if (track) {
            const effect = track.insertEffects.find(fx => fx.id === effectId);
            if (effect) {
              effect.bypass = !effect.bypass;
            }
          }
        });

        // Ses motoruna bildir
        const state = get();
        const track = state.mixerTracks.find(t => t.id === trackId);
        const effect = track?.insertEffects.find(fx => fx.id === effectId);
        
        if (effect && audioEngineRef?.current) {
          audioEngineRef.current.setEffectBypass(trackId, effectId, effect.bypass);
        }
      },

      // ============================================
      // LEGACY SUPPORT - Mevcut kodlarla uyumluluk
      // ============================================
      
      // Mevcut kodlarınız bunları kullanıyor, uyumluluk için tutuyoruz
      handleMixerParamChange: function(trackId, param, value, audioEngine) {
        return this.updateTrackParam(trackId, param, value, { current: audioEngine });
      },

      handleMixerEffectChange: function(trackId, effectId, param, value, audioEngine) {
        return this.updateEffectParam(trackId, effectId, param, value, { current: audioEngine });
      },

      handleMixerEffectAdd: (trackId, effectType) => {
        set((state) => {
          const track = state.mixerTracks.find(t => t.id === trackId);
          if (track) {
            const newEffect = {
              id: `fx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: effectType,
              bypass: false,
              settings: {}, // Plugin config'den varsayılan ayarlar gelecek
            };
            track.insertEffects.push(newEffect);
          }
        });
      },

      handleMixerEffectRemove: (trackId, effectId) => {
        set((state) => {
          const track = state.mixerTracks.find(t => t.id === trackId);
          if (track) {
            track.insertEffects = track.insertEffects.filter(fx => fx.id !== effectId);
          }
        });
      },

    }))
  )
);

export { useMixerStore };