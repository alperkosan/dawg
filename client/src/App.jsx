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
import { WorkletHealthChecker } from './lib/audio/WorkletHealthChecker';
import { storePipeline } from './lib/core/StorePipeline';

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

  const [engineStatus, setEngineStatus] = useState('initializing');
  const [engineError, setEngineError] = useState(null);
  
  useEffect(() => {
    initializeAudioSystem();
  }, []);  

  const handleStart = async () => {
    if (audioEngineRef.current?.isInitialized) {
        setAppStatus('running');
        return;
    }

    setAppStatus('initializing');
    setLoadingProgress(0);
    
    try {
      // 1. Worklet sağlık kontrolü
      setEngineStatus('checking-worklets');
      const workletHealth = await WorkletHealthChecker.validateAllWorklets();
      
      const unhealthyWorklets = Object.entries(workletHealth)
        .filter(([_, health]) => !health.healthy);
      
      if (unhealthyWorklets.length > 0) {
        throw new Error(`Unhealthy worklets: ${unhealthyWorklets.map(([name]) => name).join(', ')}`);
      }
      
      // 2. AudioContext oluştur (user gesture gerekebilir)
      setEngineStatus('creating-context');
      const audioContext = await createAudioContextWithUserGesture();
      
      // 3. Engine'i başlat
      setEngineStatus('initializing-engine');
      const engine = new NativeAudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
        onPatternChange: (data) => {
          // Pattern değişikliklerini handle et
          storePipeline.scheduleUpdate('arrangement', () => {
            // UI güncellemeleri
          }, 'normal');
        }
      });
      
      await engine.initializeWithContext(audioContext);
      
      // 4. Service'e kaydet
      setEngineStatus('registering-service');
      await AudioContextService.setAudioEngine(engine);
      
      // 5. Store pipeline'ı aktifleştir
      setEngineStatus('activating-stores');
      setupOptimizedStoreSubscriptions(engine);
      
      // 6. Default content'i yükle
      setEngineStatus('loading-content');
      await loadInitialContent(engine);
      
      setEngineStatus('ready');
      
    } catch (error) {
      console.error('🚨 Audio system initialization failed:', error);
      setEngineError(error.message);
      setEngineStatus('error');
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