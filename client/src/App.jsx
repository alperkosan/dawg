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
// YENİ SERVİSİ IMPORT ET
import { AudioContextService } from './lib/services/AudioContextService';
import { keymap } from './config/keymapConfig';
import { commandManager } from './lib/commands/CommandManager';


// AppContent artık prop almayacak
function AppContent() {
  useEffect(() => {
    const actions = {
      TOGGLE_PLAY_PAUSE: () => {
        const engine = AudioContextService.getAudioEngine();
        
        // --- DÜZELTME BURADA ---
        // Artık var olmayan 'handleResume' fonksiyonunu çağırmıyoruz.
        const { playbackState, handlePause, handlePlay } = usePlaybackStore.getState();

        if (playbackState === 'playing' || playbackState === 'paused') {
          // 'handlePause' hem duraklatma hem de devam etme işini zaten yapıyor.
          handlePause(engine); 
        } else {
          // 'stopped' durumundaysa 'handlePlay' çağrılır.
          handlePlay(engine);
        }
      },
      STOP: () => {
        const engine = AudioContextService.getAudioEngine();
        usePlaybackStore.getState().handleStop(engine);
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

  return (
    <div className="text-white h-screen flex flex-col font-sans select-none">
      {/* Bu component'lardan audioEngineRef prop'u kaldırılacak */}
      <TopToolbar />
      <MainToolbar />
      <main className="flex flex-grow overflow-hidden">
        <WorkspacePanel />
      </main>
      <Taskbar />
    </div>
  );
}

function App() {
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);

  const initializeAudio = async () => {
    // Servis üzerinden motorun zaten var olup olmadığını kontrol et
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
      
      // --- ANAHTAR DEĞİŞİKLİK ---
      // Ses motorunu oluşturduktan hemen sonra merkezi servisimize kaydediyoruz.
      AudioContextService.setAudioEngine(engine);
      
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
    // Component unmount olduğunda motoru temizle
    return () => AudioContextService.getAudioEngine()?.dispose();
  }, []);

  if (!isAudioInitialized) {
    return <StartupScreen onStart={initializeAudio} />;
  }

  return (
    <ThemeProvider>
      {/* Artık AppContent'e prop geçmiyoruz */}
      <AppContent />
    </ThemeProvider>
  );
}

export default App;

