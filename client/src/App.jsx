import React, {useState, useRef, useEffect} from 'react';
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
import { usePanelsStore } from './store/usePanelsStore';
import { useArrangementStore } from './store/useArrangementStore'; // Aranje store'unu import et

import { initialInstruments, initialMixerTracks } from './config/initialData';
import { calculateAudioLoopLength } from './lib/utils/patternUtils';

const useAudioEngineSync = (audioEngineRef) => {
    const instruments = useInstrumentsStore(state => state.instruments);
    const mixerTracks = useMixerStore(state => state.mixerTracks);
    
    // === HATA DÜZELTMESİ BURADA ===
    // Aranjman verilerini tek bir obje olarak değil, ayrı ayrı seçiyoruz.
    // Zustand, bu dizilerin referanslarını yalnızca içerikleri değiştiğinde günceller.
    // Bu, gereksiz render döngülerini engeller.
    const clips = useArrangementStore(state => state.clips);
    const patterns = useArrangementStore(state => state.patterns);
    const tracks = useArrangementStore(state => state.tracks);

    // useEffect'in bağımlılığını oluşturmak için bir imza (signature) kullanıyoruz.
    // Bu imza sadece yapısal veriler değiştiğinde değişir.
    const structuralSignature = JSON.stringify({
        instruments: instruments.map(i => ({ 
            id: i.id, 
            url: i.url,
            isMuted: i.isMuted, 
            cutItself: i.cutItself, 
            pianoRoll: i.pianoRoll,
        })),
        mixer: mixerTracks.map(t => ({ 
            id: t.id,
            sends: t.sends?.map(s => s.busId),
            effects: t.insertEffects?.map(fx => fx.id) 
        })),
        // İmza'ya aranjmanın sadece ID'lerini dahil etmek yeterlidir.
        // Bu, klip pozisyonu değiştiğinde değil, sadece klip eklendiğinde/silindiğinde
        // motorun tam senkronize olmasını sağlar (performans için daha iyidir).
        // Ancak şimdilik basitlik adına tüm klipleri dahil edelim.
        arrangement: {
            clipIds: clips.map(c => c.id),
            trackIds: tracks.map(t => t.id),
        }
    });

    useEffect(() => {
        const engine = audioEngineRef.current;
        if (engine) {
            console.log("[SYNC] Yapısal bir değişiklik algılandı, motor senkronize ediliyor...");
            
            // Senkronizasyon için gerekli olan tam aranjman verisini burada birleştirip gönderiyoruz.
            const arrangementForSync = { clips, patterns, tracks };
            
            engine.syncFromStores(instruments, mixerTracks, arrangementForSync);
        }
        // Bağımlılık olarak sadece oluşturulan imzayı kullanıyoruz.
    }, [structuralSignature, audioEngineRef, instruments, mixerTracks, clips, patterns, tracks]); 
    // Not: `instruments`, `mixerTracks` vs. de bağımlılıklara eklendi,
    // çünkü `syncFromStores` en güncel hallerini kullanmalı. Signature değişmese bile
    // içerikleri değişmiş olabilir (örn: nota ekleme).

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

// ... (loglama fonksiyonları ve App bileşeninin geri kalanı aynı)
// ... (logStartupHealthCheck, logPostSyncHealthCheck, App)
function logStartupHealthCheck() {
    console.groupCollapsed("SoundForge Başlangıç Sağlık Kontrolü (Beklenen Durum)");
    
    // Genel Ayarlar
    console.log(`🎵 Beklenen BPM: ${usePlaybackStore.getState().bpm}`);
    const expectedLoopLength = calculateAudioLoopLength(initialInstruments);
    console.log(`🔄 Beklenen Ses Döngü Uzunluğu: ${expectedLoopLength} adım`);

    // Enstrümanlar
    console.group("🥁 Yüklenecek Enstrümanlar");
    initialInstruments.forEach(inst => {
        console.log(`- ${inst.name} (ID: ${inst.id}):`);
        console.log(`  - Ses Dosyası: ${inst.url}`);
        console.log(`  - Mixer Kanalı: ${inst.mixerTrackId}`);
        console.log(`  - Planlanacak Nota Sayısı: ${inst.notes.length}`);
    });
    console.groupEnd();

    // Mikser
    console.group("🎚️ Yapılandırılacak Mikser Kanalları");
    const usedTracks = initialMixerTracks.filter(
        track => track.type !== 'track' || initialInstruments.some(inst => inst.mixerTrackId === track.id)
    );
    usedTracks.forEach(track => {
        if(track.type === 'master') {
            console.log(`- MASTER KANALI (ID: ${track.id})`);
        } else if (track.type === 'bus') {
            console.log(`- BUS KANALI: ${track.name} (ID: ${track.id})`);
            track.insertEffects.forEach(fx => console.log(`  - Efekt: ${fx.type}`));
        } else {
             console.log(`- KANAL: ${track.name} (ID: ${track.id})`);
        }
        if(track.sends && track.sends.length > 0) {
            track.sends.forEach(send => console.log(`  - SEND -> ${send.busId} @ ${send.level}dB`));
        }
    });
    console.groupEnd();


    console.log("✅ Beklenen durum loglandı. Şimdi motorun gerçek çıktısı takip edilecek.");
    console.groupEnd();
}

function logPostSyncHealthCheck(engineInstance) {
    if (!engineInstance) {
        console.error("Denetçi: AudioEngine örneği bulunamadı!");
        return;
    }

    console.group("SoundForge Senkronizasyon Sonrası Denetim (Gerçekleşen Durum)");

    const expectedInstrumentCount = initialInstruments.length;
    const actualInstrumentCount = engineInstance.instruments.size;
    const instrumentsMatch = expectedInstrumentCount === actualInstrumentCount;
    console.log(
        `%cEnstrüman Sayısı: ${actualInstrumentCount} / ${expectedInstrumentCount} (Beklenen)`,
        `color: ${instrumentsMatch ? 'green' : 'red'}`
    );

    const expectedNoteCount = initialInstruments.reduce((sum, inst) => sum + inst.notes.length, 0);
    const actualNoteCount = engineInstance.scheduledEventIds.size;
    const notesMatch = expectedNoteCount === actualNoteCount;
    console.log(
        `%cPlanlanan Nota Sayısı: ${actualNoteCount} / ${expectedNoteCount} (Beklenen)`,
        `color: ${notesMatch ? 'green' : 'red'}`
    );
    
    if (!notesMatch) {
        console.warn("DIKKAT: Planlanan nota sayısı ile beklenen nota sayısı eşleşmiyor. Olası nedenler: Yinelenen notalar, zamanlama çakışmaları veya senkronizasyon hatası.");
    }
    
    console.log(`Buffer Önbelleği: ${engineInstance.originalAudioBuffers.size} orijinal, ${engineInstance.processedAudioBuffers.size} işlenmiş buffer yüklü.`);
    
    console.groupEnd();
}

function App() {
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const audioEngine = useRef(null);

  const initializeAudio = async () => {
    if (audioEngine.current) return;
    try {
      await Tone.start();
      console.log("AudioContext başlatıldı.");
      
      logStartupHealthCheck();
      
      const engine = new AudioEngine({
        setPlaybackState: usePlaybackStore.getState().setPlaybackState,
        onProgressUpdate: PlaybackAnimatorService.publish,
        setTransportPosition: usePlaybackStore.getState().setTransportPosition,
      });
      
      // === HATA DÜZELTMESİ BURADA ===
      // Motoru oluşturduktan hemen sonra, store'daki başlangıç BPM'ini motora setliyoruz.
      const initialBpm = usePlaybackStore.getState().bpm;
      engine.setBpm(initialBpm);
      console.log(`AudioEngine: Başlangıç BPM'i ${initialBpm} olarak ayarlandı.`);
      // ==============================

      audioEngine.current = engine;
      
      console.log("AudioEngine: İlk senkronizasyon başlatılıyor...");
      await engine.syncFromStores(
        useInstrumentsStore.getState().instruments,
        useMixerStore.getState().mixerTracks,
        useArrangementStore.getState() // İlk senkronizasyona aranje verisini de ekle
      );
      console.log("AudioEngine: İlk senkronizasyon tamamlandı.");
      
      logPostSyncHealthCheck(audioEngine.current);

      setIsAudioInitialized(true);
    } catch (error){
      console.error("Ses motoru başlatılamadı:", error);
    }
  };

  useEffect(() => {
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