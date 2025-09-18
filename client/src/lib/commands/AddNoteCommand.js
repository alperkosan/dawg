import { Command } from './Command';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { AudioContextService } from '../services/AudioContextService';

/**
 * Bir enstrümana yeni bir nota ekleyen ve bu işlemi geri alabilen komut.
 */
export class AddNoteCommand extends Command {
  /**
   * @param {string} instrumentId - Notanın ekleneceği enstrümanın ID'si.
   * @param {number} step - Notanın ekleneceği adım (zaman).
   */
  constructor(instrumentId, step) {
    super();
    this.instrumentId = instrumentId;
    this.step = step;
    // Bu nota, execute() metodu çalıştığında oluşturulacak ve saklanacaktır.
    // Bu, undo işlemi için gereklidir.
    this.note = null; 
  }

  /**
   * Notayı oluşturur, state'i günceller ve ses motorunu yeniden zamanlar.
   */
  execute() {
    const activePatternId = useArrangementStore.getState().activePatternId;
    if (!activePatternId) return;

    // Geri alma (undo) işlemi için notayı burada oluşturup sınıf içinde saklıyoruz.
    this.note = { 
      id: `note_${this.step}_${Date.now()}_${Math.random().toString(36).substring(7)}`, 
      time: this.step, 
      pitch: 'C4', 
      velocity: 1.0, 
      duration: '16n' 
    };

    const currentNotes = useArrangementStore.getState().patterns[activePatternId].data[this.instrumentId] || [];
    const newNotes = [...currentNotes, this.note];
    
    // 1. State'i Güncelle (Zustand)
    useArrangementStore.getState().updatePatternNotes(activePatternId, this.instrumentId, newNotes);
    
    // 2. Döngü uzunluğunu kontrol et ve gerekirse güncelle
    usePlaybackStore.getState().updateLoopLength();

    // 3. Ses Motoruna Değişikliği Bildir (Notaları yeniden zamanla)
    AudioContextService.getAudioEngine()?.reschedule();
  }

  /**
   * Eklenen notayı state'ten kaldırır ve ses motorunu yeniden zamanlar.
   */
  undo() {
    const activePatternId = useArrangementStore.getState().activePatternId;
    if (!activePatternId || !this.note) return;

    const currentNotes = useArrangementStore.getState().patterns[activePatternId].data[this.instrumentId] || [];
    const newNotes = currentNotes.filter(note => note.id !== this.note.id);
    
    // 1. State'i Güncelle
    useArrangementStore.getState().updatePatternNotes(activePatternId, this.instrumentId, newNotes);
    
    // 2. Döngü uzunluğunu kontrol et
    usePlaybackStore.getState().updateLoopLength();

    // 3. Ses Motoruna Bildir
    AudioContextService.getAudioEngine()?.reschedule();
  }

  /**
   * Komutun ne yaptığına dair kısa bir açıklama döndürür.
   * @returns {string}
   */
  getDescription() {
    return `Add note to instrument ${this.instrumentId} at step ${this.step}`;
  }
}
