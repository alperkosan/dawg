// App.jsx - NativeAudioEngine Complete Integration
import React, { useState, useEffect, useRef } from 'react';
import { NativeAudioEngine } from './lib/core/NativeAudioEngine';
import { AudioContextService } from './lib/services/AudioContextService';
import { usePlaybackStore } from './store/usePlaybackStore';
import { useArrangementStore } from './store/useArrangementStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { useMixerStore } from './store/useMixerStore';

// ========== İMPORT EDİLMESİ GEREKEN DOSYALAR ==========
// Bu dosyaları önce oluşturman gerekiyor:
// import { WorkletHealthChecker } from './lib/audio/WorkletHealthChecker';
// import { storePipeline } from './lib/core/StorePipeline';

function App() {
  const [engineStatus, setEngineStatus] = useState('waiting-to-start'); // ✅ YENİ: Başlatma bekliyor
  const [engineError, setEngineError] = useState(null);
  const [initializationProgress, setInitializationProgress] = useState(0);
  const audioEngineRef = useRef(null);

  // ✅ YENİ: Otomatik başlatma YOK, manuel başlatma

  // ✅ YENİ: Manuel başlatma butonu handler'ı
  const handleStartAudioEngine = async () => {
    console.log('🎵 User clicked to start audio engine');
    setEngineStatus('initializing');
    setInitializationProgress(0);
    await initializeAudioSystem();
  };

  // ✅ DOĞRU: Fonksiyon App component'i içinde tanımlanmış
  const initializeAudioSystem = async () => {
    try {
      console.log('🚀 Starting audio system initialization...');
      
      // =================== 1. USER GESTURE CHECK ===================
      setEngineStatus('waiting-user-gesture');
      setInitializationProgress(10);
      
      const audioContext = await createAudioContextWithUserGesture();
      
      // =================== 2. WORKLET HEALTH CHECK ===================
      // setEngineStatus('checking-worklets');
      // setInitializationProgress(20);
      
      // TODO: Uncomment when WorkletHealthChecker is created
      // const workletHealth = await WorkletHealthChecker.validateAllWorklets();
      // console.log('📦 Worklet health check:', workletHealth);
      
      // =================== 3. ENGINE CREATION ===================
      setEngineStatus('creating-engine');
      setInitializationProgress(40);
      
      const engine = new NativeAudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
        onPatternChange: (data) => {
          console.log('🎵 Pattern changed:', data);
          // TODO: Handle pattern change events
        }
      });

      audioEngineRef.current = engine;
      
      // =================== 4. ENGINE INITIALIZATION ===================
      setEngineStatus('initializing-engine');
      setInitializationProgress(60);
      
      await engine.initializeWithContext(audioContext);
      
      // =================== 5. SERVICE REGISTRATION ===================
      setEngineStatus('registering-service');
      setInitializationProgress(70);
      
      await AudioContextService.setAudioEngine(engine);
      
      // =================== 6. CONTENT LOADING ===================
      setEngineStatus('loading-content');
      setInitializationProgress(80);
      
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

  // =================== HELPER FUNCTIONS ===================
  
  const createAudioContextWithUserGesture = async () => {
    return new Promise((resolve, reject) => {
      const createContext = async () => {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) {
            throw new Error('AudioContext not supported in this browser');
          }

          const context = new AudioContextClass({
            latencyHint: 'interactive',
            sampleRate: 48000
          });

          // Resume context if suspended
          if (context.state === 'suspended') {
            await context.resume();
          }

          console.log('🎵 AudioContext created:', {
            state: context.state,
            sampleRate: context.sampleRate
          });

          resolve(context);
          
          // Remove click listener after successful creation
          document.removeEventListener('click', createContext);
          
        } catch (error) {
          reject(error);
        }
      };

      // Try to create immediately
      createContext().catch(() => {
        // If it fails (usually needs user gesture), wait for click
        console.log('⚠️ Waiting for user gesture to create AudioContext...');
        document.addEventListener('click', createContext, { once: true });
      });
    });
  };

  const loadInitialContent = async (engine) => {
    try {
      // Load instruments
      const instrumentData = useInstrumentsStore.getState().instruments;
      console.log('📥 Loading instruments:', instrumentData.length);
      
      // Preload samples
      await engine.preloadSamples(instrumentData);
      
      // Create instruments in engine
      for (const instData of instrumentData) {
        await engine.createInstrument(instData);
      }
      
      // Set initial pattern
      const { activePatternId } = useArrangementStore.getState();
      engine.setActivePattern(activePatternId);
      
      console.log('✅ Initial content loaded');
      
    } catch (error) {
      console.error('❌ Failed to load initial content:', error);
      throw error;
    }
  };

  const setupStoreSubscriptions = (engine) => {
    // =================== ARRANGEMENT STORE SUBSCRIPTION ===================
    let lastArrangementState = useArrangementStore.getState();
    
    const unsubscribeArrangement = useArrangementStore.subscribe((state) => {
      // Active pattern changed
      if (state.activePatternId !== lastArrangementState.activePatternId) {
        console.log('🔄 Active pattern changed:', state.activePatternId);
        engine.setActivePattern(state.activePatternId);
        
        // Update loop length in playback store
        usePlaybackStore.getState().updateLoopLength();
        
        // Reschedule if playing
        if (usePlaybackStore.getState().playbackState === 'playing') {
          AudioContextService.reschedule();
        }
      }
      
      // Pattern content changed
      if (JSON.stringify(state.patterns) !== JSON.stringify(lastArrangementState.patterns)) {
        console.log('🎼 Pattern content changed');
        
        // Reschedule if playing
        if (usePlaybackStore.getState().playbackState === 'playing') {
          AudioContextService.reschedule();
        }
      }
      
      lastArrangementState = state;
    });

    // =================== PLAYBACK STORE SUBSCRIPTION ===================
    let lastPlaybackState = usePlaybackStore.getState();
    
    const unsubscribePlayback = usePlaybackStore.subscribe((state) => {
      // BPM changed
      if (state.bpm !== lastPlaybackState.bpm) {
        console.log('🎼 BPM changed:', state.bpm);
        engine.setBPM(state.bpm);
      }
      
      lastPlaybackState = state;
    });

    // =================== MIXER STORE SUBSCRIPTION ===================
    let lastMixerState = useMixerStore.getState();
    
    const unsubscribeMixer = useMixerStore.subscribe((state) => {
      // Track parameter changes
      state.mixerTracks.forEach(track => {
        const prevTrack = lastMixerState.mixerTracks.find(t => t.id === track.id);
        
        if (prevTrack) {
          // Volume changed
          if (track.volume !== prevTrack.volume) {
            console.log('🔊 Volume changed:', track.id, track.volume);
            AudioContextService.setChannelVolume(track.id, track.volume);
          }
          
          // Pan changed
          if (track.pan !== prevTrack.pan) {
            console.log('↔️ Pan changed:', track.id, track.pan);
            AudioContextService.setChannelPan(track.id, track.pan);
          }
        }
      });
      
      lastMixerState = state;
    });

    // Store cleanup functions for later use
    engine._storeUnsubscribers = [
      unsubscribeArrangement,
      unsubscribePlayback,
      unsubscribeMixer
    ];
    
    console.log('✅ Store subscriptions setup complete');
  };

  // =================== CLEANUP ===================
  useEffect(() => {
    return () => {
      if (audioEngineRef.current) {
        console.log('🧹 Cleaning up audio engine...');
        
        // Cleanup store subscriptions
        if (audioEngineRef.current._storeUnsubscribers) {
          audioEngineRef.current._storeUnsubscribers.forEach(unsub => unsub());
        }
        
        // Dispose engine
        audioEngineRef.current.dispose();
        audioEngineRef.current = null;
      }
    };
  }, []);

  // =================== ERROR HANDLING ===================
  const handleRetryInitialization = () => {
    setEngineStatus('initializing');
    setEngineError(null);
    setInitializationProgress(0);
    initializeAudioSystem();
  };

  // =================== RENDER ===================
  
  // ✅ YENİ: Başlatmayı bekleyen durum
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
              <li>🎹 Instrument processors</li>
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

  if (engineStatus !== 'ready' && engineStatus !== 'waiting-to-start') {
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
              <span>{getStatusMessage(engineStatus)}</span>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Setting up your audio environment...
            </p>
            
            {engineStatus === 'waiting-user-gesture' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700">
                  🎵 Ready! Audio context will activate automatically.
                </p>
              </div>
            )}
            
            {engineStatus === 'loading-content' && (
              <div className="text-xs text-gray-500">
                Loading {useInstrumentsStore(s => s.instruments.length)} instruments...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main app render - Engine is ready!
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
                ✅ Ready & Active
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
        {/* Engine Status Card */}
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
              <div className="text-sm font-medium">Instruments</div>
              <div className="text-xs text-purple-600">
                {useInstrumentsStore(s => s.instruments.length)} Loaded
              </div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl mb-1">🎛️</div>
              <div className="text-sm font-medium">Mixer</div>
              <div className="text-xs text-orange-600">16 Channels</div>
            </div>
          </div>
        </div>
        
        {/* Quick Test Panel */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h3 className="text-lg font-semibold mb-4">Quick Test</h3>
          <div className="space-y-3">
            <button 
              onClick={() => {
                console.log('🧪 Testing audio engine...');
                AudioContextService.play();
                setTimeout(() => AudioContextService.stop(), 2000);
              }}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              ▶️ Test Playback (2 seconds)
            </button>
            
            <button 
              onClick={() => {
                console.log('📊 Engine stats:', AudioContextService.getEngineStats());
              }}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📊 Log Engine Stats
            </button>
            
            <button 
              onClick={() => {
                console.log('🔊 Testing note audition...');
                AudioContextService.auditionNoteOn('inst-1', 'C4', 0.8);
                setTimeout(() => AudioContextService.auditionNoteOff('inst-1', 'C4'), 500);
              }}
              className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              🎹 Test Note (C4)
            </button>
          </div>
        </div>

        {/* Development Info */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            🚀 Ready for Integration
          </h3>
          <p className="text-gray-600 mb-4">
            Your Native Audio Engine is now fully initialized and ready to integrate with your UI components.
          </p>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Next Steps:</strong></p>
            <p>• Add your TransportControls component</p>
            <p>• Add your PianoRoll component</p>
            <p>• Add your MixerPanel component</p>
            <p>• Replace this placeholder with your actual app</p>
          </div>
        </div>
        
        {/* Your actual app components will replace this section:
        <TransportControls />
        <PianoRoll />
        <MixerPanel />
        */}
      </main>
    </div>
  );
}

// =================== HELPER FUNCTION ===================
  const getStatusMessage = (status) => {
    const messages = {
      'waiting-to-start': 'Waiting for user to start',
      'initializing': 'Starting up...',
      'waiting-user-gesture': 'Activating audio context',
      'checking-worklets': 'Checking audio processors...',
      'creating-engine': 'Creating audio engine...',
      'initializing-engine': 'Initializing core systems...',
      'registering-service': 'Registering audio service...',
      'loading-content': 'Loading instruments and patterns...',
      'setting-up-stores': 'Setting up data synchronization...',
      'ready': 'Ready to rock!'
    };
    
    return messages[status] || status;
  };

export default App;