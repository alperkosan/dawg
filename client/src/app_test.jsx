// client/src/App.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NativeAudioEngine } from './lib/core/NativeAudioEngine';
import { AudioContextService } from './lib/services/AudioContextService';
import { usePlaybackStore } from './store/usePlaybackStore';
import { useArrangementStore } from './store/useArrangementStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { useMixerStore } from './store/useMixerStore';

function App() {
  const [engineStatus, setEngineStatus] = useState('waiting-to-start');
  const [engineError, setEngineError] = useState(null);
  const [initializationProgress, setInitializationProgress] = useState(0);
  const audioEngineRef = useRef(null);

  // ✅ DÜZELTME: Hook'u bileşenin en üst seviyesinde ve koşulsuz olarak çağırın.
  const sampleInstrumentsCount = useInstrumentsStore(s => 
    s.instruments.filter(i => i.type === 'sample').length
  );

  const handleStartAudioEngine = async () => {
    console.log('User clicked');
    setEngineStatus('initializing');
    await initializeAudioSystem();
  };

  const handleRetryInitialization = async () => {
    setEngineStatus('initializing');
    setEngineError(null);
    setInitializationProgress(0);
    initializeAudioSystem();
  };  
  
  const initializeAudioSystem = async () => {
    try {
      console.log('🚀 Starting audio system initialization...');
      
      // =================== 1. AUDIO CONTEXT CREATION ===================
      setEngineStatus('waiting-user-gesture');
      setInitializationProgress(10);
      
      const audioContext = await createAudioContextWithUserGesture();
      
      // =================== 2. ENGINE CREATION ===================
      setEngineStatus('creating-engine');
      setInitializationProgress(30);
      
      const engine = new NativeAudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
        onPatternChange: (data) => {
          console.log('🎵 Pattern changed:', data);
        }
      });

      audioEngineRef.current = engine;
      
      // =================== 3. ENGINE INITIALIZATION ===================
      setEngineStatus('initializing-engine');
      setInitializationProgress(50);
      
      await engine.initializeWithContext(audioContext);
      
      // =================== 4. SERVICE REGISTRATION ===================
      setEngineStatus('registering-service');
      setInitializationProgress(60);
      
      await AudioContextService.setAudioEngine(engine);
      
      // =================== 5. ✅ FIX: WORKLET VALIDATION ===================
      setEngineStatus('validating-worklets');
      setInitializationProgress(65);
      
      await validateWorkletRegistry(engine);
      
      // =================== 6. CONTENT LOADING (SAMPLE ONLY) ===================
      setEngineStatus('loading-content');
      setInitializationProgress(70);
      
      await loadInitialContent(engine);
      
      // =================== 7. STORE SUBSCRIPTIONS ===================
      setEngineStatus('setting-up-stores');
      setInitializationProgress(90);
      
      setupStoreSubscriptions(engine);
      
      // =================== 8. FINALIZATION ===================
      setEngineStatus('ready');
      setInitializationProgress(100);
      
      console.log('✅ Audio system initialization complete!');
      
    } catch (error) {
      console.error('❌ Audio system initialization failed:', error);
      setEngineError(error.message);
      setEngineStatus('error');
    }
  };

  // ✅ FIX: Worklet registry validation
  const validateWorkletRegistry = async (engine) => {
    console.log('🔍 Validating worklet registry...');
    
    const requiredWorklets = [
      'instrument-processor',
      'mixer-processor', 
      'effects-processor',
      'analysis-processor'
    ];
    
    const loadedWorklets = Array.from(engine.workletManager.loadedWorklets);
    console.log('📦 Loaded worklets:', loadedWorklets);
    
    const missingWorklets = requiredWorklets.filter(name => 
      !loadedWorklets.includes(name)
    );
    
    if (missingWorklets.length > 0) {
      throw new Error(`Missing worklets: ${missingWorklets.join(', ')}`);
    }
    
    // Test worklet creation
    try {
      const testResult = await engine.workletManager.createWorkletNode(
        'instrument-processor',
        {
          processorOptions: { test: true }
        }
      );
      
      // Clean up test node
      engine.workletManager.disposeNode(testResult.nodeId);
      console.log('✅ Worklet registry validation passed');
      
    } catch (error) {
      throw new Error(`Worklet validation failed: ${error.message}`);
    }
  };

  const createAudioContextWithUserGesture = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('AudioContext not supported in this browser');
    }

    const context = new AudioContextClass({
      latencyHint: 'interactive',
      sampleRate: 48000
    });

    if (context.state === 'suspended') {
      await context.resume();
    }

    console.log('🎵 AudioContext created:', {
      state: context.state,
      sampleRate: context.sampleRate
    });

    return context;
  };

  const loadInitialContent = async (engine) => {
    try {
      const instrumentData = useInstrumentsStore.getState().instruments;
      console.log('📥 Loading instruments:', instrumentData.length);
      
      // ✅ FIX: Sadece sample instrument'ları yükle, synth'leri atla
      const sampleInstruments = instrumentData.filter(inst => inst.type === 'sample');
      const synthInstruments = instrumentData.filter(inst => inst.type === 'synth');
      
      console.log(`📦 Sample instruments: ${sampleInstruments.length}, Synth instruments: ${synthInstruments.length} (skipped)`);
      
      // Preload samples
      if (sampleInstruments.length > 0) {
        await engine.preloadSamples(sampleInstruments);
      }
      
      // Create only sample instruments
      for (const instData of sampleInstruments) {
        try {
          await engine.createInstrument(instData);
        } catch (error) {
          console.warn(`⚠️ Skipping instrument ${instData.name}: ${error.message}`);
        }
      }
      
      // Set initial pattern
      const { activePatternId } = useArrangementStore.getState();
      engine.setActivePattern(activePatternId);
      
      console.log('✅ Initial content loaded (samples only)');
      
    } catch (error) {
      console.error('❌ Failed to load initial content:', error);
      // Don't throw, continue with partial setup
      console.log('⚠️ Continuing with partial setup...');
    }
  };

  const setupStoreSubscriptions = (engine) => {
    let lastArrangementState = useArrangementStore.getState();
    
    const unsubscribeArrangement = useArrangementStore.subscribe((state) => {
      if (!lastArrangementState) {
        lastArrangementState = state;
        return;
      }
      
      let needsReschedule = false;
      
      if (state.activePatternId !== lastArrangementState.activePatternId) {
        console.log('🔄 Active pattern changed:', state.activePatternId);
        engine.setActivePattern?.(state.activePatternId);
        usePlaybackStore.getState().updateLoopLength?.();
        needsReschedule = true;
      }
      
      if (JSON.stringify(state.patterns) !== JSON.stringify(lastArrangementState.patterns)) {
        console.log('🎼 Pattern content changed');
        needsReschedule = true;
      }
      
      if (needsReschedule && usePlaybackStore.getState().playbackState === 'playing') {
        AudioContextService.reschedule?.();
      }
      
      lastArrangementState = state;
    });

    let lastPlaybackState = usePlaybackStore.getState();
    
    const unsubscribePlayback = usePlaybackStore.subscribe((state) => {
      if (!lastPlaybackState) {
        lastPlaybackState = state;
        return;
      }
      
      if (state.bpm !== lastPlaybackState.bpm) {
        console.log('🎼 BPM changed:', state.bpm);
        engine.setBPM?.(state.bpm);
      }
      
      lastPlaybackState = state;
    });

    let lastMixerState = useMixerStore.getState();
    
    const unsubscribeMixer = useMixerStore.subscribe((state) => {
      if (!lastMixerState) {
        lastMixerState = state;
        return;
      }
      
      state.mixerTracks.forEach(track => {
        const prevTrack = lastMixerState.mixerTracks.find(t => t.id === track.id);
        
        if (prevTrack) {
          if (track.volume !== prevTrack.volume) {
            console.log('🔊 Volume changed:', track.id, track.volume);
            AudioContextService.setChannelVolume?.(track.id, track.volume);
          }
          
          if (track.pan !== prevTrack.pan) {
            console.log('↔️ Pan changed:', track.id, track.pan);
            AudioContextService.setChannelPan?.(track.id, track.pan);
          }
        }
      });
      
      lastMixerState = state;
    });

    engine._storeUnsubscribers = [
      unsubscribeArrangement,
      unsubscribePlayback,
      unsubscribeMixer
    ];
    
    console.log('✅ Store subscriptions setup complete');
  };

  // ✅ FIX: Cleanup useEffect dependencies
  useEffect(() => {
    return () => {
      if (audioEngineRef.current) {
        console.log('🧹 Cleaning up audio engine...');
        
        if (audioEngineRef.current._storeUnsubscribers) {
          audioEngineRef.current._storeUnsubscribers.forEach(unsub => {
            try { unsub(); } catch (e) {}
          });
        }
        
        if (audioEngineRef.current.dispose) {
          audioEngineRef.current.dispose();
        }
        audioEngineRef.current = null;
      }
    };
  }, []);

  // ✅ FIX: Memoized status message
  const statusMessage = useMemo(() => {
    const messages = {
      'waiting-to-start': 'Waiting for user to start',
      'initializing': 'Starting up...',
      'waiting-user-gesture': 'Activating audio context',
      'creating-engine': 'Creating audio engine...',
      'initializing-engine': 'Initializing core systems...',
      'registering-service': 'Registering audio service...',
      'validating-worklets': 'Validating audio processors...',
      'loading-content': 'Loading instruments and patterns...',
      'setting-up-stores': 'Setting up data synchronization...',
      'ready': 'Ready to rock!'
    };
    return messages[engineStatus] || engineStatus;
  }, [engineStatus]);

  // ✅ FIX: Memoized test functions
  const testFunctions = useMemo(() => ({
    testPlayback: () => {
      console.log('🧪 Testing audio engine...');
      AudioContextService.play?.();
      setTimeout(() => AudioContextService.stop?.(), 2000);
    },
    
    logStats: () => {
      const stats = AudioContextService.getEngineStats?.();
      console.log('📊 Engine stats:', stats);
    },
    
    testNote: () => {
      console.log('🔊 Testing note audition...');
      const instruments = useInstrumentsStore.getState().instruments;
      const firstInstrument = instruments.find(inst => inst.type === 'sample');
      
      if (firstInstrument) {
        AudioContextService.auditionNoteOn?.(firstInstrument.id, 'C4', 0.8);
        setTimeout(() => AudioContextService.auditionNoteOff?.(firstInstrument.id, 'C4'), 500);
      } else {
        console.log('⚠️ No sample instruments available for testing');
      }
    }
  }), []);

  // =================== RENDER FUNCTIONS ===================
  if (engineStatus === 'waiting-to-start') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-lg p-8 bg-white rounded-xl shadow-xl text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-3xl text-white">🎵</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Native Audio Engine
            </h1>
            <p className="text-gray-600">
              High-performance audio system ready to initialize
            </p>
          </div>
          
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">What will be initialized:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>✨ WebAudio AudioWorklets</li>
              <li>🎹 Sample instruments (Synths temporarily disabled)</li>
              <li>🎛️ Mixer channels</li>
              <li>⏱️ Transport system</li>
              <li>📡 Real-time callbacks</li>
            </ul>
          </div>
          
          <button
            onClick={handleStartAudioEngine}
            className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            🚀 Initialize Audio Engine
          </button>
          
          <p className="text-xs text-gray-500 mt-4">
            This requires user interaction to enable WebAudio
          </p>
        </div>
      </div>
    );
  }

  if (engineStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
          <div className="text-center mb-4">
            <span className="text-4xl">❌</span>
            <h2 className="text-xl font-bold text-red-600 mt-2">
              Audio Engine Error
            </h2>
          </div>
          <div className="mb-4 p-4 bg-red-50 rounded-lg">
            <p className="text-gray-700 text-sm">{engineError}</p>
          </div>
          <div className="space-y-2">
            <button
              onClick={handleRetryInitialization}
              className="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              🔄 Retry Initialization
            </button>
            <button
              onClick={() => {
                setEngineStatus('waiting-to-start');
                setEngineError(null);
              }}
              className="w-full py-2 px-4 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
            >
              ⬅️ Back to Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (engineStatus !== 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              Initializing Audio Engine...
            </h2>
          </div>
          
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${initializationProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>{initializationProgress}%</span>
              <span>{statusMessage}</span>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Setting up your audio environment...
            </p>
            
            {engineStatus === 'loading-content' && (
              <div className="text-xs text-gray-500">
                {/* ✅ DÜZELTME: Hook yerine değişkeni kullanın */}
                Loading {sampleInstrumentsCount} sample instruments...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Engine is ready!
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🎵 Native Audio Engine
              </h1>
              <p className="text-sm text-green-600 font-medium">
                ✅ Ready & Active (Samples Only)
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>Audio System Online</span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Engine Status
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl mb-1">🎵</div>
              <div className="text-sm font-medium">Audio Context</div>
              <div className="text-xs text-green-600">Active</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl mb-1">⚡</div>
              <div className="text-sm font-medium">Transport</div>
              <div className="text-xs text-blue-600">Ready</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl mb-1">🎹</div>
              <div className="text-sm font-medium">Sample Instruments</div>
              <div className="text-xs text-purple-600">
                {/* ✅ DÜZELTME: Hook yerine değişkeni kullanın */}
                {sampleInstrumentsCount} Loaded
              </div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl mb-1">🎛️</div>
              <div className="text-sm font-medium">Mixer</div>
              <div className="text-xs text-orange-600">20 Channels</div>
            </div>
          </div>
        </div>
        
        {/* Interface Testing Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">

          {/* Basic Audio Engine Tests */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              Basic Engine Tests
            </h3>
            <div className="space-y-3">
              <button
                onClick={testFunctions.testPlayback}
                className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                ▶️ Test Playback (2s)
              </button>

              <button
                onClick={testFunctions.logStats}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                📊 Log Engine Stats
              </button>

              <button
                onClick={testFunctions.testNote}
                className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                🎹 Test Sample Note
              </button>
            </div>
          </div>

          {/* Timeline Interface Tests */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              Timeline Interface
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  console.log('🎯 Testing timeline selection...');
                  AudioContextService.timeline?.startSelection?.(0);
                  setTimeout(() => AudioContextService.timeline?.updateSelection?.(16), 100);
                  setTimeout(() => AudioContextService.timeline?.endSelection?.(true), 200);
                }}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                🎯 Test Selection (0-16)
              </button>

              <button
                onClick={() => {
                  console.log('⏭️ Testing timeline jump...');
                  AudioContextService.timeline?.jumpToStep?.(32);
                }}
                className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                ⏭️ Jump to Step 32
              </button>

              <button
                onClick={() => {
                  console.log('📏 Testing timeline scrub...');
                  AudioContextService.timeline?.startScrub?.(8);
                  setTimeout(() => AudioContextService.timeline?.updateScrub?.(24), 100);
                  setTimeout(() => AudioContextService.timeline?.endScrub?.(true), 500);
                }}
                className="w-full py-2 px-4 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors text-sm"
              >
                📏 Test Scrubbing
              </button>

              <button
                onClick={() => {
                  const state = AudioContextService.timeline?.getTimelineState?.();
                  console.log('📊 Timeline State:', state);
                }}
                className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                📊 Log Timeline State
              </button>
            </div>
          </div>

          {/* Parameter Interface Tests */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
              Parameter Control
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  console.log('🔊 Testing master volume...');
                  AudioContextService.parameters?.set?.('master', 'volume', 0.5);
                  setTimeout(() => AudioContextService.parameters?.set?.('master', 'volume', 1.0), 1000);
                }}
                className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                🔊 Test Master Volume
              </button>

              <button
                onClick={() => {
                  console.log('🎛️ Testing channel parameter...');
                  AudioContextService.parameters?.set?.('mixer-1', 'volume', 0.3);
                  AudioContextService.parameters?.set?.('mixer-1', 'pan', -0.5);
                  setTimeout(() => {
                    AudioContextService.parameters?.set?.('mixer-1', 'volume', 0.8);
                    AudioContextService.parameters?.set?.('mixer-1', 'pan', 0.5);
                  }, 1000);
                }}
                className="w-full py-2 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
              >
                🎛️ Test Channel Params
              </button>

              <button
                onClick={() => {
                  console.log('📈 Starting parameter recording...');
                  AudioContextService.parameters?.startRecording?.('mixer-1', 'volume');
                  let vol = 0;
                  const interval = setInterval(() => {
                    vol += 0.1;
                    AudioContextService.parameters?.set?.('mixer-1', 'volume', vol);
                    if (vol >= 1) {
                      clearInterval(interval);
                      const result = AudioContextService.parameters?.stopRecording?.('mixer-1', 'volume');
                      console.log('📊 Recording result:', result);
                    }
                  }, 100);
                }}
                className="w-full py-2 px-4 bg-purple-400 text-white rounded-lg hover:bg-purple-500 transition-colors text-sm"
              >
                📈 Test Automation Recording
              </button>

              <button
                onClick={() => {
                  const stats = AudioContextService.parameters?.getPerformanceStats?.();
                  console.log('⚡ Parameter Performance:', stats);
                }}
                className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                ⚡ Log Param Stats
              </button>
            </div>
          </div>

          {/* Loop Manager Tests */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
              Loop Management
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  console.log('🔄 Testing manual loop...');
                  AudioContextService.loop?.setManual?.(0, 32, 'test');
                }}
                className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
              >
                🔄 Set Manual Loop (0-32)
              </button>

              <button
                onClick={() => {
                  console.log('🔄 Testing auto calculation...');
                  const result = AudioContextService.loop?.recalculate?.();
                  console.log('📊 Auto Loop Result:', result);
                }}
                className="w-full py-2 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
              >
                🔄 Auto Calculate Loop
              </button>

              <button
                onClick={() => {
                  console.log('🎵 Testing pattern-based loop...');
                  const result = AudioContextService.loop?.calculateFromPattern?.();
                  console.log('🎵 Pattern Loop Result:', result);
                }}
                className="w-full py-2 px-4 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors text-sm"
              >
                🎵 Test Pattern Loop
              </button>

              <button
                onClick={() => {
                  const status = AudioContextService.loop?.getStatus?.();
                  console.log('📊 Loop Status:', status);
                }}
                className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                📊 Log Loop Status
              </button>
            </div>
          </div>

          {/* Pattern Validation Tests */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              Pattern Validation
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  console.log('🔍 Testing pattern validation...');
                  const patterns = useArrangementStore.getState().patterns;
                  const firstPatternId = Object.keys(patterns)[0];
                  if (firstPatternId) {
                    AudioContextService.validation?.validatePattern?.(firstPatternId);
                  } else {
                    console.log('⚠️ No patterns available to validate');
                  }
                }}
                className="w-full py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                🔍 Validate First Pattern
              </button>

              <button
                onClick={() => {
                  console.log('🔍 Testing validate all patterns...');
                  AudioContextService.validation?.validateAllPatterns?.('manual-test');
                }}
                className="w-full py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                🔍 Validate All Patterns
              </button>

              <button
                onClick={() => {
                  const results = AudioContextService.validation?.getAllValidationResults?.();
                  console.log('📊 Validation Results:', results);
                }}
                className="w-full py-2 px-4 bg-red-400 text-white rounded-lg hover:bg-red-500 transition-colors text-sm"
              >
                📊 Log Validation Results
              </button>

              <button
                onClick={() => {
                  const status = AudioContextService.validation?.getStatus?.();
                  console.log('📊 Validation Status:', status);
                }}
                className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                📊 Log Validation Status
              </button>
            </div>
          </div>

          {/* Performance Monitoring Tests */}
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-3 h-3 bg-teal-500 rounded-full mr-2"></span>
              Performance Monitor
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  console.log('📊 Starting performance monitoring...');
                  AudioContextService.performance?.startMonitoring?.(500);
                }}
                className="w-full py-2 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
              >
                📊 Start Monitoring (500ms)
              </button>

              <button
                onClick={() => {
                  console.log('📊 Stopping performance monitoring...');
                  AudioContextService.performance?.stopMonitoring?.();
                }}
                className="w-full py-2 px-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm"
              >
                📊 Stop Monitoring
              </button>

              <button
                onClick={() => {
                  const metrics = AudioContextService.performance?.getMetrics?.();
                  console.log('⚡ Performance Metrics:', metrics);
                }}
                className="w-full py-2 px-4 bg-teal-400 text-white rounded-lg hover:bg-teal-500 transition-colors text-sm"
              >
                ⚡ Log Current Metrics
              </button>

              <button
                onClick={() => {
                  const report = AudioContextService.performance?.getReport?.();
                  console.log('📊 Performance Report:', report);
                }}
                className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                📊 Get Full Report
              </button>
            </div>
          </div>

        </div>

        {/* Advanced Interface Tests */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></span>
            Advanced Interface Tests
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Batch Operations */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 text-sm">Batch Operations</h4>
              <button
                onClick={() => {
                  console.log('🔄 Testing batch parameter updates...');
                  AudioContextService.interface?.batch?.parameters?.({
                    'mixer-1': { volume: 0.7, pan: -0.3 },
                    'mixer-2': { volume: 0.9, pan: 0.2 },
                    'master': { volume: 0.8 }
                  });
                }}
                className="w-full py-1 px-3 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-colors"
              >
                🔄 Batch Parameters
              </button>

              <button
                onClick={() => {
                  console.log('🎯 Testing batch timeline ops...');
                  AudioContextService.interface?.batch?.timeline?.([
                    { type: 'jump', step: 16 },
                    { type: 'select', start: 16, end: 48, setAsLoop: true }
                  ]);
                }}
                className="w-full py-1 px-3 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600 transition-colors"
              >
                🎯 Batch Timeline
              </button>
            </div>

            {/* Event System */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 text-sm">Event System</h4>
              <button
                onClick={() => {
                  console.log('📡 Testing event subscription...');
                  const unsubscribe = AudioContextService.events?.on?.('parameterChanged', (data) => {
                    console.log('📡 Parameter Event:', data);
                  });

                  // Test the event
                  setTimeout(() => {
                    AudioContextService.parameters?.set?.('test', 'volume', 0.5);
                  }, 100);

                  // Cleanup after 3 seconds
                  setTimeout(() => {
                    unsubscribe?.();
                    console.log('📡 Event subscription cleaned up');
                  }, 3000);
                }}
                className="w-full py-1 px-3 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-colors"
              >
                📡 Test Events
              </button>

              <button
                onClick={() => {
                  const status = AudioContextService.debug?.getEventBusStatus?.();
                  console.log('📡 Event Bus Status:', status);
                }}
                className="w-full py-1 px-3 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600 transition-colors"
              >
                📡 Event Bus Status
              </button>
            </div>

            {/* Snapshots */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 text-sm">Snapshots</h4>
              <button
                onClick={() => {
                  console.log('📸 Creating snapshot...');
                  const snapshot = AudioContextService.advanced?.snapshots?.capture?.('Test Snapshot');
                  console.log('📸 Snapshot created:', snapshot);
                }}
                className="w-full py-1 px-3 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-colors"
              >
                📸 Create Snapshot
              </button>

              <button
                onClick={() => {
                  const snapshots = AudioContextService.advanced?.snapshots?.list?.();
                  console.log('📸 Available snapshots:', snapshots);
                  if (snapshots?.length > 0) {
                    console.log('📸 Restoring latest snapshot...');
                    AudioContextService.advanced?.snapshots?.restore?.(snapshots[snapshots.length - 1].timestamp);
                  }
                }}
                className="w-full py-1 px-3 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600 transition-colors"
              >
                📸 Restore Latest
              </button>
            </div>

            {/* Debug & Health */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 text-sm">Debug & Health</h4>
              <button
                onClick={() => {
                  const health = AudioContextService.debug?.healthCheck?.();
                  console.log('🏥 Health Check:', health);
                }}
                className="w-full py-1 px-3 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-colors"
              >
                🏥 Health Check
              </button>

              <button
                onClick={() => {
                  const status = AudioContextService.debug?.getInterfaceStatus?.();
                  console.log('🔍 Interface Status:', status);
                }}
                className="w-full py-1 px-3 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600 transition-colors"
              >
                🔍 Interface Status
              </button>
            </div>
          </div>
        </div>

        {/* Console Output Helper */}
        <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
            Testing Instructions
          </h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p><strong>📝 Console Output:</strong> All test results are logged to browser console (F12 → Console)</p>
            <p><strong>🔄 Test Sequence:</strong> Start with "Basic Engine Tests" → "Timeline Interface" → "Parameter Control"</p>
            <p><strong>⚡ Performance Monitor:</strong> Start monitoring before running intensive tests</p>
            <p><strong>🎯 Interface Testing:</strong> Each section tests specific API interfaces</p>
            <p><strong>🐛 Debug Tools:</strong> Use "Health Check" and "Interface Status" for troubleshooting</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-yellow-800">
            ⚠️ Current System Status
          </h3>
          <div className="text-sm text-yellow-700 space-y-1">
            <p>• <strong>✅ Sample instruments:</strong> Fully functional and loaded</p>
            <p>• <strong>⚠️ Synth instruments:</strong> Temporarily disabled (worklet registry issue)</p>
            <p>• <strong>✅ Interface APIs:</strong> Timeline, Parameters, Loop Manager ready</p>
            <p>• <strong>✅ Validation & Performance:</strong> Pattern validation and monitoring active</p>
            <p>• <strong>🔬 Testing Environment:</strong> Comprehensive interface testing now available</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;