import { useArrangementStore } from '../../store/useArrangementStore';
import { AudioContextService } from './AudioContextService';

/**
 * Pattern'lar ve arrangement ile ilgili iş mantığını yöneten servis.
 */
export class PatternService {
  /**
   * Aktif pattern'deki bir enstrümanın notalarını günceller.
   * @param {string} instrumentId 
   * @param {Array} newNotes 
   */
  static updateNotesForActivePattern(instrumentId, newNotes) {
    const engine = AudioContextService.getAudioEngine();
    const { activePatternId, updatePatternNotes } = useArrangementStore.getState();

    if (activePatternId) {
      // 1. State'i Güncelle
      updatePatternNotes(activePatternId, instrumentId, newNotes);
      // 2. Ses Motoruna Komut Gönder (Notaları yeniden zamanla)
      engine?.reschedule();
    }
  }
}
