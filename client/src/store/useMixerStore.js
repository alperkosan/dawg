// src/store/useMixerStore.js
// NativeAudioEngine ile tam entegre, olay tabanlı ve UI state yönetimli modern mixer store.
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { EffectService } from '@/lib/services/EffectService';
import { MixerService } from '@/lib/services/MixerService';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
import { normalizeEffectParam, normalizeEffectSettings } from '@/lib/audio/effects/parameterMappings.js';
// ✅ Empty project - no initial data
import { pluginRegistry } from '@/config/pluginConfig';
import { storeManager } from './StoreManager';

// ⚡ UTILITY: Deep clone for effect settings (prevents shared references)
const deepCloneSettings = (settings) => {
  return JSON.parse(JSON.stringify(settings));
};

export const useMixerStore = create((set, get) => ({
  // ========================================================
  // === AUDIO STATE (affects audio engine) ===
  // ========================================================
  mixerTracks: [
    // ✅ Empty project - only master track (required)
    {
      id: 'master',
      name: 'Master',
      type: 'master',
      volume: 0, // 0 dB
      pan: 0,
      isMuted: false,
      isSolo: false,
      color: '#8b5cf6',
      output: null, // Master has no output
      sends: [],
      insertEffects: [],
      eq: {
        enabled: false,
        lowGain: 0,
        midGain: 0,
        highGain: 0
      }
    }
  ], // ✅ Empty project - start with only master track
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
  // === UI STATE (merged from useMixerUIStore) ===
  // ========================================================

  // Active channel selection
  activeChannelId: 'master',

  // Expanded channels (show/hide details)
  expandedChannels: new Set(),

  // Visible EQ sections
  visibleEQs: new Set(),

  // Visible send sections
  visibleSends: new Set(),

  // Scroll position (for virtual scrolling)
  scrollPosition: 0,

  // ========================================================
  // === EYLEMLER (ACTIONS) ===
  // ========================================================

  // --- SES MOTORU EYLEMLERİ ---

  toggleMute: (trackId) => {
    const newMutedChannels = new Set(get().mutedChannels);
    newMutedChannels.has(trackId) ? newMutedChannels.delete(trackId) : newMutedChannels.add(trackId);
    set({ mutedChannels: newMutedChannels });
    // SES MOTORUNA KOMUT GÖNDER (sadece mevcut metodları çağır)
    MixerService.setMuteState(trackId, newMutedChannels.has(trackId));
  },

  toggleSolo: (trackId) => {
    const { soloedChannels, mutedChannels } = get();
    const newSoloedChannels = new Set(soloedChannels);
    newSoloedChannels.has(trackId) ? newSoloedChannels.delete(trackId) : newSoloedChannels.add(trackId);
    set({ soloedChannels: newSoloedChannels });
    // SES MOTORUNA KOMUT GÖNDER - mutedChannels'ı da gönder ki restore edebilsin
    MixerService.setSoloState(newSoloedChannels, mutedChannels);
  },

  toggleMono: (trackId) => {
    const newMonoChannels = new Set(get().monoChannels);
    newMonoChannels.has(trackId) ? newMonoChannels.delete(trackId) : newMonoChannels.add(trackId);
    set({ monoChannels: newMonoChannels });
    // Send to audio engine
    MixerService.setMonoState(trackId, newMonoChannels.has(trackId));
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
      const audioEngine = AudioEngineGlobal.get();

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
        MixerService.setInsertGain(trackId, linearGain);
        return;
      }

      if (param === 'pan') {
        MixerService.setInsertPan(trackId, value);
        return;
      }
    }

    // Fallback for other parameters (EQ, etc.)
    MixerService.updateMixerParam(trackId, param, value);
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

    // 🎛️ DYNAMIC MIXER: Add effect to insert FIRST (to get AudioEngine ID)
    if (trackId === 'master') {
      // Master effects handled differently
      const newEffect = {
        id: `master-fx-${Date.now()}`, // Temporary ID for master
        type: effectType,
        settings: deepCloneSettings(pluginDef.defaultSettings), // ⚡ Deep clone to prevent shared references
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
        const newTimestamps = new Map(state._effectOperationTimestamps);
        newTimestamps.set(trackId, now);
        return { mixerTracks: newTracks, _effectOperationTimestamps: newTimestamps };
      });

      if (AudioContextService.rebuildSignalChain) {
        AudioContextService.rebuildSignalChain(trackId, newTrackState).catch(error => {
          console.error('❌ Failed to rebuild master chain:', error);
        });
      }
      return newEffect;
    } else {
      // ✅ SIMPLIFIED: Create effect with temporary ID, update with AudioEngine ID
      // Generate temporary ID (will be replaced by AudioEngine ID)
      const tempId = `${trackId}-fx-${Date.now()}`;

      // ⚡ Deep clone settings to prevent shared references between effect instances
      const clonedSettings = deepCloneSettings(pluginDef.defaultSettings);

      const newEffect = {
        id: tempId,
        type: effectType,
        settings: clonedSettings,
        bypass: false,
      };

      // Add to Store immediately (for UI responsiveness)
      set(state => {
        const newTracks = state.mixerTracks.map(track => {
          if (track.id === trackId) {
            return { ...track, insertEffects: [...track.insertEffects, newEffect] };
          }
          return track;
        });
        const newTimestamps = new Map(state._effectOperationTimestamps);
        newTimestamps.set(trackId, now);
        return { mixerTracks: newTracks, _effectOperationTimestamps: newTimestamps };
      });

      // Create in AudioEngine (async) - use cloned settings here too
      EffectService.addEffect(trackId, effectType, clonedSettings)
        .then(effectId => {
          console.log('🔄 [useMixerStore] AudioEngine returned effectId:', {
            tempId,
            audioEngineId: effectId,
            needsUpdate: effectId !== tempId
          });

          if (effectId && effectId !== tempId) {
            // Update with actual AudioEngine ID
            set(state => {
              const updatedTracks = state.mixerTracks.map(track => {
                if (track.id === trackId) {
                  const updatedEffects = track.insertEffects.map(fx => {
                    if (fx.id === tempId) {
                      console.log('✅ [useMixerStore] Updated effect ID:', {
                        from: tempId,
                        to: effectId,
                        type: fx.type
                      });
                      return { ...fx, id: effectId };
                    }
                    return fx;
                  });
                  return { ...track, insertEffects: updatedEffects };
                }
                return track;
              });

              return { mixerTracks: updatedTracks };
            });
          }
        })
        .catch(error => {
          console.error('❌ Failed to add effect:', error);
          // Remove placeholder on error
          set(state => ({
            mixerTracks: state.mixerTracks.map(track => {
              if (track.id === trackId) {
                return {
                  ...track,
                  insertEffects: track.insertEffects.filter(fx => fx.id !== tempId)
                };
              }
              return track;
            })
          }));
        });

      return newEffect;
    }
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
      EffectService.rebuildSignalChain(trackId, newTrackState).catch(error => {
        console.error('❌ Failed to rebuild master chain:', error);
      });
    } else {
      // Regular track - use dynamic mixer insert API
      EffectService.removeEffect(trackId, audioEngineEffectId);
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

    // 🎛️ DYNAMIC MIXER: Use toggleEffectBypass instead of rebuildSignalChain
    // toggleEffectBypass is more efficient and uses MixerInsert API
    EffectService.toggleBypass(trackId, effectId, !currentBypass);
  },

  handleMixerEffectChange: (trackId, effectId, paramOrSettings, value, options = {}) => {
    let needsRebuild = false;

    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          return {
            ...track,
            insertEffects: track.insertEffects.map(fx => {
              if (fx.id === effectId) {
                const effectType = fx.type || fx.effectType;
                let newFx = {
                  ...fx,
                  settings: normalizeEffectSettings(effectType, fx.settings || {})
                };

                // ✅ FIX: Save preset information if provided
                if (options.presetId !== undefined) {
                  newFx.presetId = options.presetId;
                }
                if (options.presetName !== undefined) {
                  newFx.presetName = options.presetName;
                }
                // Clear preset info if explicitly cleared
                if (options.clearPreset === true) {
                  delete newFx.presetId;
                  delete newFx.presetName;
                }

                if (typeof paramOrSettings === 'string') {
                  const canonicalParam = normalizeEffectParam(effectType, paramOrSettings);
                  if (canonicalParam === 'bypass' || canonicalParam === 'sidechainSource') {
                    needsRebuild = true;
                  }
                  if (canonicalParam === 'bypass') {
                    newFx.bypass = value;
                  } else {
                    // ⚡ SAFETY: Deep clone for complex values (arrays/objects) to prevent shared references
                    const clonedValue = (Array.isArray(value) || (typeof value === 'object' && value !== null))
                      ? deepCloneSettings(value)
                      : value;
                    newFx.settings = { ...newFx.settings, [canonicalParam]: clonedValue };
                  }
                } else {
                  // Multiple parameters - deep clone the whole object
                  const updates = {};
                  Object.entries(paramOrSettings).forEach(([key, val]) => {
                    const canonicalKey = normalizeEffectParam(effectType, key);
                    updates[canonicalKey] = (Array.isArray(val) || (typeof val === 'object' && val !== null))
                      ? deepCloneSettings(val)
                      : val;
                  });
                  newFx.settings = { ...newFx.settings, ...updates };
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

    // ✅ SIMPLIFIED: effectId is already the AudioEngine ID (single ID system)
    const updatedTrack = get().mixerTracks.find(t => t.id === trackId);
    const trackEffect = updatedTrack?.insertEffects.find(fx => fx.id === effectId);
    const effectType = trackEffect?.type || trackEffect?.effectType;

    // 🎛️ DYNAMIC MIXER: Update effect parameter
    if (trackId === 'master') {
      // Master effects - use rebuild
      if (needsRebuild) {
        EffectService.rebuildSignalChain(trackId, updatedTrack);
      } else {
        if (typeof paramOrSettings === 'string') {
          const canonicalParam = normalizeEffectParam(effectType, paramOrSettings);
          EffectService.updateEffectParam(trackId, effectId, canonicalParam, value);
        } else {
          Object.entries(paramOrSettings).forEach(([param, val]) => {
            const canonicalParam = normalizeEffectParam(effectType, param);
            EffectService.updateEffectParam(trackId, effectId, canonicalParam, val);
          });
        }
      }
    } else {
      // Regular track - use dynamic mixer insert API
      if (typeof paramOrSettings === 'string') {
        const canonicalParam = normalizeEffectParam(effectType, paramOrSettings);
        EffectService.updateEffectParam(trackId, effectId, canonicalParam, value);
      } else {
        // Multiple parameters
        Object.entries(paramOrSettings).forEach(([param, val]) => {
          const canonicalParam = normalizeEffectParam(effectType, param);
          EffectService.updateEffectParam(trackId, effectId, canonicalParam, val);
        });
      }
    }
  },

  reorderEffect: (trackId, sourceIndex, destinationIndex) => {
    // Update store
    set(state => {
      const newTracks = state.mixerTracks.map(track => {
        if (track.id === trackId) {
          const effects = Array.from(track.insertEffects);
          const [removed] = effects.splice(sourceIndex, 1);
          effects.splice(destinationIndex, 0, removed);
          return { ...track, insertEffects: effects };
        }
        return track;
      });
      return { mixerTracks: newTracks };
    });

    // ✅ CRITICAL FIX: Reorder effects in AudioEngine (preserves settings)
    EffectService.reorderEffects(trackId, sourceIndex, destinationIndex);
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
      id: type === 'bus' ? `bus-${nextNumber}` : `${type}-${uuidv4()}`,
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
    // ✅ FIX: Create insert synchronously and verify it was created
    const audioEngine = AudioEngineGlobal.get();

    if (!audioEngine) {
      console.warn(`⚠️ AudioEngine not ready, mixer insert for ${newTrack.id} will be created later`);
      // Store will be synced when engine is ready via _syncMixerTracksToAudioEngine
    } else {
      const insert = AudioContextService.createMixerInsert(newTrack.id, newTrack.name);

      if (!insert) {
        console.warn(`⚠️ Failed to create mixer insert for ${newTrack.id}, will retry on instrument routing`);
      } else {
        console.log(`✅ Mixer insert created for ${newTrack.id}`);
      }
    }

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
    MixerService.removeMixerInsert(trackId);

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
    // Notify audio engine
    if (updates.masterLevel !== undefined) {
      MixerService.updateMixerParam(sendId, 'volume', updates.masterLevel);
    }
    if (updates.pan !== undefined) {
      MixerService.updateMixerParam(sendId, 'pan', updates.pan);
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

  // ✅ NEW: Batch update for atomic render (Wasm integration)
  batchUpdateLevels: (levelsMap) => {
    // Only update if enough time has passed (throttle)
    const now = Date.now();
    if (now - get()._levelMeterUpdateTimestamp < get()._levelMeterUpdateInterval) {
      return;
    }

    // Create new map
    const newLevelMeterData = new Map(get().levelMeterData);
    let hasChanges = false;

    // levelsMap is Object { trackId: { left, right } }
    for (const [trackId, data] of Object.entries(levelsMap)) {
      newLevelMeterData.set(trackId, {
        left: data.left,
        right: data.right,
        peak: Math.max(data.left, data.right)
      });
      hasChanges = true;
    }

    if (hasChanges) {
      set({
        levelMeterData: newLevelMeterData,
        _levelMeterUpdateTimestamp: now
      });
    }
  },

  resetLevelMeters: () => {
    set({ levelMeterData: new Map() });
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
    // Notify audio engine
    // sendParam is likely 'send1', 'send2' etc which matches sendId
    MixerService.setSendLevel(trackId, sendParam, value);
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
    const audioEngine = AudioEngineGlobal.get();
    if (audioEngine && audioEngine.createSend) {
      audioEngine.createSend(trackId, busId, level, preFader);
    }

    console.log(`✅ Send added: ${trackId} → ${busId} (level: ${level}, preFader: ${preFader})`);
  },

  /**
   * Route track output exclusively to another track (Submix)
   * Disconnects from Master.
   * @param {string} sourceId - Source track ID
   * @param {string} targetId - Target track/bus ID ('master' for reset)
   */
  routeToTrack: (sourceId, targetId) => {
    // Prevent routing to self
    if (sourceId === targetId) return;

    set(state => ({
      mixerTracks: state.mixerTracks.map(track => {
        if (track.id === sourceId) {
          return { ...track, output: targetId };
        }
        return track;
      })
    }));

    // Notify Engine
    const audioEngine = AudioEngineGlobal.get();
    if (audioEngine) {
      if (targetId === 'master') {
        if (audioEngine.routeInsertToMaster) {
          audioEngine.routeInsertToMaster(sourceId);
        }
      } else {
        if (audioEngine.routeInsertToBusExclusive) {
          audioEngine.routeInsertToBusExclusive(sourceId, targetId);
        }
      }
    }
    console.log(`🔀 Routed ${sourceId} exclusively to ${targetId}`);
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
    const audioEngine = AudioEngineGlobal.get();
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
    const audioEngine = AudioEngineGlobal.get();
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
    const audioEngine = AudioEngineGlobal.get();
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
    const audioEngine = AudioEngineGlobal.get();
    if (audioEngine && audioEngine.setTrackOutput) {
      audioEngine.setTrackOutput(trackId, targetId || 'master');
    }

    console.log(`✅ Track output set: ${trackId} → ${targetId || 'master'}`);
  },

  // ========================================================
  // === UI ACTIONS (merged from useMixerUIStore) ===
  // ========================================================

  setActiveChannelId: (trackId) => set({ activeChannelId: trackId }),

  toggleChannelExpansion: (trackId) => {
    set(state => {
      const newExpanded = new Set(state.expandedChannels);
      if (newExpanded.has(trackId)) {
        newExpanded.delete(trackId);
      } else {
        newExpanded.add(trackId);
      }
      return { expandedChannels: newExpanded };
    });
  },

  toggleChannelEQ: (trackId) => {
    set(state => {
      const newVisible = new Set(state.visibleEQs);
      if (newVisible.has(trackId)) {
        newVisible.delete(trackId);
      } else {
        newVisible.add(trackId);
      }
      return { visibleEQs: newVisible };
    });
  },

  toggleChannelSends: (trackId) => {
    set(state => {
      const newVisible = new Set(state.visibleSends);
      if (newVisible.has(trackId)) {
        newVisible.delete(trackId);
      } else {
        newVisible.add(trackId);
      }
      return { visibleSends: newVisible };
    });
  },

  setScrollPosition: (position) => set({ scrollPosition: position }),

  // Reset all UI state
  resetMixerUIState: () => set({
    activeChannelId: 'master',
    expandedChannels: new Set(),
    visibleEQs: new Set(),
    visibleSends: new Set(),
    scrollPosition: 0
  })
}));

// ⚡ FIX: Expose store globally to avoid circular dependency with AudioContextService
if (typeof window !== 'undefined') {
  if (!window.__DAWG_STORES__) {
    window.__DAWG_STORES__ = {};
  }
  window.__DAWG_STORES__.useMixerStore = useMixerStore;
  console.log('✅ useMixerStore exposed globally');
}
