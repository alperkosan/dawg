// src/store/useMixerStore.js
// NativeAudioEngine ile tam entegre, olay tabanlı ve UI state yönetimli modern mixer store.
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AudioContextService } from '../lib/services/AudioContextService';
import { initialMixerTracks } from '../config/initialData';
import { pluginRegistry } from '../config/pluginConfig';
import { storeManager } from './StoreManager';

export const useMixerStore = create((set, get) => ({
  mixerTracks: initialMixerTracks,
  activeChannelId: 'master',
  soloedChannels: new Set(),
  mutedChannels: new Set(),

  // ✅ SAFETY: Rate limiting for effect operations
  _effectOperationTimestamps: new Map(),
  _effectOperationCooldown: 100, // 100ms cooldown between operations

  // ✅ PERFORMANCE: Level meter rate limiting
  _levelMeterUpdateTimestamp: 0,
  _levelMeterUpdateInterval: 16, // ~60fps for level meters
  levelMeterData: new Map(), // Store level data separately from UI state

  // Send channels for routing audio to effects
  sendChannels: [
    { id: 'send1', name: 'Reverb', type: 'send', masterLevel: 0, pan: 0 },
    { id: 'send2', name: 'Delay', type: 'send', masterLevel: 0, pan: 0 }
  ],

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

  toggleChannelSends: (trackId) => {
    set(state => {
      const newVisible = new Set(state.mixerUIState.visibleSends);
      newVisible.has(trackId) ? newVisible.delete(trackId) : newVisible.add(trackId);
      return { mixerUIState: { ...state.mixerUIState, visibleSends: newVisible } };
    });
  },

  // --- SES MOTORU EYLEMLERİ ---

  toggleMute: (trackId) => {
    const newMutedChannels = new Set(get().mutedChannels);
    newMutedChannels.has(trackId) ? newMutedChannels.delete(trackId) : newMutedChannels.add(trackId);
    set({ mutedChannels: newMutedChannels });
    // SES MOTORUNA KOMUT GÖNDER (sadece mevcut metodları çağır)
    if (AudioContextService.setMuteState) {
      AudioContextService.setMuteState(trackId, newMutedChannels.has(trackId));
    }
  },

  toggleSolo: (trackId) => {
    const { soloedChannels } = get();
    const newSoloedChannels = new Set(soloedChannels);
    newSoloedChannels.has(trackId) ? newSoloedChannels.delete(trackId) : newSoloedChannels.add(trackId);
    set({ soloedChannels: newSoloedChannels });
    // SES MOTORUNA KOMUT GÖNDER (sadece mevcut metodları çağır)
    if (AudioContextService.setSoloState) {
      AudioContextService.setSoloState(newSoloedChannels);
    }
  },

  handleMixerParamChange: (trackId, param, value) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          // Handle nested parameters (e.g., 'eq.highGain')
          if (param.includes('.')) {
            const [parent, child] = param.split('.');
            return {
              ...track,
              [parent]: {
                ...track[parent],
                [child]: value
              }
            };
          }
          return { ...track, [param]: value };
        }
        return track;
      })
    }));
    // SES MOTORUNA KOMUT GÖNDER (sadece mevcut metodları çağır)
    if (AudioContextService.updateMixerParam) {
      AudioContextService.updateMixerParam(trackId, param, value);
    } else {
      console.warn('⚠️ AudioContextService.updateMixerParam not found! Track:', trackId, param, value);
      // Fallback: Try to access audio engine directly
      const audioEngine = AudioContextService.getAudioEngine();
      if (audioEngine && audioEngine.updateMixerParam) {
        audioEngine.updateMixerParam(trackId, param, value);
      }
    }
  },

  handleMixerEffectAdd: (trackId, effectType) => {
    // ✅ SAFETY: Rate limiting to prevent rapid-fire effect operations
    const now = Date.now();
    const lastOperation = get()._effectOperationTimestamps.get(trackId);

    if (lastOperation && (now - lastOperation) < get()._effectOperationCooldown) {
      console.warn('⚠️ Effect operation rate limited for track:', trackId);
      return null;
    }

    const pluginDef = pluginRegistry[effectType];
    if (!pluginDef) {
      console.error('❌ Plugin definition not found for:', effectType);
      return null;
    }

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
      // ✅ SAFETY: Update rate limiting timestamp
      const newTimestamps = new Map(state._effectOperationTimestamps);
      newTimestamps.set(trackId, now);

      return {
        mixerTracks: newTracks,
        _effectOperationTimestamps: newTimestamps
      };
    });

    // SES MOTORUNA KOMUT GÖNDER: Sinyal zincirini yeniden kur.
    if (newTrackState && AudioContextService.rebuildSignalChain) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState).catch(error => {
          console.error('❌ Failed to rebuild signal chain:', error);
        });
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
    if (newTrackState && AudioContextService.rebuildSignalChain) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState).catch(error => {
          console.error('❌ Failed to rebuild signal chain:', error);
        });
    }

    // ✅ PERFORMANCE: Use StoreManager for panel cleanup
    const panelId = `effect-${effectId}`;
    storeManager.togglePanelIfOpen(panelId);
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

    if (needsRebuild && AudioContextService.rebuildSignalChain) {
        AudioContextService.rebuildSignalChain(trackId, updatedTrack);
    } else if (AudioContextService.updateEffectParam) {
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
    if (newTrackState && AudioContextService.rebuildSignalChain) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState).catch(error => {
          console.error('❌ Failed to rebuild signal chain:', error);
        });
    }
  },

  setTrackName: (trackId, newName) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, name: newName } : track
      )
    }));
  },

  // --- SEND CHANNEL ACTIONS ---

  addSendChannel: (sendChannel) => {
    const newSend = {
      id: uuidv4(),
      type: 'send',
      masterLevel: 0,
      pan: 0,
      ...sendChannel
    };
    set(state => ({
      sendChannels: [...state.sendChannels, newSend]
    }));
    return newSend.id;
  },

  removeSendChannel: (sendId) => {
    set(state => {
      // Remove send from sendChannels array
      const newSendChannels = state.sendChannels.filter(send => send.id !== sendId);

      // Remove send data from all tracks
      const newMixerTracks = state.mixerTracks.map(track => {
        const newSends = { ...track.sends };
        delete newSends[sendId];
        delete newSends[`${sendId}_muted`];
        return { ...track, sends: newSends };
      });

      return {
        sendChannels: newSendChannels,
        mixerTracks: newMixerTracks
      };
    });
    // Notify audio engine
    if (AudioContextService.removeSendChannel) {
      AudioContextService.removeSendChannel(sendId);
    }
  },

  updateSendChannel: (sendId, updates) => {
    set(state => ({
      sendChannels: state.sendChannels.map(send =>
        send.id === sendId ? { ...send, ...updates } : send
      )
    }));
    // Notify audio engine
    if (AudioContextService.updateSendChannel) {
      AudioContextService.updateSendChannel(sendId, updates);
    }
  },

  // ✅ PERFORMANCE: Throttled level meter updates
  updateLevelMeterData: (trackId, levelData) => {
    const now = Date.now();
    const state = get();

    // Rate limiting - only update if enough time has passed
    if (now - state._levelMeterUpdateTimestamp < state._levelMeterUpdateInterval) {
      return;
    }

    set(state => {
      const newLevelMeterData = new Map(state.levelMeterData);
      newLevelMeterData.set(trackId, {
        peak: levelData.peak || 0,
        rms: levelData.rms || 0,
        timestamp: now
      });

      return {
        levelMeterData: newLevelMeterData,
        _levelMeterUpdateTimestamp: now
      };
    });
  },

  handleSendChange: (trackId, sendParam, value) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const newSends = { ...track.sends, [sendParam]: value };
          return { ...track, sends: newSends };
        }
        return track;
      })
    }));
    // Notify audio engine
    if (AudioContextService.updateSendLevel) {
      AudioContextService.updateSendLevel(trackId, sendParam, value);
    }
  },
}));
