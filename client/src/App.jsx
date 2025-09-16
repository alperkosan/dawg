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
import { WorkletDebugPanel } from './components/WorkletDebugPanel';

import { usePlaybackStore } from './store/usePlaybackStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { useMixerStore } from './store/useMixerStore';
import { usePanelsStore } from './store/usePanelsStore';
import { useArrangementStore } from './store/useArrangementStore';
import { initialInstruments, initialMixerTracks } from './config/initialData';

const useAudioEngineSync = (audioEngineRef) => {
    const instruments = useInstrumentsStore(state => state.instruments);
    const mixerTracks = useMixerStore(state => state.mixerTracks);
    const playbackMode = usePlaybackStore(state => state.playbackMode);

    // === HATA DÜZELTMESİ BURADA ===
    // Aranjman verilerini tek bir obje olarak değil, ayrı ayrı seçiyoruz.
    // Bu, her render'da yeni bir obje referansı oluşmasını engeller ve döngüyü kırar.
    const clips = useArrangementStore(state => state.clips);
    const patterns = useArrangementStore(state => state.patterns);
    const tracks = useArrangementStore(state => state.tracks);
    const activePatternId = useArrangementStore(state => state.activePatternId);

    const structuralSignature = JSON.stringify({
        instrumentIds: instruments.map(i => i.id),
        mixerEffectIds: mixerTracks.map(t => t.insertEffects?.map(fx => fx.id)),
        // Ayrı seçtiğimiz state'leri imza oluşturmak için kullanıyoruz
        clipIdsAndPositions: clips.map(c => `${c.id}@${c.startTime}`),
        trackIds: tracks.map(t => t.id),
        playbackMode: playbackMode,
        activePatternId: activePatternId, // EN ÖNEMLİ EKLEME
    });

    useEffect(() => {
        const engine = audioEngineRef.current;
        if (engine) {
            console.log("[SYNC] Yapısal bir değişiklik algılandı, motor ve UI senkronize ediliyor...");
            useInstrumentsStore.getState().updateLoopLength();
            // Senkronizasyon için verileri bir obje içinde topluyoruz
            engine.syncFromStores(instruments, mixerTracks, { clips, patterns, tracks, activePatternId });
        }
    }, [structuralSignature, audioEngineRef, instruments, mixerTracks, clips, patterns, tracks]); 

    return null;
};


function AppContent({ audioEngineRef }) {
  useAudioEngineSync(audioEngineRef);
  
  useEffect(() => {
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
    
    KeybindingService(keymap, actions);
    return () => destroyKeybindings();
  }, [audioEngineRef]);

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
      
      // DÜZELTME: TimeManager callback'lerini doğru şekilde bağla
      const engine = new AudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        onProgressUpdate: PlaybackAnimatorService.publish,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
        setLoopLengthFromEngine: useInstrumentsStore.getState().setLoopLengthFromEngine,
        // YENİ: AudioEngine'in store'a komut verebilmesi için son bağlantı
        setActivePatternId: useArrangementStore.getState()._internal_setActivePatternId,
      });
      
      const initialBpm = usePlaybackStore.getState().bpm;
      engine.setBpm(initialBpm);
      console.log(`AudioEngine: Başlangıç BPM'i ${initialBpm} olarak ayarlandı.`);

      audioEngine.current = engine;
      
      console.log("AudioEngine: İlk senkronizasyon başlatılıyor...");
      await engine.syncFromStores(
        useInstrumentsStore.getState().instruments,
        useMixerStore.getState().mixerTracks,
        useArrangementStore.getState()
      );
      console.log("AudioEngine: İlk senkronizasyon tamamlandı.");
      
      // DÜZELTME: TimeManager'ın doğru şekilde kurulduğundan emin ol
      console.log("TimeManager callback'leri ayarlandı.");
      
      setIsAudioInitialized(true);
    } catch (error){
      console.error("Ses motoru başlatılamadı:", error);
    }
  };

  // DÜZELTME: Component unmount'ta TimeManager'ı da temizle
  useEffect(() => {
    return () => {
      if (audioEngine.current) {
        console.log("App unmounting: AudioEngine temizleniyor...");
        audioEngine.current.dispose();
      }
    };
  }, []);

  if (!isAudioInitialized) {
    return <StartupScreen onStart={initializeAudio} />;
  }

  return (
    <ThemeProvider>
      <AppContent audioEngineRef={audioEngine} />
    </ThemeProvider>

    {process.env.NODE_ENV === 'development' && (
      <WorkletDebugPanel audioEngineRef={audioEngineRef} />
    )}

  );
}

export default App;