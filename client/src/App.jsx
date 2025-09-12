import React, { useState, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import AudioEngine from './lib/core/AudioEngine';
import WorkspacePanel from './layout/WorkspacePanel';
import StartupScreen from './components/StartupScreen';
import MainToolbar from './features/main_toolbar/MainToolbar';
import TopToolbar from './features/top_toolbar/TopToolbar';
import Taskbar from './features/taskbar/Taskbar';
import { initKeybindings, destroyKeybindings } from './lib/core/KeybindingService'; // Yeni servisi import et
import { PlaybackAnimatorService } from './lib/core/PlaybackAnimatorService'; // Bunu import edin
import { keymap } from './config/keymapConfig'; // Yeni yapılandırmayı import et

import { usePlaybackStore } from './store/usePlaybackStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { useMixerStore } from './store/useMixerStore';

/**
 * Bu hook, Zustand store'ları ile AudioEngine arasındaki reaktif köprüyü kurar.
 * --- GÜNCELLENDİ: Artık efektlerin bypass durumundaki değişiklikleri de algılıyor. ---
 */
const useAudioEngineSync = (audioEngineRef) => {
    const instruments = useInstrumentsStore(state => state.instruments);
    const mixerTracks = useMixerStore(state => state.mixerTracks);

    // YENİ: "Yapısal imza" artık her efektin bypass durumunu da içeriyor.
    // Bu sayede, bir efekti mute'lamak da yapısal bir değişiklik olarak kabul edilir.
    const structuralSignature = 
        instruments.map(i => i.id).join(',') + '-' + 
        mixerTracks.map(t => 
            // Her efekt için ID'sine ek olarak bypass durumunu da imzaya ekle.
            `${t.id}:${t.insertEffects.map(fx => `${fx.id}:${fx.bypass}`).join(',')}`
        ).join(';');

    // Bu useEffect, artık SADECE yapısal imza değiştiğinde çalışacak.
    useEffect(() => {
        const engine = audioEngineRef.current;
        if (engine) {
            console.log("[SYNC] Yapısal bir değişiklik algılandı (kanal/efekt/bypass), ses motoru tamamen senkronize ediliyor...");
            engine.syncFromStores(instruments, mixerTracks);
        }
    }, [structuralSignature]); // Bağımlılık sadece bu imza.

    return null; // Bu hook'un bir şey render etmesine gerek yok.
};

function AppContent({ audioEngineRef }) {
  useAudioEngineSync(audioEngineRef);
  
  // --- YENİ: Kısayol eylemlerini ve dinleyiciyi yöneten merkezi useEffect ---
  useEffect(() => {
    // Eylem ID'lerini (keymap'ten gelen) gerçek store fonksiyonlarıyla eşleştir.
    const actions = {
      TOGGLE_PLAY_PAUSE: () => {
        const { playbackState, handlePlay, handlePause } = usePlaybackStore.getState();
        playbackState === 'playing' 
          ? handlePause(audioEngineRef.current) 
          : handlePlay(audioEngineRef.current);
      },
      STOP: () => {
        usePlaybackStore.getState().handleStop(audioEngineRef.current);
      },
      OPEN_CHANNEL_RACK: () => usePanelsStore.getState().togglePanel('channel-rack'),
      OPEN_MIXER: () => usePanelsStore.getState().togglePanel('mixer'),
      OPEN_PIANO_ROLL: () => usePanelsStore.getState().togglePanel('piano-roll'),
    };
    
    // Servisi başlat.
    initKeybindings(keymap, actions);
    
    // Component kaldırıldığında servisi temizle.
    return () => destroyKeybindings();
  }, [audioEngineRef]); // Sadece bir kez çalışması için.

  return (
    <div className="text-white h-screen flex flex-col font-sans select-none">
      <TopToolbar audioEngineRef={audioEngineRef} />
      <MainToolbar />
      <main className="flex flex-grow overflow-hidden">
        <WorkspacePanel audioEngineRef={audioEngineRef} />
      </main>
      <Taskbar />
    </div>
  );
}

function App() {
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const audioEngine = useRef(null);

  const initializeAudio = async () => {
    if (audioEngine.current) return;

    try {
      await Tone.start();
      console.log("AudioContext başlatıldı.");
      
      const engine = new AudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        
        // --- BU İKİ SATIRI EKLEYİN ---
        onProgressUpdate: PlaybackAnimatorService.publish,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
      });

      audioEngine.current = engine;
      
      // Motoru, store'lardaki başlangıç verileriyle SADECE BİR KEZ senkronize et.
      await engine.syncFromStores(
        useInstrumentsStore.getState().instruments,
        useMixerStore.getState().mixerTracks
      );

      setIsAudioInitialized(true);
    } catch (error) {
      console.error("Ses motoru başlatılamadı:", error);
    }
  };

  useEffect(() => {
    return () => audioEngine.current?.dispose();
  }, []);

  if (!isAudioInitialized) {
    return <StartupScreen onStart={initializeAudio} />;
  }

  return <AppContent audioEngineRef={audioEngine} />;
}

export default App;
