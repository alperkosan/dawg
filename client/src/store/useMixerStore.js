// src/store/useMixerStore.js
// NativeAudioEngine ile tam entegre, olay tabanlı ve UI state yönetimli modern mixer store.
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { initialMixerTracks } from '@/config/initialData';
import { pluginRegistry } from '@/config/pluginConfig';
import { storeManager } from './StoreManager';

export const useMixerStore = create((set, get) => ({
  // ========================================================
  // === AUDIO STATE (affects audio engine) ===
  // ========================================================
  mixerTracks: initialMixerTracks,
  soloedChannels: new Set(),
  mutedChannels: new Set(),
  monoChannels: new Set(), // ✅ Channels forced to mono output

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

  // ========================================================
  // === EYLEMLER (ACTIONS) ===
  // ========================================================

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
    const { soloedChannels, mutedChannels } = get();
    const newSoloedChannels = new Set(soloedChannels);
    newSoloedChannels.has(trackId) ? newSoloedChannels.delete(trackId) : newSoloedChannels.add(trackId);
    set({ soloedChannels: newSoloedChannels });
    // SES MOTORUNA KOMUT GÖNDER - mutedChannels'ı da gönder ki restore edebilsin
    if (AudioContextService.setSoloState) {
      AudioContextService.setSoloState(newSoloedChannels, mutedChannels);
    }
  },

  toggleMono: (trackId) => {
    const newMonoChannels = new Set(get().monoChannels);
    newMonoChannels.has(trackId) ? newMonoChannels.delete(trackId) : newMonoChannels.add(trackId);
    set({ monoChannels: newMonoChannels });
    // Send to audio engine
    if (AudioContextService.setMonoState) {
      AudioContextService.setMonoState(trackId, newMonoChannels.has(trackId));
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

    // 🎛️ DYNAMIC MIXER: Route to appropriate control
    if (trackId === 'master') {
      // Master controls
      const audioEngine = AudioContextService.getAudioEngine();

      if (param === 'volume' && audioEngine?.setMasterVolume) {
        // Convert dB to linear gain (0 dB = 1.0, -6 dB = 0.5, etc.)
        const linearGain = Math.pow(10, value / 20);
        audioEngine.setMasterVolume(linearGain);
        return;
      }

      if (param === 'pan' && audioEngine?.setMasterPan) {
        audioEngine.setMasterPan(value);
        return;
      }
    } else {
      // Regular track controls - use dynamic mixer insert API
      if (param === 'volume') {
        // Convert dB to linear gain
        const linearGain = Math.pow(10, value / 20);
        AudioContextService.setInsertGain(trackId, linearGain);
        return;
      }

      if (param === 'pan') {
        AudioContextService.setInsertPan(trackId, value);
        return;
      }
    }

    // Fallback for other parameters (EQ, etc.)
    if (AudioContextService.updateMixerParam) {
      AudioContextService.updateMixerParam(trackId, param, value);
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

    // 🎛️ DYNAMIC MIXER: Add effect to insert
    if (trackId === 'master') {
      // Master effects handled differently
      if (AudioContextService.rebuildSignalChain) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState).catch(error => {
          console.error('❌ Failed to rebuild master chain:', error);
        });
      }
    } else {
      // Regular track - use dynamic mixer insert API
      AudioContextService.addEffectToInsert(trackId, effectType, newEffect.settings)
        .then(effectId => {
          if (effectId) {
            // Update effect ID with the one from audio engine
            set(state => ({
              mixerTracks: state.mixerTracks.map(track => {
                if (track.id === trackId) {
                  return {
                    ...track,
                    insertEffects: track.insertEffects.map(fx =>
                      fx.id === newEffect.id ? { ...fx, audioEngineId: effectId } : fx
                    )
                  };
                }
                return track;
              })
            }));
          }
        })
        .catch(error => {
          console.error('❌ Failed to add effect:', error);
        });
    }
    return newEffect;
  },

  handleMixerEffectRemove: (trackId, effectId) => {
    let newTrackState;
    let audioEngineEffectId;

    set(state => {
      const track = state.mixerTracks.find(t => t.id === trackId);
      const effect = track?.insertEffects.find(fx => fx.id === effectId);
      audioEngineEffectId = effect?.audioEngineId || effectId;

      return {
        mixerTracks: state.mixerTracks.map(track => {
          if (track.id === trackId) {
            const updatedTrack = { ...track, insertEffects: track.insertEffects.filter(fx => fx.id !== effectId) };
            newTrackState = updatedTrack;
            return updatedTrack;
          }
          return track;
        })
      };
    });

    // 🎛️ DYNAMIC MIXER: Remove effect from insert
    if (trackId === 'master') {
      // Master effects handled differently
      if (AudioContextService.rebuildSignalChain) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState).catch(error => {
          console.error('❌ Failed to rebuild master chain:', error);
        });
      }
    } else {
      // Regular track - use dynamic mixer insert API
      AudioContextService.removeEffectFromInsert(trackId, audioEngineEffectId);
    }

    // ✅ PERFORMANCE: Use StoreManager for panel cleanup
    const panelId = `effect-${effectId}`;
    storeManager.togglePanelIfOpen(panelId);
  },

  handleMixerEffectToggle: (trackId, effectId) => {
    let currentBypass = false;

    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          return {
            ...track,
            insertEffects: track.insertEffects.map(fx => {
              if (fx.id === effectId) {
                currentBypass = fx.bypass;
                return { ...fx, bypass: !fx.bypass };
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

    if (AudioContextService.rebuildSignalChain) {
      AudioContextService.rebuildSignalChain(trackId, updatedTrack);
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
    const effect = updatedTrack?.insertEffects.find(fx => fx.id === effectId);
    const audioEngineEffectId = effect?.audioEngineId || effectId;

    // 🎛️ DYNAMIC MIXER: Update effect parameter
    if (trackId === 'master') {
      // Master effects - use rebuild
      if (needsRebuild && AudioContextService.rebuildSignalChain) {
        AudioContextService.rebuildSignalChain(trackId, updatedTrack);
      } else if (AudioContextService.updateEffectParam) {
        AudioContextService.updateEffectParam(trackId, effectId, paramOrSettings, value);
      }
    } else {
      // Regular track - use dynamic mixer insert API
      if (typeof paramOrSettings === 'string') {
        AudioContextService.updateInsertEffectParam(trackId, audioEngineEffectId, paramOrSettings, value);
      } else {
        // Multiple parameters
        Object.entries(paramOrSettings).forEach(([param, val]) => {
          AudioContextService.updateInsertEffectParam(trackId, audioEngineEffectId, param, val);
        });
      }
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

  setTrackColor: (trackId, newColor) => {
    set(state => ({
      mixerTracks: state.mixerTracks.map(track =>
        track.id === trackId ? { ...track, color: newColor } : track
      )
    }));
  },

  addTrack: (type = 'track') => {
    const { mixerTracks } = get();
    const tracksOfType = mixerTracks.filter(t => t.type === type);
    const nextNumber = tracksOfType.length + 1;

    const newTrack = {
      id: `${type}-${uuidv4()}`,
      name: type === 'bus' ? `Bus ${nextNumber}` : `Track ${nextNumber}`,
      type: type,
      volume: 0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      color: type === 'bus' ? '#f59e0b' : '#3b82f6',
      output: 'master',
      sends: [],
      insertEffects: [],
      eq: {
        enabled: false,
        lowGain: 0,
        midGain: 0,
        highGain: 0
      }
    };

    set(state => ({
      mixerTracks: [...state.mixerTracks, newTrack],
      activeChannelId: newTrack.id
    }));

    // 🎛️ DYNAMIC MIXER: Create mixer insert for this track
    AudioContextService.createMixerInsert(newTrack.id, newTrack.name);

    console.log(`✅ ${type} added: ${newTrack.name} (${newTrack.id})`);
    return newTrack.id;
  },

  removeTrack: (trackId) => {
    const { mixerTracks } = get();
    const track = mixerTracks.find(t => t.id === trackId);

    if (!track) {
      console.warn(`⚠️ Track ${trackId} not found`);
      return;
    }

    if (track.type === 'master') {
      console.error('❌ Cannot remove master channel');
      return;
    }

    // Check if any tracks are routed to this track (insert routing)
    const dependentTracks = mixerTracks.filter(t => t.output === trackId);
    if (dependentTracks.length > 0) {
      // Reroute dependent tracks to master
      dependentTracks.forEach(t => {
        console.log(`⚠️ Rerouting ${t.name} from ${trackId} to master`);
      });
    }

    // Remove sends to this track from all other tracks
    const tracksWithSends = mixerTracks.filter(t => {
      const sends = t.sends || [];
      return sends.some(s => s.busId === trackId);
    });

    set(state => {
      const newTracks = state.mixerTracks
        .filter(t => t.id !== trackId)
        .map(t => {
          // Reroute output if it was going to removed track
          let newTrack = { ...t };
          if (t.output === trackId) {
            newTrack.output = 'master';
          }
          // Remove sends to removed track
          const sends = t.sends || [];
          newTrack.sends = sends.filter(s => s.busId !== trackId);
          return newTrack;
        });

      // If removed track was active, select master
      const newActiveId = state.activeChannelId === trackId
        ? 'master'
        : state.activeChannelId;

      return {
        mixerTracks: newTracks,
        activeChannelId: newActiveId
      };
    });

    // 🎛️ DYNAMIC MIXER: Remove mixer insert for this track
    AudioContextService.removeMixerInsert(trackId);

    console.log(`✅ Track removed: ${trackId}`);
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

  // =================== SEND/INSERT ROUTING ACTIONS ===================

  /**
   * Add a send from a track to a bus
   * @param {string} trackId - Source track ID
   * @param {string} busId - Target bus ID
   * @param {number} level - Send level (0-1)
   * @param {boolean} preFader - Send before or after fader
   */
  addSend: (trackId, busId, level = 0.5, preFader = false) => {
    // ✅ SAFETY: Check for send loops before adding
    const { mixerTracks } = get();

    const wouldCreateSendLoop = (sourceId, targetId) => {
      const visited = new Set();

      const checkSendPath = (currentId) => {
        if (currentId === sourceId) return true; // Loop detected!
        if (visited.has(currentId)) return false;
        visited.add(currentId);

        const currentTrack = mixerTracks.find(t => t.id === currentId);
        if (!currentTrack) return false;

        // Check all sends from current track
        const sends = currentTrack.sends || [];
        for (const send of sends) {
          if (checkSendPath(send.busId)) return true;
        }

        return false;
      };

      return checkSendPath(targetId);
    };

    // Check for loops
    if (wouldCreateSendLoop(trackId, busId)) {
      console.error(`❌ Cannot add send: ${trackId} → ${busId} would create a feedback loop!`);
      return;
    }

    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const sends = track.sends || [];
          // Check if send already exists
          const existingSend = sends.find(s => s.busId === busId);
          if (existingSend) {
            console.warn(`⚠️ Send from ${trackId} to ${busId} already exists`);
            return track;
          }
          // Add new send
          return {
            ...track,
            sends: [...sends, { busId, level, preFader }]
          };
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });

    // Notify audio engine to create send routing
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && audioEngine.createSend) {
      audioEngine.createSend(trackId, busId, level, preFader);
    }

    console.log(`✅ Send added: ${trackId} → ${busId} (level: ${level}, preFader: ${preFader})`);
  },

  /**
   * Remove a send from a track
   * @param {string} trackId - Source track ID
   * @param {string} busId - Target bus ID
   */
  removeSend: (trackId, busId) => {
    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const sends = track.sends || [];
          return {
            ...track,
            sends: sends.filter(s => s.busId !== busId)
          };
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });

    // Notify audio engine to remove send routing
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && audioEngine.removeSend) {
      audioEngine.removeSend(trackId, busId);
    }

    console.log(`✅ Send removed: ${trackId} → ${busId}`);
  },

  /**
   * Update send level
   * @param {string} trackId - Source track ID
   * @param {string} busId - Target bus ID
   * @param {number} level - New send level (0-1)
   */
  updateSendLevel: (trackId, busId, level) => {
    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const sends = track.sends || [];
          return {
            ...track,
            sends: sends.map(s => s.busId === busId ? { ...s, level } : s)
          };
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });

    // Notify audio engine to update send level
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && audioEngine.updateSendLevel) {
      audioEngine.updateSendLevel(trackId, busId, level);
    }

    console.log(`✅ Send level updated: ${trackId} → ${busId} (level: ${level})`);
  },

  /**
   * Toggle send pre/post fader mode
   * @param {string} trackId - Source track ID
   * @param {string} busId - Target bus ID
   */
  toggleSendPreFader: (trackId, busId) => {
    let newPreFaderValue = false;

    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const sends = track.sends || [];
          return {
            ...track,
            sends: sends.map(s => {
              if (s.busId === busId) {
                newPreFaderValue = !s.preFader;
                return { ...s, preFader: newPreFaderValue };
              }
              return s;
            })
          };
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });

    // Notify audio engine to rebuild send routing
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && audioEngine.updateSendPreFader) {
      audioEngine.updateSendPreFader(trackId, busId, newPreFaderValue);
    }

    console.log(`✅ Send pre/post updated: ${trackId} → ${busId} (preFader: ${newPreFaderValue})`);
  },

  /**
   * Set track output routing (insert)
   * @param {string} trackId - Source track ID
   * @param {string} targetId - Target track/bus ID (null for master)
   */
  setTrackOutput: (trackId, targetId) => {
    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          return {
            ...track,
            output: targetId || 'master'
          };
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });

    // Notify audio engine to reroute output
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine && audioEngine.setTrackOutput) {
      audioEngine.setTrackOutput(trackId, targetId || 'master');
    }

    console.log(`✅ Track output set: ${trackId} → ${targetId || 'master'}`);
  },
}));
