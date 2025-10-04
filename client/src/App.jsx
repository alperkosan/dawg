import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react';

// Core Systems
import { NativeAudioEngine } from './lib/core/NativeAudioEngine';
import { AudioContextService } from './lib/services/AudioContextService';

// Stores
import { usePlaybackStore } from './store/usePlaybackStore';
import { useArrangementStore } from './store/useArrangementStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { useMixerStore } from './store/useMixerStore';

// UI Components
import StartupScreen from './components/StartUpScreen'; // Başlangıç ekranı
import TopToolbar from './features/top_toolbar/TopToolbar';
import MainToolbar from './features/main_toolbar/MainToolbar';
import WorkspacePanel from './layout/WorkspacePanel';
import { ThemeProvider } from './components/ThemeProvider';
import Taskbar from './features/taskbar/Taskbar';

// ENUMs and Constants
import { PLAYBACK_STATES } from './config/constants';

function App() {
  // 1. Motorun durumunu takip etmek için state'ler
  // 'idle': Başlamamış, 'initializing': Başlatılıyor, 'ready': Hazır, 'error': Hata
  const [engineStatus, setEngineStatus] = useState('idle');
  const [engineError, setEngineError] = useState(null);
  
  // Ses motoru nesnesini re-render'lar arasında kaybetmemek için useRef kullanıyoruz.
  const audioEngineRef = useRef(null);

  // ✅ PERFORMANCE: Memoize store callbacks to prevent recreation
  const audioEngineCallbacks = useMemo(() => ({
    setPlaybackState: (state) => {
      // ✅ Deprecated - Now handled by PlaybackController
      // console.log('Motor state change (handled by controller):', state);
    },
    setTransportPosition: usePlaybackStore.getState().setTransportPosition,
  }), []); // Empty deps - these callbacks don't need to change

  // ✅ PERFORMANCE: Memoize store getter functions to prevent repeated getState calls
  const storeGetters = useMemo(() => ({
    getInstruments: () => useInstrumentsStore.getState().instruments,
    getActivePatternId: () => useArrangementStore.getState().activePatternId,
    getBPM: () => usePlaybackStore.getState().bpm
  }), []); // Empty deps - these getters don't change

  // 2. ✅ PERFORMANCE: Optimized audio system initialization
  const initializeAudioSystem = useCallback(async () => {
    // Zaten hazır veya başlatılıyorsa tekrar başlatma
    if (engineStatus === 'ready' || engineStatus === 'initializing') return;

    setEngineStatus('initializing');
    console.log('🚀 Ses sistemi başlatılıyor...');

    try {
      // ✅ PERFORMANCE: Use memoized callbacks
      const engine = new NativeAudioEngine(audioEngineCallbacks);

      await engine.initialize();
      audioEngineRef.current = engine;

      // Motoru, uygulama genelinde erişilebilir olan servisimize kaydediyoruz.
      await AudioContextService.setAudioEngine(engine);

      // ✅ PERFORMANCE: Use fresh store data with memoized getters
      console.log('📥 Başlangıç verileri yükleniyor...');
      const instruments = storeGetters.getInstruments();

      // ⚡ DEBUG: Log sample instruments for troubleshooting
      const sampleInstruments = instruments.filter(inst => inst.type === 'sample');
      console.log('🔍 Sample instruments to load:', sampleInstruments.map(inst => ({ id: inst.id, name: inst.name, url: inst.url })));

      await engine.preloadSamples(instruments);
      console.log('✅ Sample preloading completed');

      for (const inst of instruments) {
        try {
          await engine.createInstrument(inst);
          if (inst.type === 'sample') {
            console.log(`✅ Sample instrument created: ${inst.name} (${inst.url})`);
          }
        } catch (error) {
          console.error(`❌ Failed to create instrument ${inst.name}:`, error);
        }
      }

      // ✅ PERFORMANCE: Get fresh data but with memoized getters
      engine.setActivePattern(storeGetters.getActivePatternId());
      engine.setBPM(storeGetters.getBPM());

      setEngineStatus('ready');
      console.log('✅ Ses sistemi başarıyla başlatıldı ve hazır!');

    } catch (error) {
      console.error('❌ Ses sistemi başlatılamadı:', error);
      setEngineError(error.message);
      setEngineStatus('error');
    }
  }, [engineStatus, audioEngineCallbacks, storeGetters]); // ✅ PERFORMANCE: Minimal dependencies
  
  // 3. ✅ MEMORY LEAK FIX: Component yok olduğunda motoru ve transport manager'ı temizleyen useEffect
  useEffect(() => {
    // Bu return fonksiyonu, component unmount edildiğinde çalışır.
    return () => {
      // ✅ MEMORY LEAK FIX: Cleanup TransportManager singleton
      import('./lib/core/TransportManagerSingleton.js').then(({ default: TransportManagerSingleton }) => {
        TransportManagerSingleton.cleanup();
      }).catch(error => {
        console.warn('Transport cleanup failed:', error);
      });

      if (audioEngineRef.current) {
        audioEngineRef.current.dispose();
        audioEngineRef.current = null;
        console.log('🧹 Ses motoru temizlendi.');
      }
    };
  }, []); // Boş dependency array, sadece bir kez çalışmasını sağlar.

  // 4. ✅ PERFORMANCE: Memoized render content to prevent unnecessary re-renders
  const renderContent = useCallback(() => {
    switch (engineStatus) {
      case 'initializing':
        return <StartupScreen onStart={() => {}} />; // Veya bir yükleniyor ekranı
      case 'error':
        return (
          <div className="w-screen h-screen flex items-center justify-center bg-red-900 text-white">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Bir Hata Oluştu</h2>
              <p className="mb-4">{engineError}</p>
              <button onClick={initializeAudioSystem} className="bg-white text-black px-4 py-2 rounded">
                Tekrar Dene
              </button>
            </div>
          </div>
        );
      case 'ready':
        return (
          <ThemeProvider>
            <div className="app-container">
              <TopToolbar />
              <MainToolbar />
              <main className="app-main">
                <Suspense fallback={<div>Yükleniyor...</div>}>
                    <WorkspacePanel />
                </Suspense>
              </main>
              <Taskbar />
            </div>
          </ThemeProvider>
        );
      case 'idle':
      default:
        // Kullanıcının "Başlat" butonuna tıklamasını bekleyen ekran
        return <StartupScreen onStart={initializeAudioSystem} />;
    }
  }, [engineStatus, engineError, initializeAudioSystem]); // ✅ PERFORMANCE: Minimal dependencies

  return <>{renderContent()}</>;
}

export default App;