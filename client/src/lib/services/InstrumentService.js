import { AudioContextService } from './AudioContextService';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enstrümanlarla ilgili tüm iş mantığını merkezileştiren servis.
 * State (Zustand) ve Ses Motoru (AudioEngine) arasındaki iletişimi yönetir.
 */
export class InstrumentService {
  /**
   * Yeni bir sample tabanlı enstrüman oluşturur, state'i günceller ve ses motoruna bildirir.
   * @param {object} sample - Dosya tarayıcısından gelen sample nesnesi ({ name, url }).
   */
  static createInstrumentFromSample(sample) {
    const engine = AudioContextService.getAudioEngine();
    if (!engine) return null;

    const { instruments } = useInstrumentsStore.getState();
    const mixerTracks = useMixerStore.getState().mixerTracks;

    // Boş bir mikser kanalı bul
    const firstUnusedTrack = mixerTracks.find(track => 
        track.type === 'track' && !instruments.some(inst => inst.mixerTrackId === track.id)
    );

    if (!firstUnusedTrack) {
        alert("Boş mikser kanalı kalmadı!");
        return null;
    }

    // Enstrüman isminin benzersiz olmasını sağla
    const baseName = sample.name.split('.')[0].replace(/_/g, ' ');
    let newName = baseName;
    let counter = 2;
    while (instruments.some(inst => inst.name === newName)) {
        newName = `${baseName} ${counter++}`;
    }

    const newInstrument = {
        id: `inst-${uuidv4()}`,
        name: newName,
        type: 'sample',
        url: sample.url,
        notes: [],
        mixerTrackId: firstUnusedTrack.id,
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.9, release: 0.5 },
        precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
        isMuted: false,
        cutItself: false,
        pianoRoll: true,
    };

    // 1. State'i Güncelle (Zustand)
    useInstrumentsStore.setState({ instruments: [...instruments, newInstrument] });
    useMixerStore.getState().setTrackName(firstUnusedTrack.id, newName);

    // 2. Ses Motoruna Komut Gönder
    engine.createInstrument(newInstrument);

    console.log(`✅ InstrumentService: "${newName}" oluşturuldu ve "${firstUnusedTrack.id}" kanalına atandı.`);
    return newInstrument;
  }

  /**
   * Bir enstrümanı siler, state'i günceller ve ses motoruna bildirir.
   * @param {string} instrumentId - Silinecek enstrümanın ID'si.
   */
  static deleteInstrument(instrumentId) {
    const engine = AudioContextService.getAudioEngine();
    if (!engine) return;

    // 1. State'i Güncelle
    useInstrumentsStore.setState(state => ({
        instruments: state.instruments.filter(inst => inst.id !== instrumentId)
    }));
    // Not: İlgili pattern'lardaki notaları da temizlemek gerekebilir (PatternService'in görevi)

    // 2. Ses Motoruna Komut Gönder
    engine.removeInstrument(instrumentId);
    console.log(`🗑️ InstrumentService: "${instrumentId}" silindi.`);
  }
}
