import React, { useMemo, useRef, useEffect } from 'react';
import { NativeTimeUtils } from '../../lib/utils/NativeTimeUtils';

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

// Native duration string'ini 16'lık nota adımlarına çevirir.
const getDurationInSteps = (duration) => {
    try {
        return NativeTimeUtils.parseTime(duration, 120) / NativeTimeUtils.parseTime('16n', 120);
    } catch {
        return 1; // Hata durumunda varsayılan
    }
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
    
    // --- TEMA ENTEGRASYONU ---
    // CSS'den renkleri dinamik olarak al
    const styles = getComputedStyle(container);
    const noteColor = styles.getPropertyValue('--color-accent-primary');
    const gridColor = styles.getPropertyValue('--color-surface-3');
    const textColor = styles.getPropertyValue('--color-text-secondary');

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
        const y = height - ((midi - noteRange.min) / pitchRange) * height;
        const noteHeight = Math.max(1, height / pitchRange);

        const stepWidth = width / patternLength;
        const x = note.time * stepWidth;
        const noteWidth = getDurationInSteps(note.duration) * stepWidth;
        
        ctx.fillStyle = noteColor;
        ctx.fillRect(x, y - noteHeight, Math.max(1, noteWidth - 1), noteHeight);
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

