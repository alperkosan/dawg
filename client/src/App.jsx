import React, { useState, useEffect } from 'react';
import * as Tone from 'tone';
import AudioEngine from './lib/core/AudioEngine';
import WorkspacePanel from './layout/WorkspacePanel';
import StartupScreen from './components/StartUpScreen';
import { ThemeProvider } from './components/ThemeProvider';
import MainToolbar from './features/main_toolbar/MainToolbar';
import TopToolbar from './features/top_toolbar/TopToolbar';
import Taskbar from './features/taskbar/Taskbar';
import { KeybindingService, destroyKeybindings } from './lib/core/KeybindingService';
import { usePlaybackStore } from './store/usePlaybackStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { useMixerStore } from './store/useMixerStore';
import { useArrangementStore } from './store/useArrangementStore';
import { usePanelsStore } from './store/usePanelsStore';
import { AudioContextService } from './lib/services/AudioContextService';
import { keymap } from './config/keymapConfig';
import { commandManager } from './lib/commands/CommandManager';

// AppContent artık sadece layout'u yönetiyor, gereksiz prop'lar yok.
function AppContent() {
  useEffect(() => {
    // Merkezi Klavye Kısayol Servisini Başlat
    const actions = {
      TOGGLE_PLAY_PAUSE: () => {
        const { playbackState, handlePause, handlePlay } = usePlaybackStore.getState();
        if (playbackState === 'playing') {
          handlePause();
        } else {
          handlePlay();
        }
      },
      STOP: () => {
        usePlaybackStore.getState().handleStop();
      },
      OPEN_CHANNEL_RACK: () => usePanelsStore.getState().togglePanel('channel-rack'),
      OPEN_MIXER: () => usePanelsStore.getState().togglePanel('mixer'),
      OPEN_PIANO_ROLL: () => usePanelsStore.getState().togglePanel('piano-roll'),
      UNDO: () => commandManager.undo(),
      REDO: () => commandManager.redo(),
    };
    
    KeybindingService(keymap, actions);
    return () => destroyKeybindings();
  }, []);

  // Tüm layout, BEM ve merkezi CSS'e uygun olarak yeniden düzenlendi.
  // Tailwind sınıfları tamamen kaldırıldı.
  return (
    <div className="app-container">
      <TopToolbar />
      <MainToolbar />
      <main className="app-main">
        <WorkspacePanel />
      </main>
      <Taskbar />
    </div>
  );
}

function App() {
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);

  const initializeAudio = async () => {
    if (AudioContextService.getAudioEngine()) return;

    try {
      await Tone.start();
      console.log("AudioContext başlatıldı.");
      
      const engine = new AudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
      });

      const initialBpm = usePlaybackStore.getState().bpm;
      engine.setBpm(initialBpm);
      
      AudioContextService.setAudioEngine(engine);
      
      // Motoru, store'lardaki başlangıç verileriyle senkronize et
      await engine.fullSync(
        useInstrumentsStore.getState().instruments,
        useMixerStore.getState().mixerTracks,
        useArrangementStore.getState()
      );
      
      setIsAudioInitialized(true);

    } catch (error){
      console.error("Ses motoru başlatılamadı:", error);
    }
  };

  useEffect(() => {
    // Component kaldırıldığında motoru temizle
    return () => AudioContextService.getAudioEngine()?.dispose();
  }, []);

  if (!isAudioInitialized) {
    return <StartupScreen onStart={initializeAudio} />;
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
