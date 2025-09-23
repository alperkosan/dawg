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
  const [engineStatus, setEngineStatus] = useState('initializing');
  const [engineError, setEngineError] = useState(null);
  const [initializationProgress, setInitializationProgress] = useState(0);
  const audioEngineRef = useRef(null);

  useEffect(() => {
    initializeAudioSystem();
  }, []);

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
  if (engineStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-red-600 mb-4">
            Audio Engine Error
          </h2>
          <p className="text-gray-700 mb-4">{engineError}</p>
          <button
            onClick={handleRetryInitialization}
            className="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry Initialization
          </button>
        </div>
      </div>
    );
  }

  if (engineStatus !== 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Initializing Audio Engine...
          </h2>
          
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${initializationProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {initializationProgress}% - {getStatusMessage(engineStatus)}
            </p>
          </div>
          
          {engineStatus === 'waiting-user-gesture' && (
            <p className="text-sm text-gray-600">
              Click anywhere to enable audio...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Main app render - replace this with your actual app components
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            🎵 Native Audio Engine - Ready!
          </h1>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Your app components go here */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Engine Status</h2>
          <div className="space-y-2">
            <p>✅ Audio Context: Ready</p>
            <p>✅ Transport System: Active</p>
            <p>✅ Worklet Manager: Loaded</p>
            <p>✅ Instruments: {useInstrumentsStore(s => s.instruments.length)} loaded</p>
            <p>✅ Store Subscriptions: Active</p>
          </div>
        </div>
        
        {/* Add your actual app components here:
        <TransportControls />
        <PianoRoll />
        <MixerPanel />
        etc.
        */}
      </main>
    </div>
  );
}

// =================== HELPER FUNCTION ===================
const getStatusMessage = (status) => {
  const messages = {
    'initializing': 'Starting up...',
    'waiting-user-gesture': 'Waiting for user interaction',
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