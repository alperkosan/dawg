// src/App.jsx - preloadSamples Entegrasyonu

import React, { useState, useEffect, useRef } from 'react';

// Bileşenler
import StartupScreen from './components/StartUpScreen'; 
import { ThemeProvider } from './components/ThemeProvider';
import TopToolbar from './features/top_toolbar/TopToolbar';
import MainToolbar from './features/main_toolbar/MainToolbar';
import WorkspacePanel from './layout/WorkspacePanel';
import Taskbar from './features/taskbar/Taskbar';

// Motor ve Servisler
import { AudioContextService } from './lib/services/AudioContextService';
import { NativeAudioEngine } from './lib/core/NativeAudioEngine'; // ✅

// Store'lar
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { usePlaybackStore } from './store/usePlaybackStore';

// ... (LoadingScreen ve ErrorScreen bileşenleri aynı kalabilir) ...
const LoadingScreen = ({ message }) => (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
            <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-green-400 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold">{message}</h2>
        </div>
    </div>
);
const ErrorScreen = ({ message }) => (
    <div className="fixed inset-0 bg-red-900 text-white p-8">Hata: {message}</div>
);


function App() {
  const [appStatus, setAppStatus] = useState('pending');
  const [error, setError] = useState(null);
  const audioContextRef = useRef(null);

  const handleStart = async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
        setAppStatus('running');
        return;
    }

    setAppStatus('initializing');
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      await context.resume();
      audioContextRef.current = context;
      console.log('✅ Native AudioContext kullanıcı etkileşimiyle oluşturuldu ve başlatıldı!');

      const engine = new NativeAudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
      });
      
      await AudioContextService.setAudioEngine(engine);
      await engine.initializeWithContext(context);
      
      // --- YENİ EKLENEN ADIM BURASI ---
      // Enstrümanları oluşturmadan önce, onlara ait sample'ları yükle.
      const instrumentData = useInstrumentsStore.getState().instruments;
      await engine.preloadSamples(instrumentData);
      // --- YENİ ADIM SONU ---

      // Artık sample'lar yüklendiği için enstrümanları oluşturabiliriz.
      for (const instData of instrumentData) {
        await engine.createInstrument(instData);
      }
      
      setAppStatus('running');

    } catch (err) {
      console.error('❌ Uygulama başlatma başarısız:', err);
      setError(err.message);
      setAppStatus('error');
    }
  };

  // App ilk açıldığında `pending` durumunda kalır ve StartupScreen'i gösterir.
  // Bu useEffect'e artık gerek yok.

  if (appStatus === 'pending') {
    return <StartupScreen onStart={handleStart} />;
  }

  if (appStatus === 'initializing') {
    return <LoadingScreen message="Stüdyo Hazırlanıyor..." />;
  }
  
  if (appStatus === 'error') {
    return <ErrorScreen message={error} />;
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
};

export default App;