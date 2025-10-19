import React, { useMemo, useRef, useEffect } from 'react';
import { NativeTimeUtils } from '@/lib/utils/NativeTimeUtils';

// MIDI nota numarasını "C4" gibi bir dizeye çevirir.
const pitchToMidi = (pitch) => {
    // ✅ FIX: Handle both string and number pitch values
    if (typeof pitch === 'number') {
        return pitch; // Already MIDI number
    }

    if (typeof pitch !== 'string') {
        console.warn('⚠️ Invalid pitch type:', typeof pitch, pitch);
        return 60; // Default to C4
    }

    const noteNames = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const noteName = pitch.replace(/[0-9-]/g, '');
    const octave = parseInt(pitch.replace(/[^0-9-]/g, '')) || 4;
    return (octave + 1) * 12 + (noteNames[noteName] || 0);
};

// Duration'ı step'lere çevir - hem number (length) hem string (duration) destekler
const getDurationInSteps = (note) => {
    // ✅ NEW FORMAT: If note has 'length' property (number), use it directly
    if (typeof note.length === 'number') {
        return note.length;
    }

    // ✅ LEGACY FORMAT: If note has 'duration' property (string like "4n"), parse it
    if (note.duration) {
        try {
            return NativeTimeUtils.parseTime(note.duration, 120) / NativeTimeUtils.parseTime('16n', 120);
        } catch {
            return 1; // Default on error
        }
    }

    // ✅ FALLBACK: Default to 1 step
    return 1;
};

export default function PianoRollMiniView({ notes = [], patternLength, onNoteClick }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Görüntülenecek nota aralığını hesapla
  const noteRange = useMemo(() => {
    if (notes.length === 0) return { min: 48, max: 72 }; // C3-C5 varsayılan aralık

    let minPitch = 127;
    let maxPitch = 0;
    
    notes.forEach(note => {
      const midi = pitchToMidi(note.pitch);
      if (midi < minPitch) minPitch = midi;
      if (midi > maxPitch) maxPitch = midi;
    });
    
    // Görünümü biraz genişlet
    const padding = 4;
    return {
      min: Math.max(0, minPitch - padding),
      max: Math.min(127, maxPitch + padding)
    };
  }, [notes]);

  // Canvas'a notaları çiz
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    // --- ZENITH TEMA ENTEGRASYONU ---
    // CSS'den Zenith design tokens'ları dinamik olarak al
    const styles = getComputedStyle(container);
    const noteColor = styles.getPropertyValue('--zenith-accent-cool').trim();
    const gridColor = styles.getPropertyValue('--zenith-border-subtle').trim();
    const textColor = styles.getPropertyValue('--zenith-text-secondary').trim();

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;

    // Arka planı temizle (artık CSS'den geliyor ama canvas için de yapmak iyi bir pratik)
    ctx.clearRect(0, 0, width, height);
    
    // Arka plan grid'i (bar çizgileri)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const barStepWidth = 16 * (width / patternLength);
    for (let i = 1; i * barStepWidth < width; i++) {
        ctx.beginPath();
        ctx.moveTo(i * barStepWidth, 0);
        ctx.lineTo(i * barStepWidth, height);
        ctx.stroke();
    }
    
    if (notes.length > 0) {
      const pitchRange = Math.max(1, noteRange.max - noteRange.min);
      
      notes.forEach(note => {
        const midi = pitchToMidi(note.pitch);
        // ✅ FIX: Y coordinate calculation - higher pitch should be at top (lower y)
        // Normalize pitch position: 0 = lowest pitch (bottom), 1 = highest pitch (top)
        const normalizedPitch = (midi - noteRange.min) / pitchRange;
        // Invert for canvas coordinates (y=0 is top)
        const y = height * (1 - normalizedPitch);
        const noteHeight = Math.max(1, height / pitchRange);

        const stepWidth = width / patternLength;
        const x = note.time * stepWidth;
        const noteWidth = getDurationInSteps(note) * stepWidth; // ✅ Pass entire note object

        ctx.fillStyle = noteColor;
        ctx.fillRect(x, y, Math.max(1, noteWidth - 1), noteHeight);
      });
    } else {
      // Nota olmadığında gösterilecek yazı
      ctx.fillStyle = textColor;
      ctx.font = '11px var(--font-sans)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Click to open Piano Roll', width / 2, height / 2);
    }
    
  }, [notes, patternLength, noteRange]);

  const handleClick = (e) => {
    e.stopPropagation(); // ✅ Prevent event bubbling to timeline click handler
    onNoteClick();
  };

  return (
    <div
      ref={containerRef}
      className="pr-mini-view"
      onClick={handleClick}
      title="Click to open Piano Roll"
    >
      <canvas
        ref={canvasRef}
        className="pr-mini-view__canvas"
      />
    </div>
  );
}

