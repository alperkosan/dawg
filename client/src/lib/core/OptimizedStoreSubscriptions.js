// lib/core/OptimizedStoreSubscriptions.js
export const setupOptimizedStoreSubscriptions = (engine) => {
    let lastArrangementState = null;
    let lastPlaybackState = null;
    let lastMixerState = null;
    
    // ⚡ PERFORMANS: Debounced reschedule
    const debouncedReschedule = debounce(() => {
      if (engine.playbackManager?.isPlaying) {
        console.log('🔄 Rescheduling due to changes...');
        engine.playbackManager._clearScheduledEvents();
        engine.playbackManager._scheduleContent();
      }
    }, 100);
    
    // 🎵 Arrangement Store - Pattern ve nota değişiklikleri
    useArrangementStore.subscribe((state) => {
      if (!lastArrangementState) {
        lastArrangementState = state;
        return;
      }
      
      let needsReschedule = false;
      
      // Aktif pattern değişti
      if (state.activePatternId !== lastArrangementState.activePatternId) {
        console.log('📋 Active pattern changed:', state.activePatternId);
        
        storePipeline.scheduleUpdate('playback', () => {
          engine.setActivePattern(state.activePatternId);
          usePlaybackStore.getState().updateLoopLength();
        }, 'urgent');
        
        needsReschedule = true;
      }
      
      // Pattern içeriği değişti
      if (state.patterns !== lastArrangementState.patterns) {
        console.log('🎼 Pattern content changed');
        needsReschedule = true;
      }
      
      if (needsReschedule) {
        debouncedReschedule();
      }
      
      lastArrangementState = state;
    });
    
    // 🎛️ Mixer Store - Real-time audio parameters
    useMixerStore.subscribe((state) => {
      if (!lastMixerState) {
        lastMixerState = state;
        return;
      }
      
      // Track parametreleri değişti
      state.mixerTracks.forEach(track => {
        const prevTrack = lastMixerState.mixerTracks.find(t => t.id === track.id);
        
        if (prevTrack) {
          // Volume değişikliği (urgent - anında ses etki eder)
          if (track.volume !== prevTrack.volume) {
            storePipeline.scheduleUpdate('mixer', () => {
              AudioContextService.setChannelVolume(track.id, track.volume);
            }, 'urgent');
          }
          
          // Pan değişikliği (urgent)
          if (track.pan !== prevTrack.pan) {
            storePipeline.scheduleUpdate('mixer', () => {
              AudioContextService.setChannelPan(track.id, track.pan);
            }, 'urgent');
          }
          
          // Effect değişiklikleri (normal - biraz gecikme tolere edilebilir)
          if (JSON.stringify(track.insertEffects) !== JSON.stringify(prevTrack.insertEffects)) {
            storePipeline.scheduleUpdate('mixer', () => {
              AudioContextService.rebuildSignalChain(track.id, track);
            }, 'normal');
          }
        }
      });
      
      lastMixerState = state;
    });
    
    // ▶️ Playback Store - Transport kontrolü
    usePlaybackStore.subscribe((state) => {
      if (!lastPlaybackState) {
        lastPlaybackState = state;
        return;
      }
      
      // BPM değişikliği (urgent - timing kritik)
      if (state.bpm !== lastPlaybackState.bpm) {
        storePipeline.scheduleUpdate('transport', () => {
          engine.setBPM(state.bpm);
        }, 'urgent');
      }
      
      lastPlaybackState = state;
    });
  };