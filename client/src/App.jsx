// App.jsx - Fixed Async Import Issue
// DAWG - Native Audio Engine v2.0 Integration

import React, { useState, useEffect, useRef } from 'react';

// Bileşenler
import StartupScreen from './components/StartUpScreen'; 
import { ThemeProvider } from './components/ThemeProvider';
import TopToolbar from './features/top_toolbar/TopToolbar';
import MainToolbar from './features/main_toolbar/MainToolbar';
import WorkspacePanel from './layout/WorkspacePanel';
import Taskbar from './features/taskbar/Taskbar';

// YENİ: Native Audio Engine v2.0
import { NativeAudioEngine, PatternData } from './lib/core/NativeAudioEngine'; // ✅ Direct import
import { AudioContextService } from './lib/services/AudioContextService';

// Store'lar
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { usePlaybackStore } from './store/usePlaybackStore';
import { useMixerStore } from './store/useMixerStore';
import { useArrangementStore } from './store/useArrangementStore';

const LoadingScreen = ({ message, progress = 0 }) => (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
            <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-green-400 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold mb-2">{message}</h2>
            {progress > 0 && (
                <div className="w-64 bg-gray-700 rounded-full h-2 mx-auto">
                    <div 
                        className="bg-green-400 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            )}
        </div>
    </div>
);

const ErrorScreen = ({ message, onRetry }) => (
    <div className="fixed inset-0 bg-red-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Audio Engine Error</h2>
            <p className="mb-6">{message}</p>
            {onRetry && (
                <button 
                    onClick={onRetry}
                    className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded"
                >
                    Retry
                </button>
            )}
        </div>
    </div>
);

function App() {
  const [appStatus, setAppStatus] = useState('pending');
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const audioEngineRef = useRef(null);

  const handleStart = async () => {
    if (audioEngineRef.current?.isInitialized) {
        setAppStatus('running');
        return;
    }

    setAppStatus('initializing');
    setLoadingProgress(0);
    
    try {
      // =================== PHASE 1: AUDIO CONTEXT ===================
      setLoadingMessage('Creating Audio Context...');
      setLoadingProgress(10);
      
      const context = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 48000
      });
      
      await context.resume();
      console.log('✅ Native AudioContext created and started!');

      // =================== PHASE 2: ENGINE INITIALIZATION ===================
      setLoadingMessage('Initializing Audio Engine...');
      setLoadingProgress(25);
      
      const engine = new NativeAudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
        onPatternChange: (data) => {
          // Handle pattern change events if needed
          console.log('Pattern changed:', data);
        }
      });
      
      await engine.initializeWithContext(context);
      audioEngineRef.current = engine;

      // =================== PHASE 3: SERVICE REGISTRATION ===================
      setLoadingMessage('Registering Audio Service...');
      setLoadingProgress(40);
      
      await AudioContextService.setAudioEngine(engine);

      // =================== PHASE 4: SAMPLE PRELOADING ===================
      setLoadingMessage('Loading Samples...');
      setLoadingProgress(55);
      
      const instrumentData = useInstrumentsStore.getState().instruments;
      await engine.preloadSamples(instrumentData);

      // =================== PHASE 5: MIXER SETUP ===================
      setLoadingMessage('Setting up Mixer...');
      setLoadingProgress(70);
      
      const mixerTracks = useMixerStore.getState().mixerTracks;
      for (const track of mixerTracks) {
        if (track.type !== 'track') { // Skip regular tracks, they're created by default
          try {
            await AudioContextService._createMixerChannel(track);
          } catch (error) {
            console.warn(`⚠️ Could not create mixer channel: ${track.name}`, error);
          }
        }
      }

      // =================== PHASE 6: INSTRUMENT CREATION ===================
      setLoadingMessage('Creating Instruments...');
      setLoadingProgress(85);
      
      for (const instData of instrumentData) {
        await engine.createInstrument(instData);
        // Update progress for each instrument
        const currentInstrument = instrumentData.indexOf(instData) + 1;
        const instrumentProgress = 85 + (10 * currentInstrument / instrumentData.length);
        setLoadingProgress(instrumentProgress);
      }

      // =================== PHASE 7: PATTERN LOADING ===================
      setLoadingMessage('Loading Patterns...');
      setLoadingProgress(95);
      
      const arrangementData = useArrangementStore.getState();
      
      // ✅ FIXED: Direct PatternData usage without dynamic import
      Object.entries(arrangementData.patterns).forEach(([patternId, pattern]) => {
        const patternData = new PatternData(
          pattern.id, 
          pattern.name, 
          pattern.data
        );
        engine.patterns.set(patternId, patternData);
      });
      
      engine.activePatternId = arrangementData.activePatternId;

      // =================== FINALIZATION ===================
      setLoadingMessage('Finalizing...');
      setLoadingProgress(100);
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setAppStatus('running');
      console.log('🎉 Native Audio Engine v2.0 fully initialized!');

    } catch (err) {
      console.error('❌ Native Engine initialization failed:', err);
      setError(err.message);
      setAppStatus('error');
    }
  };

  const handleRetry = () => {
    setAppStatus('pending');
    setError(null);
    setLoadingProgress(0);
    setLoadingMessage('');
  };

  // =================== CLEANUP ===================
  useEffect(() => {
    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.dispose();
      }
    };
  }, []);

  // =================== RENDER LOGIC ===================
  if (appStatus === 'pending') {
    return <StartupScreen onStart={handleStart} />;
  }

  if (appStatus === 'initializing') {
    return (
      <LoadingScreen 
        message={loadingMessage} 
        progress={loadingProgress}
      />
    );
  }
  
  if (appStatus === 'error') {
    return (
      <ErrorScreen 
        message={error} 
        onRetry={handleRetry}
      />
    );
  }

  return (
    <ThemeProvider>
      <div className="app-container">
        <TopToolbar />
        <MainToolbar />
        <main className="app-main">
          <WorkspacePanel />
        </main>
        <Taskbar />
      </div>
    </ThemeProvider>
  );
}

export default App;