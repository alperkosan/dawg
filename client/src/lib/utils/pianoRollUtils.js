import * as Tone from 'tone';

// Piano Roll için genel amaçlı yardımcı fonksiyonlar.
export const pianoRollUtils = {
  // MIDI nota numarasını "C4" gibi bir dizeye çevirir.
  midiToPitch: (midiNumber) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteIndex = midiNumber % 12;
    return `${noteNames[noteIndex]}${octave}`;
  },

  // "C4" gibi bir dizeyi MIDI nota numarasına çevirir.
  pitchToMidi: (pitch) => {
    const noteNames = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const noteName = pitch.replace(/[0-9]/g, '');
    const octave = parseInt(pitch.slice(-1));
    return (octave + 1) * 12 + noteNames[noteName];
  },

  // Zaman değerini mevcut grid ayarına göre hizalar (quantize).
  quantizeTime: (time, gridValue) => {
    const snap = Tone.Time(gridValue).toSeconds() / Tone.Time('16n').toSeconds();
    return Math.round(time / snap) * snap;
  },

  // Benzersiz bir nota ID'si oluşturur.
  generateNoteId: () => `note_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  
  // Bir değeri min ve max arasında sınırlar.
  clamp: (value, min, max) => Math.max(min, Math.min(value, max))
};
