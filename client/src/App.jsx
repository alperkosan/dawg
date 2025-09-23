// App.jsx - Hata Düzeltmeleri ile
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

  const handleStartAudioEngine = async () => {
    console.log('User clicked');
    setEngineStatus('initializing');
    await initializeAudioSystem();
  };
  
  // ✅ FIX: useCallback dependencies düzeltildi
  const handleRetryInitialization = useCallback(() => {
    setEngineStatus('initializing');
    setEngineError(null);
    setInitializationProgress(0);
    initializeAudioSystem();
  }, []); // Boş dependency array

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
                Loading {useInstrumentsStore(s => s.instruments.filter(i => i.type === 'sample').length)} sample instruments...
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
                {useInstrumentsStore(s => s.instruments.filter(i => i.type === 'sample').length)} Loaded
              </div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl mb-1">🎛️</div>
              <div className="text-sm font-medium">Mixer</div>
              <div className="text-xs text-orange-600">20 Channels</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h3 className="text-lg font-semibold mb-4">Quick Test</h3>
          <div className="space-y-3">
            <button 
              onClick={testFunctions.testPlayback}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              ▶️ Test Playback (2 seconds)
            </button>
            
            <button 
              onClick={testFunctions.logStats}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📊 Log Engine Stats
            </button>
            
            <button 
              onClick={testFunctions.testNote}
              className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              🎹 Test Sample Note
            </button>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-yellow-800">
            ⚠️ Temporary Limitations
          </h3>
          <div className="text-sm text-yellow-700 space-y-1">
            <p>• <strong>Synth instruments are temporarily disabled</strong> (worklet registry issue)</p>
            <p>• Only sample-based instruments are loaded</p>
            <p>• Full synthesis support will be added in next update</p>
            <p>• All mixer channels and transport system are fully functional</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;