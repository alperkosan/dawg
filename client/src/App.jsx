import React, { useState, useEffect, useRef, Suspense } from 'react';

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

  // 2. Ses motorunu başlatan ana fonksiyon
  const initializeAudioSystem = async () => {
    // Zaten hazır veya başlatılıyorsa tekrar başlatma
    if (engineStatus === 'ready' || engineStatus === 'initializing') return;

    setEngineStatus('initializing');
    console.log('🚀 Ses sistemi başlatılıyor...');

    try {
      // === KRİTİK BAĞLANTI NOKTASI ===
      // Motoru oluştururken, store'ların eylemlerini "callback" olarak motora veriyoruz.
      // Bu, motordan store'a tek yönlü veri akışını sağlar.
      const engine = new NativeAudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
      });

      await engine.initialize();
      audioEngineRef.current = engine;

      // Motoru, uygulama genelinde erişilebilir olan servisimize kaydediyoruz.
      await AudioContextService.setAudioEngine(engine);

      // Başlangıç verilerini (sample'lar, enstrümanlar) motora yüklüyoruz.
      console.log('📥 Başlangıç verileri yükleniyor...');
      const instruments = useInstrumentsStore.getState().instruments;
      const mixerTracks = useMixerStore.getState().mixerTracks;
      const patterns = useArrangementStore.getState().patterns;
      
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
      
      // Motorun başlangıç pattern'ini ve BPM'ini store'lardan almasını sağlıyoruz.
      engine.setActivePattern(useArrangementStore.getState().activePatternId);
      engine.setBPM(usePlaybackStore.getState().bpm);

      setEngineStatus('ready');
      console.log('✅ Ses sistemi başarıyla başlatıldı ve hazır!');

    } catch (error) {
      console.error('❌ Ses sistemi başlatılamadı:', error);
      setEngineError(error.message);
      setEngineStatus('error');
    }
  };
  
  // 3. Component yok olduğunda motoru temizleyen useEffect
  useEffect(() => {
    // Bu return fonksiyonu, component unmount edildiğinde çalışır.
    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.dispose();
        audioEngineRef.current = null;
        console.log('🧹 Ses motoru temizlendi.');
      }
    };
  }, []); // Boş dependency array, sadece bir kez çalışmasını sağlar.

  // 4. Arayüzü motorun durumuna göre render etme
  const renderContent = () => {
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
  };

  return <>{renderContent()}</>;
}

export default App;