import { AudioContextService } from './AudioContextService';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { v4 as uuidv4 } from 'uuid';
import { MIXER_TRACK_TYPES, INSTRUMENT_TYPES } from '../../config/constants'; // GÜNCELLENDİ

export class InstrumentService {
  static createInstrumentFromSample(sample) {
    const engine = AudioContextService.getAudioEngine();
    if (!engine) return null;

    const { instruments } = useInstrumentsStore.getState();
    const mixerTracks = useMixerStore.getState().mixerTracks;

    const firstUnusedTrack = mixerTracks.find(track => 
        track.type === MIXER_TRACK_TYPES.TRACK && !instruments.some(inst => inst.mixerTrackId === track.id) // GÜNCELLENDİ
    );

    if (!firstUnusedTrack) {
        alert("Boş mikser kanalı kalmadı!");
        return null;
    }

    const baseName = sample.name.split('.')[0].replace(/_/g, ' ');
    let newName = baseName;
    let counter = 2;
    while (instruments.some(inst => inst.name === newName)) {
        newName = `${baseName} ${counter++}`;
    }

    const newInstrument = {
        id: `inst-${uuidv4()}`,
        name: newName,
        type: INSTRUMENT_TYPES.SAMPLE, // GÜNCELLENDİ
        url: sample.url,
        notes: [],
        mixerTrackId: firstUnusedTrack.id,
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.9, release: 0.5 },
        precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
        isMuted: false,
        cutItself: false,
        pianoRoll: true,
    };

    useInstrumentsStore.setState({ instruments: [...instruments, newInstrument] });
    useMixerStore.getState().setTrackName(firstUnusedTrack.id, newName);

    engine.createInstrument(newInstrument);

    console.log(`✅ InstrumentService: "${newName}" oluşturuldu ve "${firstUnusedTrack.id}" kanalına atandı.`);
    return newInstrument;
  }

  static deleteInstrument(instrumentId) {
    const engine = AudioContextService.getAudioEngine();
    if (!engine) return;

    useInstrumentsStore.setState(state => ({
        instruments: state.instruments.filter(inst => inst.id !== instrumentId)
    }));

    engine.removeInstrument(instrumentId);
    console.log(`🗑️ InstrumentService: "${instrumentId}" silindi.`);
  }
}
