export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const TOTAL_OCTAVES = 8;
export const TOTAL_KEYS = TOTAL_OCTAVES * 12;
const RULER_HEIGHT = 32;

export class CoordinateConverter {
  constructor(stepWidth, keyHeight, keyboardWidth) {
    this.stepWidth = stepWidth;
    this.keyHeight = keyHeight;
    this.keyboardWidth = keyboardWidth;
  }

  // Mouse pozisyonunu grid koordinatlarına çevir
  mouseToGrid(clientX, clientY, containerRect, scrollLeft = 0, scrollTop = 0) {
    const x = clientX - containerRect.left + scrollLeft - this.keyboardWidth;
    const y = clientY - containerRect.top + scrollTop - RULER_HEIGHT;
    return { x, y };
  }

  // Grid X koordinatını step'e çevir
  xToStep(x) {
    return Math.max(0, x / this.stepWidth);
  }

  // Step'i grid X koordinatına çevir
  stepToX(step) {
    return step * this.stepWidth;
  }

  // Grid Y koordinatını pitch'e çevir
  yToPitch(y) {
    const keyIndex = TOTAL_KEYS - 1 - Math.floor(y / this.keyHeight);
    const clampedIndex = Math.max(0, Math.min(TOTAL_KEYS - 1, keyIndex));
    const noteIndex = clampedIndex % 12;
    const octave = Math.floor(clampedIndex / 12);
    return `${NOTES[noteIndex]}${octave}`;
  }

  // Pitch'i grid Y koordinatına çevir
  pitchToY(pitch) {
    const noteIndex = NOTES.indexOf(pitch.slice(0, -1));
    const octave = parseInt(pitch.slice(-1));
    const keyIndex = octave * 12 + noteIndex;
    return (TOTAL_KEYS - 1 - keyIndex) * this.keyHeight;
  }

  // Snap time to grid
  snapTime(time, snapValue = 1) {
    return Math.round(time / snapValue) * snapValue;
  }
}
