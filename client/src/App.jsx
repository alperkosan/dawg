import React, { useState, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import AudioEngine from './lib/core/AudioEngine';
import WorkspacePanel from './layout/WorkspacePanel';
import StartupScreen from './components/StartUpScreen';
import { ThemeProvider } from './components/ThemeProvider';
import MainToolbar from './features/main_toolbar/MainToolbar';
import TopToolbar from './features/top_toolbar/TopToolbar';
import Taskbar from './features/taskbar/Taskbar';
import { KeybindingService, destroyKeybindings } from './lib/core/KeybindingService';
import { PlaybackAnimatorService } from './lib/core/PlaybackAnimatorService';
import { keymap } from './config/keymapConfig';

// Store'ları import ediyoruz
import { usePlaybackStore } from './store/usePlaybackStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { useMixerStore } from './store/useMixerStore';
import { useArrangementStore } from './store/useArrangementStore';
import { usePanelsStore } from './store/usePanelsStore';

/**
 * @file App.jsx - Olay Tabanlı Mimari
 * @description Artık 'useAudioEngineSync' kancası yok.
 * Ses motoru sadece başlangıçta bir kere tüm veriyi alarak senkronize olur.
 * Sonrasındaki tüm değişiklikler (enstrüman ekleme, efekt açma vb.),
 * ilgili store'lardaki eylemler tarafından doğrudan ses motorundaki
 * spesifik fonksiyonlara komut olarak gönderilir. Bu, gereksiz tam
 * senkronizasyonları ortadan kaldırır ve performansı artırır.
 */
function AppContent({ audioEngineRef }) {
  useEffect(() => {
    // Klavye kısayolları için eylem haritası
    const actions = {
      TOGGLE_PLAY_PAUSE: () => {
        const { playbackState, handlePlay, handlePause } = usePlaybackStore.getState();
        // NOT: Store'daki eylemler artık audioEngineRef'i parametre olarak almıyor.
        // Eylemin kendisi, ilgili arayüz bileşeninden (örn: TopToolbar) çağrıldığında
        // audioEngineRef'i zaten alacak. Bu merkezi harita, bu referansa sahip değil,
        // bu yüzden doğrudan motoru tetikliyoruz.
        const engine = audioEngineRef.current;
        if (!engine) return;
        
        if (playbackState === 'playing') {
          engine.pause();
          usePlaybackStore.getState().setPlaybackState('paused');
        } else {
          engine.start();
          usePlaybackStore.getState().setPlaybackState('playing');
        }
      },
      STOP: () => {
        const engine = audioEngineRef.current;
        if (engine) {
            engine.stop();
            usePlaybackStore.getState().setPlaybackState('stopped');
        }
      },
      OPEN_CHANNEL_RACK: () => usePanelsStore.getState().togglePanel('channel-rack'),
      OPEN_MIXER: () => usePanelsStore.getState().togglePanel('mixer'),
      OPEN_PIANO_ROLL: () => usePanelsStore.getState().togglePanel('piano-roll'),
    };
    
    KeybindingService(keymap, actions);
    return () => destroyKeybindings();
  }, [audioEngineRef]); // Sadece bir kere kurulur

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
      
      // Ses motorunu UI'dan gelen güncellemeler için callback'lerle başlat
      const engine = new AudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
      });
      
      // Başlangıç BPM'ini ayarla, SİLİNECEK !!!
      const initialBpm = usePlaybackStore.getState().bpm;
      engine.setBpm(initialBpm);

      audioEngine.current = engine;
      
      console.log("AudioEngine: İlk ve tek tam senkronizasyon başlatılıyor...");
      // Sadece başlangıçta, tüm store verilerini motora yükle
      await engine.syncFromStores(
        useInstrumentsStore.getState().instruments,
        useMixerStore.getState().mixerTracks,
        useArrangementStore.getState()
      );
      console.log("AudioEngine: Senkronizasyon tamamlandı ve motor hazır.");
      
      setIsAudioInitialized(true);
    } catch (error){
      console.error("Ses motoru başlatılamadı:", error);
    }
  };

  useEffect(() => {
    // Component unmount olduğunda motoru temizle
    return () => audioEngine.current?.dispose();
  }, []);

  if (!isAudioInitialized) {
    return <StartupScreen onStart={initializeAudio} />;
  }

  return (
    <ThemeProvider>
      <AppContent audioEngineRef={audioEngine} />
    </ThemeProvider>
  );
}

export default App;
