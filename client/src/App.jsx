// src/App.jsx - GÜNCELLENMİŞ VE OPTİMİZE EDİLMİŞ VERSİYON

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

import { usePlaybackStore } from './store/usePlaybackStore';
import { useInstrumentsStore } from './store/useInstrumentsStore';
import { useMixerStore } from './store/useMixerStore';
import { useArrangementStore } from './store/useArrangementStore';

const useAudioEngineSync = (audioEngineRef) => {
    const instruments = useInstrumentsStore(state => state.instruments);
    const mixerTracks = useMixerStore(state => state.mixerTracks);
    const playbackMode = usePlaybackStore(state => state.playbackMode);

    // HATA DÜZELTMESİ: Aranjman verilerini tek bir obje olarak değil, ayrı ayrı seçiyoruz.
    // Bu, her render'da yeni bir obje referansı oluşmasını engeller ve döngüyü kırar.
    const clips = useArrangementStore(state => state.clips);
    const patterns = useArrangementStore(state => state.patterns);
    const tracks = useArrangementStore(state => state.tracks);
    const activePatternId = useArrangementStore(state => state.activePatternId);

    // BÜYÜK DEĞİŞİKLİK: Sadece yapısal değişiklikleri temsil eden bir "imza" oluşturuyoruz.
    // Sadece bu imza değiştiğinde senkronizasyon tetiklenecek.
    const structuralSignature = JSON.stringify({
        instrumentIds: instruments.map(i => i.id),
        mixerTrackIds: mixerTracks.map(t => t.id),
        // Efekt ve send'lerin varlığı/yokluğu da yapısal bir değişikliktir.
        mixerEffectSignature: mixerTracks.map(t => t.insertEffects.map(fx => fx.id).join(',')).join(';'),
        mixerSendSignature: mixerTracks.map(t => t.sends.map(s => s.busId).join(',')).join(';'),
        clipIdsAndPositions: clips.map(c => `${c.id}@${c.startTime}:${c.duration}`).join(','),
        trackIds: tracks.map(t => t.id),
        patternIds: Object.keys(patterns).join(','),
        // Çalma modu veya aktif pattern değiştiğinde de senkronizasyon gerekir.
        playbackMode: playbackMode,
        activePatternId: activePatternId,
    });

    useEffect(() => {
        const engine = audioEngineRef.current;
        if (engine) {
            console.log("[SYNC] Yapısal bir değişiklik algılandı, motor ve UI senkronize ediliyor...");
            
            // 1. Önce en güncel döngü uzunluğunu hesapla
            useInstrumentsStore.getState().updateLoopLength();
            
            // 2. Tüm store'lardan en güncel verileri alarak motoru senkronize et
            engine.syncFromStores(
                useInstrumentsStore.getState().instruments, 
                useMixerStore.getState().mixerTracks, 
                useArrangementStore.getState()
            );
        }
    }, [structuralSignature, audioEngineRef]); // Sadece "imza" değiştiğinde çalışır!

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
      
      const engine = new AudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        onProgressUpdate: PlaybackAnimatorService.publish,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
        // DÜZELTME: Bu callback artık gerekli değil, TimeManager'dan kaldırıldı.
        // setLoopLengthFromEngine: useInstrumentsStore.getState().setLoopLengthFromEngine,
        setActivePatternId: useArrangementStore.getState()._internal_setActivePatternId,
      });
      
      const initialBpm = usePlaybackStore.getState().bpm;
      engine.setBpm(initialBpm);
      audioEngine.current = engine;
      
      console.log("AudioEngine: İlk senkronizasyon başlatılıyor...");
      // Başlangıçta döngü uzunluğunu hesapla
      useInstrumentsStore.getState().updateLoopLength();
      await engine.syncFromStores(
        useInstrumentsStore.getState().instruments,
        useMixerStore.getState().mixerTracks,
        useArrangementStore.getState()
      );
      console.log("AudioEngine: İlk senkronizasyon tamamlandı.");
      
      setIsAudioInitialized(true);
    } catch (error){
      console.error("Ses motoru başlatılamadı:", error);
    }
  };

  useEffect(() => {
    return () => {
      if (audioEngine.current) {
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
  );
}

export default App;