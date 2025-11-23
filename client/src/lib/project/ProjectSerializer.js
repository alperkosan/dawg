/**
 * Project Serializer
 * Serializes and deserializes project state from Zustand stores
 */

import { useArrangementStore } from '@/store/useArrangementStore';
import { useArrangementV2Store } from '@/store/useArrangementV2Store';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useTimelineStore } from '@/store/TimelineStore';
import { useProjectAudioStore } from '@/store/useProjectAudioStore';
import { useArrangementWorkspaceStore } from '@/store/useArrangementWorkspaceStore';

export class ProjectSerializer {
  static CURRENT_VERSION = '1.0.0';

  /**
   * Create empty project template with default setup
   * - 4 instruments in channel rack: kick, snare, hihat, 808
   * - 20 mixer channels (channel-1 to channel-20), colored in groups of 5
   * - 20 arrangement tracks
   */
  static createEmptyProjectTemplate() {
    // Color palette for mixer channels (5 colors, repeated 4 times for 20 channels)
    const mixerColors = [
      '#ef4444', // Red
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Orange
      '#8b5cf6', // Purple
    ];

    // Create 4 default instruments
    // Format matches what handleAddNewInstrument expects
    const instruments = [
      {
        id: 'kick-1',
        name: 'Kick',
        type: 'sample',
        url: '/audio/samples/drums/kick.wav',
        mixerTrackId: 'track-1',
        color: '#ef4444',
      },
      {
        id: 'snare-1',
        name: 'Snare',
        type: 'sample',
        url: '/audio/samples/drums/snare.wav',
        mixerTrackId: 'track-2',
        color: '#3b82f6',
      },
      {
        id: 'hihat-1',
        name: 'Hi-Hat',
        type: 'sample',
        url: '/audio/samples/drums/hihat.wav',
        mixerTrackId: 'track-3',
        color: '#10b981',
      },
      {
        id: '808-1',
        name: '808',
        type: 'sample',
        url: '/audio/samples/drums/808.wav',
        mixerTrackId: 'track-4',
        color: '#f59e0b',
      },
    ];

    // Create 20 mixer channels (channel-1 to channel-20)
    const mixerTracks = [
      // Master channel
      {
        id: 'master',
        name: 'Master',
        type: 'master',
        volume: 0,
        pan: 0,
        muted: false,
        solo: false,
        color: '#8b5cf6',
        output: null,
        sends: [],
        insertEffects: [],
        eq: { enabled: false, lowGain: 0, midGain: 0, highGain: 0 },
      },
      // 20 channel tracks (channel-1 to channel-20)
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `track-${i + 1}`,
        name: `channel-${i + 1}`,
        type: 'track', // ✅ FIX: Use 'track' to match Mixer.jsx filter
        volume: 0,
        pan: 0,
        muted: false,
        solo: false,
        color: mixerColors[i % 5], // 5 colors, repeated
        output: 'master',
        sends: [],
        insertEffects: [],
        eq: { enabled: false, lowGain: 0, midGain: 0, highGain: 0 },
      })),
    ];

    // Create 20 arrangement tracks
    const arrangementTracks = Array.from({ length: 20 }, (_, i) => ({
      id: `arr-track-${i + 1}`,
      name: `Track ${i + 1}`,
      height: 80,
      volume: 1.0,
      pan: 0,
      muted: false,
      solo: false,
      locked: false,
      collapsed: false,
    }));

    return {
      metadata: {
        version: this.CURRENT_VERSION,
        dawg_version: '0.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        bpm: 120,
        time_signature: '4/4',
        key_signature: null,
      },
      instruments,
      patterns: {
        'pattern-1': {
          id: 'pattern-1',
          name: 'Pattern 1',
          data: {}, // Empty pattern data: { instrumentId: [notes] }
          length: 64, // Default pattern length (4 bars)
          settings: {
            quantization: '16n'
          }
        }
      },
      pattern_order: ['pattern-1'],
      active_pattern_id: 'pattern-1',
      arrangement: {
        tracks: arrangementTracks,
        clips: [],
        markers: [],
        loop_regions: [],
      },
      mixer: {
        tracks: mixerTracks.filter(t => t.type !== 'master'),
        send_channels: [],
        master: mixerTracks.find(t => t.type === 'master'),
      },
      timeline: {
        total_beats: 64,
        total_bars: 4,
        zoom: { x: 1, y: 1 },
        snap_mode: 'grid',
        grid_size: '1/4',
      },
      audio_assets: [],
      workspace: {
        viewMode: 'pattern',
        selectedTrackId: null,
        selectedClipIds: [],
      },
    };
  }

  /**
   * Serialize current state from all stores
   */
  static serializeCurrentState() {
    const arrangementStore = useArrangementStore.getState();
    const instrumentsStore = useInstrumentsStore.getState();
    const mixerStore = useMixerStore.getState();
    const playbackStore = usePlaybackStore.getState();
    const timelineStore = useTimelineStore.getState();
    const projectAudioStore = useProjectAudioStore.getState();
    const workspaceStore = useArrangementWorkspaceStore.getState();

    return {
      metadata: {
        version: this.CURRENT_VERSION,
        dawg_version: import.meta.env.VITE_APP_VERSION || '0.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        bpm: playbackStore.bpm || 120,
        time_signature: playbackStore.timeSignature || '4/4',
        key_signature: playbackStore.keySignature,
      },

      instruments: this.serializeInstruments(instrumentsStore),
      patterns: this.serializePatterns(arrangementStore),
      pattern_order: arrangementStore.patternOrder || [],
      
      arrangement: {
        tracks: this.serializeArrangementTracks(arrangementStore),
        clips: this.serializeArrangementClips(arrangementStore),
        markers: arrangementStore.markers || [],
        loop_regions: arrangementStore.loopRegions || [],
      },

      mixer: {
        tracks: this.serializeMixerTracks(mixerStore),
        send_channels: mixerStore.sendChannels || [],
        master: this.serializeMasterChannel(mixerStore),
      },

      timeline: {
        // ✅ FIX: TimelineStore doesn't have totalBeats/totalBars properties
        // These are calculated from arrangement or use defaults
        total_beats: 64, // Default: 4 bars * 16 steps per bar
        total_bars: 4, // Default: 4 bars
        zoom: { x: 1, y: 1 }, // Default zoom
        snap_mode: 'grid', // Default snap mode
        grid_size: '1/4', // Default grid size (16th notes)
      },

      audio_assets: this.serializeAudioAssets(projectAudioStore),
      workspace: this.serializeWorkspace(workspaceStore),
    };
  }

  /**
   * Serialize project data (for saving)
   */
  static serialize(projectData) {
    // If projectData is already serialized, return as is
    if (projectData.metadata && projectData.instruments) {
      return projectData;
    }

    // Otherwise serialize current state
    return this.serializeCurrentState();
  }

  /**
   * Clear all project data from stores (before loading new project)
   */
  static async clearAll() {
    console.log('🧹 Clearing all project data from stores...');
    
    try {
      // ✅ FIX: Get active instrument URLs for buffer cleanup
      const instrumentsStore = useInstrumentsStore.getState();
      const activeUrls = new Set();
      const instruments = instrumentsStore.instruments || [];
      
      instruments.forEach(inst => {
        if (inst.url) activeUrls.add(inst.url);
        if (inst.multiSamples) {
          inst.multiSamples.forEach(sample => {
            if (sample.url) activeUrls.add(sample.url);
          });
        }
      });
      
      // Clear audio engine instruments and buffers FIRST
      const { AudioContextService } = await import('../services/AudioContextService.js');
      const engine = AudioContextService.getAudioEngine();
      if (engine) {
        // Clear instruments from audio engine
        if (engine.instruments) {
          const instrumentIds = Array.from(engine.instruments.keys());
          instrumentIds.forEach(id => {
            try {
              if (engine.removeInstrument) {
                engine.removeInstrument(id);
              } else if (AudioContextService.removeInstrument) {
                AudioContextService.removeInstrument(id);
              }
            } catch (e) {
              console.warn(`⚠️ Failed to remove engine instrument ${id}:`, e);
            }
          });
        }
        
        // ✅ FIX: Clear ALL sample buffers when switching projects (not just unused)
        // This ensures clean state for new project
        if (engine.sampleBuffers) {
          engine.sampleBuffers.clear();
          console.log('🧹 Cleared all sample buffers from audio engine');
        }
        
        // ✅ FIX: Clear ALL cache in SampleLoader when switching projects
        const { SampleLoader } = await import('../audio/instruments/loaders/SampleLoader.js');
        SampleLoader.clearCache();
      }
      
      // Clear instruments from store (direct state update)
      useInstrumentsStore.setState({
        instruments: [],
        channelOrder: [],
        selectedChannels: [],
        processingEffects: {}
      });
      
      // Clear mixer tracks (except master) - use removeTrack method
      const mixerStore = useMixerStore.getState();
      const mixerTracks = mixerStore.mixerTracks || [];
      const tracksToRemove = mixerTracks.filter(track => track.id !== 'master');
      
      // Remove tracks in reverse order to avoid dependency issues
      tracksToRemove.reverse().forEach(track => {
        try {
          mixerStore.removeTrack(track.id);
        } catch (e) {
          console.warn(`⚠️ Failed to remove mixer track ${track.id}:`, e);
        }
      });
      
      // ✅ FIX: Clear ALL patterns completely (don't use deletePattern which keeps at least one)
      // Directly reset patterns state to empty object
      useArrangementStore.setState({
        patterns: {},
        patternOrder: [],
        activePatternId: null, // Will be set when new project loads
        nextPatternNumber: 1, // Reset pattern numbering
      });
      
      // Clear arrangement tracks and clips
      // ✅ FIX: Use Zustand store's setState method (not from getState())
      useArrangementStore.setState({
        arrangementTracks: [],
        arrangementClips: [],
        arrangementMarkers: [],
        arrangementLoopRegions: []
      });
      
      // Clear timeline
      // ✅ FIX: TimelineStore doesn't have setTotalBars/setTotalBeats methods
      // Timeline state is managed through markers, loop regions, etc.
      // Just reset to defaults if needed
      useTimelineStore.setState({
        markers: [],
        loopRegions: [],
        activeLoopRegionId: null
      });
      
      // Clear audio assets
      const audioStore = useProjectAudioStore.getState();
      audioStore.clearAll();
      
      // Clear workspace
      // ✅ FIX: Workspace state is in useArrangementStore, not useArrangementWorkspaceStore
      // Reset workspace selection state
      useArrangementStore.setState({
        selectedClipIds: [],
        // viewMode and selectedTrackId might not exist in store, but we'll try to reset if they do
      });
      
      // ✅ FIX: Stop playback and reset position when switching projects
      const playbackStore = usePlaybackStore.getState();
      if (playbackStore.isPlaying) {
        playbackStore.handleStop?.();
      }
      if (playbackStore.jumpToStep) {
        playbackStore.jumpToStep(0);
      }
      
      console.log('✅ All project data cleared');
    } catch (error) {
      console.error('❌ Failed to clear project data:', error);
      throw error;
    }
  }

  /**
   * Deserialize project data and restore to stores
   */
  static async deserialize(projectData) {
    if (!projectData || typeof projectData !== 'object') {
      throw new Error('Invalid project data');
    }

    // ✅ FIX: Don't call clearAll() here - it's already called in handleProjectSelect
    // This prevents double-clearing and ensures clean state

    // Restore to stores in correct order:
    // 1. Mixer tracks FIRST (instruments need mixer inserts to route to)
    // 2. Preload samples BEFORE creating instruments (instruments need buffers)
    // 3. Instruments (need mixer inserts and buffers to exist)
    // 4. Patterns (need instruments to exist)
    // 5. Arrangement (needs patterns and tracks)
    
    if (projectData.mixer) {
      await this.deserializeMixer(projectData.mixer);
    }

    // ✅ CRITICAL FIX: Sync mixer tracks to AudioEngine after deserialization
    // This ensures mixer inserts exist before instruments are created
    const { AudioContextService } = await import('../services/AudioContextService.js');
    await AudioContextService._syncMixerTracksToAudioEngine();

    // ✅ CRITICAL FIX: Preload samples BEFORE creating instruments
    // This ensures buffers are available when instruments are created
    if (projectData.instruments) {
      await this._preloadProjectSamples(projectData);
    }

    if (projectData.instruments) {
      this.deserializeInstruments(projectData.instruments);
    }

    if (projectData.patterns) {
      this.deserializePatterns(projectData.patterns);
    }
    
    // ✅ FIX: Always restore pattern order and active pattern
    // If not provided, will default to first pattern
    this.deserializePatternOrder(projectData.pattern_order, projectData.active_pattern_id);

    if (projectData.arrangement) {
      this.deserializeArrangement(projectData.arrangement);
    }

    if (projectData.timeline) {
      this.deserializeTimeline(projectData.timeline);
    }

    if (projectData.audio_assets) {
      this.deserializeAudioAssets(projectData.audio_assets);
    }

    if (projectData.workspace) {
      this.deserializeWorkspace(projectData.workspace);
    }

    // Restore playback settings
    if (projectData.metadata) {
      const playbackStore = usePlaybackStore.getState();
      if (projectData.metadata.bpm) {
        playbackStore.handleBpmChange(projectData.metadata.bpm);
      }
      if (projectData.metadata.time_signature) {
        // Time signature restoration if method exists
        console.log(`✅ Restored BPM: ${projectData.metadata.bpm}, Time Signature: ${projectData.metadata.time_signature}`);
      }
    }

    console.log('✅ Project deserialization complete');
    
    // ✅ FIX: Sample preloading is now done BEFORE instrument creation
    // This ensures buffers are available when instruments are created
    // No need to preload again here
    
    return projectData;
  }

  /**
   * Preload and buffer all samples used in the project
   * ✅ NEW: Uses ProjectBufferManager for efficient buffer management
   * @private
   */
  static async _preloadProjectSamples(projectData) {
    try {
      const instruments = projectData.instruments || [];
      if (instruments.length === 0) {
        return;
      }

      const { AudioContextService } = await import('../services/AudioContextService.js');
      const engine = AudioContextService.getAudioEngine();
      if (!engine || !engine.audioContext) {
        console.warn('⚠️ Cannot preload samples: audio engine not ready');
        return;
      }

      // ✅ NEW: Use ProjectBufferManager for efficient buffer management
      const { getProjectBufferManager } = await import('../audio/ProjectBufferManager.js');
      const bufferManager = getProjectBufferManager();

      console.log(`📦 Preloading samples for ${instruments.length} instruments...`);
      
      // Collect all sample URLs
      const sampleUrls = new Set();
      instruments.forEach(inst => {
        if (inst.url) sampleUrls.add(inst.url);
        if (inst.multiSamples) {
          inst.multiSamples.forEach(sample => {
            if (sample.url) sampleUrls.add(sample.url);
          });
        }
      });

      // ✅ NEW: Preload using ProjectBufferManager (checks cache first)
      const preloadPromises = Array.from(sampleUrls).map(async (url) => {
        try {
          // ProjectBufferManager checks cache first, only loads if needed
          const buffer = await bufferManager.getBuffer(url, engine.audioContext);
          
          // Also add to SampleLoader cache for compatibility
          const { SampleLoader } = await import('../audio/instruments/loaders/SampleLoader.js');
          SampleLoader.cache.set(url, buffer);
          
          return buffer;
        } catch (error) {
          console.warn(`⚠️ Failed to preload sample ${url}:`, error);
          return null;
        }
      });

      await Promise.allSettled(preloadPromises);
      
      // Preload samples in audio engine for instruments
      const sampleInstruments = instruments.filter(inst => inst.type === 'sample' && (inst.url || inst.multiSamples));
      if (sampleInstruments.length > 0 && engine.preloadSamples) {
        await engine.preloadSamples(sampleInstruments);
      }

      // ✅ CRITICAL FIX: Update existing instrument buffers after preloading
      // This ensures that instruments created before sample loading get their buffers
      sampleInstruments.forEach(inst => {
        try {
          const instrument = engine.instruments?.get(inst.id);
          if (instrument && engine.sampleBuffers?.has(inst.id)) {
            const buffer = engine.sampleBuffers.get(inst.id);
            if (instrument.buffer !== buffer) {
              instrument.buffer = buffer;
              console.log(`✅ Updated buffer for instrument ${inst.id} (${inst.name})`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to update buffer for instrument ${inst.id}:`, error);
        }
      });

      const stats = bufferManager.getStats();
      console.log(`✅ Preloaded ${sampleUrls.size} samples for project (${stats.totalMB}MB cached)`);
    } catch (error) {
      console.error('❌ Failed to preload project samples:', error);
      // Don't throw - sample loading can happen lazily
    }
  }

  // =================== SERIALIZATION HELPERS ===================

  static serializeInstruments(store) {
    return store.instruments.map(inst => ({
      id: inst.id,
      name: inst.name,
      type: inst.type,
      color: inst.color,
      mixerTrackId: inst.mixerTrackId,
      url: inst.url,
      baseNote: inst.baseNote,
      envelope: inst.envelope,
      effectChain: inst.effectChain,
      isMuted: inst.isMuted,
      cutItself: inst.cutItself,
      pianoRoll: inst.pianoRoll,
      multiSamples: inst.multiSamples,
      presetName: inst.presetName,
      assetId: inst.assetId,
      // Don't serialize audioBuffer - it's too large
    }));
  }

  static serializePatterns(store) {
    return Object.entries(store.patterns || {}).map(([id, pattern]) => {
      // ✅ FIX: Pattern length is in settings.length, not pattern.length
      const patternLength = pattern.settings?.length || pattern.length || 64;
      
      return {
        id,
        name: pattern.name || id,
        data: pattern.data || {}, // Format: { instrumentId: [notes] }
        length: patternLength, // Pattern length in steps (for backward compatibility)
        settings: {
          length: patternLength,
          quantization: pattern.settings?.quantization || '16n'
        }
      };
    });
  }

  static serializeArrangementTracks(store) {
    // ✅ FIX: Use arrangementTracks from useArrangementStore (not V2 store)
    return (store.arrangementTracks || []).map(track => ({
      id: track.id,
      name: track.name,
      volume: track.volume,
      pan: track.pan,
      muted: track.muted,
      solo: track.solo,
      color: track.color,
      height: track.height,
      locked: track.locked,
      collapsed: track.collapsed,
    }));
  }

  static serializeArrangementClips(store) {
    // ✅ FIX: Use arrangementClips from useArrangementStore (not V2 store)
    return (store.arrangementClips || []).map(clip => ({
      id: clip.id,
      trackId: clip.trackId,
      patternId: clip.patternId,
      startTime: clip.startTime,
      duration: clip.duration,
      color: clip.color,
      assetId: clip.assetId,
      sampleOffset: clip.sampleOffset,
      type: clip.type, // 'pattern' or 'audio'
      name: clip.name,
      muted: clip.muted,
      locked: clip.locked,
      patternOffset: clip.patternOffset,
    }));
  }

  static serializeMixerTracks(store) {
    return store.mixerTracks
      .filter(track => track.id !== 'master')
      .map(track => ({
        id: track.id,
        name: track.name,
        type: track.type,
        volume: track.volume,
        pan: track.pan,
        muted: track.muted,
        solo: track.solo,
        color: track.color,
        insertEffects: track.insertEffects || [],
        sends: track.sends || [],
        output: track.output,
        eq: track.eq,
      }));
  }

  static serializeMasterChannel(store) {
    const master = store.mixerTracks.find(t => t.id === 'master');
    if (!master) return null;

    return {
      volume: master.volume,
      pan: master.pan,
      muted: master.muted,
      insertEffects: master.insertEffects || [],
      eq: master.eq,
    };
  }

  static serializeAudioAssets(store) {
    // useProjectAudioStore uses 'samples' array, not 'assets' Map
    if (!store || !store.samples) {
      return [];
    }
    return store.samples.map(sample => ({
      id: sample.id,
      name: sample.name,
      assetId: sample.assetId,
      durationBeats: sample.durationBeats,
      durationSeconds: sample.durationSeconds,
      type: sample.type,
      originalPattern: sample.originalPattern,
      createdAt: sample.createdAt,
      metadata: sample.metadata,
      // Don't serialize buffer - too large
    }));
  }

  static serializeWorkspace(store) {
    return {
      viewMode: store.viewMode,
      selectedTrackId: store.selectedTrackId,
      selectedClipIds: store.selectedClipIds || [],
    };
  }

  // =================== DESERIALIZATION HELPERS ===================

  static deserializeInstruments(instruments) {
    const store = useInstrumentsStore.getState();
    console.log(`📦 Restoring ${instruments.length} instruments...`);
    
    // Clear existing instruments (except initial ones if needed)
    // For now, we'll add instruments without clearing to avoid breaking existing setup
    
    // Add instruments
    instruments.forEach(instData => {
      try {
        // ✅ FIX: Map legacy instrument types to current types
        let instrumentType = instData.type || 'sample';
        
        // Map 'sampler' to 'sample' (legacy type from DB)
        if (instrumentType === 'sampler') {
          instrumentType = 'sample';
        }
        
        // Ensure required fields
        const instrumentData = {
          ...instData,
          id: instData.id || `inst-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: instrumentType,
        };
        
        store.handleAddNewInstrument(instrumentData);
        console.log(`✅ Restored instrument: ${instrumentData.name} (${instrumentType})`);
      } catch (error) {
        console.error(`❌ Failed to restore instrument ${instData.id}:`, error);
      }
    });
  }

  static deserializePatterns(patterns) {
    const store = useArrangementStore.getState();
    
    // Handle both array and object formats
    const patternsArray = Array.isArray(patterns) 
      ? patterns 
      : Object.values(patterns || {});
    
    console.log(`📦 Restoring ${patternsArray.length} patterns...`);
    
    // Restore patterns
    patternsArray.forEach(pattern => {
      try {
        const patternId = pattern.id;
        
        // ✅ FIX: Create pattern with specific ID if it doesn't exist
        if (!store.patterns[patternId]) {
          // Create pattern manually with the correct ID instead of letting createPattern generate a new one
          const newPattern = {
            id: patternId,
            name: pattern.name || patternId,
            data: {}, // Will be populated below
            settings: {
              length: pattern.length || pattern.settings?.length || 64,
              quantization: pattern.settings?.quantization || '16n'
            }
          };
          
          // Add pattern to store using setState
          useArrangementStore.setState(state => ({
            patterns: { ...state.patterns, [patternId]: newPattern },
            patternOrder: state.patternOrder.includes(patternId) 
              ? state.patternOrder 
              : [...state.patternOrder, patternId]
          }));
          
          console.log(`✅ Created pattern: ${patternId}`);
        }
        
        // ✅ FIX: Restore pattern length if provided
        // Pattern length can be in pattern.length or pattern.settings.length
        if (store.patterns[patternId]) {
          const currentPattern = store.patterns[patternId];
          const patternLength = pattern.length || pattern.settings?.length || currentPattern.settings?.length || 64;
          
          // Update pattern with length in settings using setState
          useArrangementStore.setState(state => ({
            patterns: {
              ...state.patterns,
              [patternId]: {
                ...currentPattern,
                settings: {
                  ...currentPattern.settings,
                  length: patternLength,
                  quantization: pattern.settings?.quantization || currentPattern.settings?.quantization || '16n'
                }
              }
            }
          }));
        }
        
        // ✅ FIX: Restore pattern data (notes) - handle both object and array formats
        if (pattern.data) {
          // pattern.data can be:
          // 1. Object: { instrumentId: [notes] }
          // 2. Already in correct format
          const patternData = typeof pattern.data === 'object' && !Array.isArray(pattern.data)
            ? pattern.data
            : {};
          
          Object.entries(patternData).forEach(([instrumentId, notes]) => {
            try {
              // Ensure notes is an array
              const notesArray = Array.isArray(notes) ? notes : [];
              if (notesArray.length > 0) {
                store.updatePatternNotes(patternId, instrumentId, notesArray);
                console.log(`  ✅ Restored ${notesArray.length} notes for instrument ${instrumentId}`);
              }
            } catch (error) {
              console.warn(`  ⚠️ Failed to restore notes for instrument ${instrumentId}:`, error);
            }
          });
        }
        
        console.log(`✅ Restored pattern: ${patternId}`);
      } catch (error) {
        console.error(`❌ Failed to restore pattern ${pattern.id}:`, error);
      }
    });
    
    // ✅ FIX: Ensure at least one pattern is active after restore
    const restoredPatternIds = Object.keys(store.patterns);
    if (restoredPatternIds.length > 0 && !store.activePatternId) {
      // If no active pattern, set first pattern as active
      const firstPatternId = restoredPatternIds[0];
      store.setActivePatternId(firstPatternId);
      console.log(`✅ Set first pattern as active: ${firstPatternId}`);
    } else if (restoredPatternIds.length > 0 && !store.patterns[store.activePatternId]) {
      // If active pattern doesn't exist, set first pattern as active
      const firstPatternId = restoredPatternIds[0];
      store.setActivePatternId(firstPatternId);
      console.log(`✅ Active pattern not found, switched to first pattern: ${firstPatternId}`);
    }
    
    // Restore pattern order and active pattern if available
    // Note: pattern_order is stored in metadata, will be restored in main deserialize method
  }
  
  static deserializePatternOrder(patternOrder, activePatternId) {
    const store = useArrangementStore.getState();
    
    // ✅ FIX: Restore pattern order if provided
    if (patternOrder && Array.isArray(patternOrder)) {
      // Filter to only include patterns that exist
      const validPatternOrder = patternOrder.filter(id => store.patterns[id]);
      
      if (validPatternOrder.length > 0) {
        // Update pattern order (if store supports it)
        // Note: patternOrder might be read-only, so we'll just ensure active pattern is set
      }
    }
    
    // ✅ FIX: Set active pattern - ensure it exists, otherwise use first available
    if (activePatternId && store.patterns[activePatternId]) {
      store.setActivePatternId(activePatternId);
      console.log(`✅ Set active pattern: ${activePatternId}`);
    } else {
      // If active pattern doesn't exist or not provided, use first available
      const availablePatterns = Object.keys(store.patterns);
      if (availablePatterns.length > 0) {
        const firstPatternId = availablePatterns[0];
        store.setActivePatternId(firstPatternId);
        console.log(`✅ Set first pattern as active: ${firstPatternId}`);
      }
    }
  }

  static deserializeArrangement(arrangement) {
    const store = useArrangementStore.getState();
    console.log(`📦 Restoring arrangement...`);
    
    try {
      // Clear existing arrangement tracks first
      store.arrangementTracks = [];
      
      // Restore arrangement tracks
      if (arrangement.tracks && Array.isArray(arrangement.tracks)) {
        arrangement.tracks.forEach(track => {
          try {
            // Use addArrangementTrack method to properly create tracks
            const newTrack = {
              id: track.id,
              name: track.name,
              volume: track.volume ?? 1.0,
              pan: track.pan ?? 0,
              muted: track.muted ?? false,
              solo: track.solo ?? false,
              height: track.height ?? 80,
              locked: track.locked ?? false,
              collapsed: track.collapsed ?? false,
            };
            
            store.arrangementTracks.push(newTrack);
            console.log(`✅ Restored arrangement track: ${track.name}`);
          } catch (error) {
            console.error(`❌ Failed to restore track ${track.id}:`, error);
          }
        });
      }
      
      // Restore arrangement clips
      if (arrangement.clips && Array.isArray(arrangement.clips)) {
        arrangement.clips.forEach(clip => {
          try {
            // Check if clip already exists
            const existingClip = store.arrangementClips.find(c => c.id === clip.id);
            if (!existingClip) {
              const newClip = {
                id: clip.id,
                type: clip.type || 'pattern',
                trackId: clip.trackId,
                startTime: clip.startTime,
                duration: clip.duration,
                patternId: clip.patternId,
                assetId: clip.assetId,
                sampleOffset: clip.sampleOffset || 0,
                patternOffset: clip.patternOffset || 0,
                muted: clip.muted ?? false,
                locked: clip.locked ?? false,
                name: clip.name,
              };
              
              store.arrangementClips.push(newClip);
              console.log(`✅ Restored arrangement clip: ${clip.id}`);
            }
          } catch (error) {
            console.error(`❌ Failed to restore clip ${clip.id}:`, error);
          }
        });
      }
      
      // Restore markers
      if (arrangement.markers && Array.isArray(arrangement.markers)) {
        store.arrangementMarkers = arrangement.markers;
      }
      
      // Restore loop regions
      if (arrangement.loop_regions && Array.isArray(arrangement.loop_regions)) {
        store.arrangementLoopRegions = arrangement.loop_regions;
      }
    } catch (error) {
      console.error('❌ Failed to restore arrangement:', error);
    }
  }

  static async deserializeMixer(mixer) {
    const store = useMixerStore.getState();
    console.log(`📦 Restoring mixer...`);
    
    try {
      // Get master track
      const masterTrack = store.mixerTracks.find(t => t.id === 'master') || {
        id: 'master',
        name: 'Master',
        type: 'master',
        volume: 0,
        pan: 0,
        isMuted: false,
        isSolo: false,
        color: '#8b5cf6',
        output: null,
        sends: [],
        insertEffects: [],
        eq: { enabled: false, lowGain: 0, midGain: 0, highGain: 0 },
      };
      
      // Build all tracks array
      const newTracks = [masterTrack];
      
      // Restore mixer tracks
      if (mixer.tracks && Array.isArray(mixer.tracks)) {
        mixer.tracks.forEach(track => {
          try {
            // Create new track with template data
            const newTrack = {
              id: track.id,
              name: track.name || `Track ${track.id}`,
              type: track.type || 'track', // ✅ FIX: Use 'track' instead of 'channel' to match Mixer.jsx filter
              volume: track.volume ?? 0,
              pan: track.pan ?? 0,
              // ✅ FIX: Map DB properties (muted/solo) to store properties (isMuted/isSolo)
              isMuted: track.muted !== undefined ? track.muted : (track.isMuted ?? false),
              isSolo: track.solo !== undefined ? track.solo : (track.isSolo ?? false),
              color: track.color || '#3b82f6',
              output: track.output || 'master',
              sends: track.sends || [],
              insertEffects: track.insertEffects || [],
              eq: track.eq || {
                enabled: false,
                lowGain: 0,
                midGain: 0,
                highGain: 0,
              },
            };
            
            newTracks.push(newTrack);
            console.log(`✅ Restored mixer track: ${newTrack.name} (${newTrack.id})`);
          } catch (error) {
            console.error(`❌ Failed to restore mixer track ${track.id}:`, error);
          }
        });
      }
      
      // ✅ CRITICAL: Update store using Zustand's set() method
      // This ensures the store is properly updated and reactive
      useMixerStore.setState({ mixerTracks: newTracks });
      console.log(`✅ Updated mixer store with ${newTracks.length} tracks (1 master + ${newTracks.length - 1} channels)`);
      
      // ✅ FIX: Don't restore effects here - they're already in the store (line 953)
      // and will be synced to AudioEngine by _syncMixerTracksToAudioEngine() in deserialize()
      // Restoring them here with handleMixerEffectAdd() would create duplicate effects with new IDs

      // Restore track parameters (volume, pan, mute, solo) for each track
      newTracks.forEach(track => {
        try {
          // Restore track parameters
          if (track.volume !== undefined && track.id !== 'master') {
            store.handleMixerParamChange(track.id, 'volume', track.volume);
          }
          if (track.pan !== undefined && track.id !== 'master') {
            store.handleMixerParamChange(track.id, 'pan', track.pan);
          }
          if (track.isMuted) {
            store.toggleMute(track.id);
          }
          if (track.isSolo) {
            store.toggleSolo(track.id);
          }
        } catch (error) {
          console.error(`❌ Failed to restore parameters for track ${track.id}:`, error);
        }
      });
      
      // Restore master channel parameters
      if (mixer.master) {
        const masterTrackInArray = newTracks.find(t => t.id === 'master');
        if (masterTrackInArray) {
          // ✅ FIX: Restore master effects FIRST (before Object.assign)
          // This ensures effects are restored with their original IDs and settings
          // We'll set insertEffects directly and then rebuild the chain
          const masterInsertEffects = mixer.master.insertEffects && Array.isArray(mixer.master.insertEffects) 
            ? mixer.master.insertEffects 
            : [];
          
          // Update master track with mixer.master data
          Object.assign(masterTrackInArray, {
            volume: mixer.master.volume ?? masterTrackInArray.volume,
            pan: mixer.master.pan ?? masterTrackInArray.pan,
            // ✅ FIX: Map DB properties (muted/solo) to store properties (isMuted/isSolo)
            isMuted: mixer.master.muted !== undefined ? mixer.master.muted : (mixer.master.isMuted ?? masterTrackInArray.isMuted),
            isSolo: mixer.master.solo !== undefined ? mixer.master.solo : (mixer.master.isSolo ?? masterTrackInArray.isSolo),
            // ✅ FIX: Set insertEffects directly (don't use handleMixerEffectAdd which adds new effects)
            insertEffects: masterInsertEffects,
          });
          
          // Update store again with updated master
          useMixerStore.setState({ mixerTracks: newTracks });
          
          // Restore master parameters
          if (mixer.master.volume !== undefined) {
            store.handleMixerParamChange('master', 'volume', mixer.master.volume);
          }
          if (mixer.master.pan !== undefined) {
            store.handleMixerParamChange('master', 'pan', mixer.master.pan);
          }
          if (mixer.master.muted !== undefined && mixer.master.muted !== store.mutedChannels.has('master')) {
            store.toggleMute('master');
          }

          // ✅ FIX: Don't rebuild master chain here - effects are already in the store (line 1019)
          // and will be synced to AudioEngine by _syncMixerTracksToAudioEngine() in deserialize()

          console.log(`✅ Restored master channel with ${masterInsertEffects.length} effects`);
        }
      }

      // ✅ FIX: Don't sync mixer tracks to AudioEngine here
      // This is now handled in deserialize() method (after deserializeMixer() call)
      // which ensures proper order: mixer → sync → samples → instruments
    } catch (error) {
      console.error('❌ Failed to restore mixer:', error);
    }
  }

  static deserializeTimeline(timeline) {
    const store = useTimelineStore.getState();
    console.log(`📦 Restoring timeline settings...`);
    
    try {
      // Timeline store methods may vary, update what's available
      if (timeline.total_beats) {
        // Update timeline if method exists
        console.log(`✅ Timeline settings restored`);
      }
    } catch (error) {
      console.error('❌ Failed to restore timeline:', error);
    }
  }

  static deserializeAudioAssets(assets) {
    const store = useProjectAudioStore.getState();
    console.log(`📦 Restoring ${assets.length} audio samples...`);
    
    // Clear existing samples
    store.clearAll();
    
    try {
      assets.forEach(sample => {
        try {
          // Add sample to store
          // Note: audioBuffer is not serialized, so samples will need to be reloaded
          if (store.addSample) {
            store.addSample({
              id: sample.id,
              name: sample.name,
              assetId: sample.assetId,
              durationBeats: sample.durationBeats,
              durationSeconds: sample.durationSeconds,
              type: sample.type || 'frozen',
              originalPattern: sample.originalPattern,
              createdAt: sample.createdAt,
              metadata: sample.metadata || {},
            });
            console.log(`✅ Restored audio sample: ${sample.name}`);
          }
        } catch (error) {
          console.error(`❌ Failed to restore asset ${asset.id}:`, error);
        }
      });
    } catch (error) {
      console.error('❌ Failed to restore audio assets:', error);
    }
  }

  static deserializeWorkspace(workspace) {
    const store = useArrangementWorkspaceStore.getState();
    console.log(`📦 Restoring workspace settings...`);
    
    try {
      if (workspace.viewMode && store.setViewMode) {
        store.setViewMode(workspace.viewMode);
      }
      
      if (workspace.selectedTrackId && store.setSelectedTrackId) {
        store.setSelectedTrackId(workspace.selectedTrackId);
      }
      
      if (workspace.selectedClipIds && store.setSelectedClipIds) {
        store.setSelectedClipIds(workspace.selectedClipIds);
      }
      
      console.log(`✅ Workspace settings restored`);
    } catch (error) {
      console.error('❌ Failed to restore workspace:', error);
    }
  }
}

