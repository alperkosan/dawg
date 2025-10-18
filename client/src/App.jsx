import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react';

// Core Systems
import { NativeAudioEngine } from './lib/core/NativeAudioEngine';
import { AudioContextService } from './lib/services/AudioContextService';
import { visualizationEngine } from './lib/visualization/VisualizationEngine';
import TimelineControllerSingleton from './lib/core/TimelineControllerSingleton';
import TransportManagerSingleton from './lib/core/TransportManagerSingleton';

// Stores
import { usePlaybackStore } from './store/usePlaybackStore';
import { useArrangementStore } from './store/useArrangementStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';

// Helper: Create demo audio buffer (sine wave for testing)
const createDemoAudioBuffer = (audioContext, frequency = 440, duration = 2) => {
  const sampleRate = audioContext.sampleRate;
  const bufferLength = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, bufferLength, sampleRate);
  const channelData = buffer.getChannelData(0);

  // Generate sine wave with fade out
  for (let i = 0; i < bufferLength; i++) {
    const t = i / sampleRate;
    const fadeOut = Math.max(0, 1 - (t / duration) * 0.3); // Gentle fade
    channelData[i] = Math.sin(2 * Math.PI * frequency * t) * 0.5 * fadeOut;
  }

  return buffer;
};

// UI Components
import StartupScreen from './components/StartUpScreen'; // Başlangıç ekranı
import LoadingScreen from './components/layout/LoadingScreen';
import TopToolbar from './features/toolbars/TopToolbar';
import MainToolbar from './features/toolbars/MainToolbar';
import WorkspacePanel from './layout/WorkspacePanel';
import { ThemeProvider } from './components/ThemeProvider';
import Taskbar from './features/taskbar/Taskbar';
import InstrumentEditorPanel from './features/instrument_editor/InstrumentEditorPanel';

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

      // Load AudioWorklet processors for effects and mixer
      console.log('🎛️ Loading AudioWorklet processors...');

      // Core processors (in /worklets/)
      const coreProcessors = [
        'mixer-processor',
        'instrument-processor'
      ];

      // Effect processors (in /worklets/effects/)
      const effectProcessors = [
        'compressor-processor',
        'saturator-processor',
        'multiband-eq-processor',
        'bass-enhancer-808-processor',
        'delay-processor',
        'feedback-delay-processor',
        'reverb-processor',
        'atmos-machine-processor',
        'stardust-chorus-processor',
        'vortex-phaser-processor',
        'tidal-filter-processor',
        'ghost-lfo-processor',
        'orbit-panner-processor',
        'arcade-crusher-processor',
        'pitch-shifter-processor',
        'sample-morph-processor',
        'sidechain-compressor-processor'
      ];

      // Load core processors first
      for (const processor of coreProcessors) {
        try {
          await engine.audioContext.audioWorklet.addModule(`/worklets/${processor}.js`);
          console.log(`✅ Loaded: ${processor}`);
        } catch (error) {
          console.warn(`⚠️ Failed to load ${processor}:`, error.message);
        }
      }

      // Load effect processors
      for (const processor of effectProcessors) {
        try {
          await engine.audioContext.audioWorklet.addModule(`/worklets/effects/${processor}.js`);
          console.log(`✅ Loaded: ${processor}`);
        } catch (error) {
          console.warn(`⚠️ Failed to load ${processor}:`, error.message);
        }
      }

      // Motoru, uygulama genelinde erişilebilir olan servisimize kaydediyoruz.
      await AudioContextService.setAudioEngine(engine);

      // ✅ Initialize VisualizationEngine
      visualizationEngine.init(engine.audioContext);
      console.log('✅ VisualizationEngine initialized');

      // ✅ Initialize TimelineController with current BPM from store
      const currentBPM = storeGetters.getBPM();
      await TimelineControllerSingleton.getInstance();
      console.log('🎯 TimelineController initialized with BPM:', currentBPM);

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
      // ✅ MEMORY LEAK FIX: Cleanup singletons using new API
      TransportManagerSingleton.reset();
      TimelineControllerSingleton.reset();

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
        return <LoadingScreen />;
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
              {/* Instrument Editor Panel */}
              <InstrumentEditorPanel />
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