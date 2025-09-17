// FixedPianoRollMiniView.jsx - Turuncu çizgi sorununu çözen mini piano roll
import React, { useMemo, useRef, useEffect } from 'react';
import './PianoRollMiniView.css';

const MINI_HEIGHT = 64;
const MIN_PITCH = 0;
const MAX_PITCH = 127;

export default function PianoRollMiniView({ instrument, notes, patternLength, theme, onNoteClick }) {
  const canvasRef = useRef(null);

  // Nota aralığını hesapla
  const noteRange = useMemo(() => {
    if (notes.length === 0) return { min: 60, max: 72 }; // C4-C5 varsayılan
    
    let minPitch = MAX_PITCH;
    let maxPitch = MIN_PITCH;
    
    notes.forEach(note => {
      const midiNumber = typeof note.pitch === 'string' 
        ? pitchToMidi(note.pitch) 
        : note.pitch;
      if (midiNumber < minPitch) minPitch = midiNumber;
      if (midiNumber > maxPitch) maxPitch = midiNumber;
    });
    
    // Biraz padding ekle
    const padding = 3;
    return {
      min: Math.max(MIN_PITCH, minPitch - padding),
      max: Math.min(MAX_PITCH, maxPitch + padding)
    };
  }, [notes]);

  // Canvas'a notaları çiz
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = patternLength * 16;
    const height = MINI_HEIGHT;
    
    // Canvas boyutunu ayarla
    canvas.width = width;
    canvas.height = height;
    
    // 🔥 DÜZELTME: Arka planı temizle
    ctx.fillStyle = theme.colors.surface;
    ctx.fillRect(0, 0, width, height);
    
    // 🔥 DÜZELTME: Grid çizme - daha hafif
    ctx.strokeStyle = theme.colors.border + '15';
    ctx.lineWidth = 0.5;
    
    // Bar lines - daha az görünür
    for (let i = 0; i <= Math.ceil(patternLength / 16); i++) {
      const x = i * 256;
      if (x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
    
    // Beat lines - çok hafif
    ctx.strokeStyle = theme.colors.border + '08';
    for (let i = 0; i < patternLength; i += 4) {
      if (i % 16 !== 0) {
        const x = i * 16;
        if (x <= width) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
    }
    
    // 🔥 DÜZELTME: Notaları çiz - sadece notalar varsa
    if (notes.length > 0) {
      const pitchRange = noteRange.max - noteRange.min;
      const noteHeight = Math.max(2, Math.min(4, height / pitchRange));
      
      notes.forEach(note => {
        const midiNumber = typeof note.pitch === 'string' 
          ? pitchToMidi(note.pitch) 
          : note.pitch;
        
        const x = note.time * 16;
        const y = height - ((midiNumber - noteRange.min) / pitchRange * height) - noteHeight;
        const noteWidth = getDurationInSteps(note.duration) * 16;
        
        // 🎯 DÜZELTME: Nota renkleri daha güzel
        // Ana nota
        ctx.fillStyle = theme.colors.primary;
        ctx.fillRect(x, y, noteWidth - 1, noteHeight);
        
        // Highlight
        ctx.fillStyle = theme.colors.accent + '60';
        ctx.fillRect(x, y, noteWidth - 1, 1);
      });
    } else {
      // 🔥 DÜZELTME: Nota yoksa boş görünüm
      ctx.fillStyle = theme.colors.muted + '30';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No notes', width / 2, height / 2 + 4);
    }
    
  }, [notes, patternLength, noteRange, theme]);

  return (
    <div 
      className="piano-roll-mini-view"
      onClick={onNoteClick}
      style={{
        height: `${MINI_HEIGHT}px`,
        backgroundColor: theme.colors.surface,
        borderBottom: `1px solid ${theme.colors.border}`,
        cursor: 'pointer',
        position: 'relative'
      }}
    >
      <canvas 
        ref={canvasRef} 
        className="mini-view-canvas"
        style={{ 
          width: '100%', 
          height: '100%',
          display: 'block'
        }}
      />
    </div>
  );
}

// Yardımcı fonksiyonlar
function pitchToMidi(pitch) {
  const noteNames = { 
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, 
    F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 
  };
  const noteName = pitch.replace(/[0-9-]/g, '');
  const octave = parseInt(pitch.replace(/[^0-9-]/g, '')) || 0;
  return Math.max(0, Math.min(127, (octave + 1) * 12 + (noteNames[noteName] || 0)));
}

function getDurationInSteps(duration) {
  const durations = {
    '1n': 16, '2n': 8, '4n': 4, '8n': 2, '16n': 1,
    '1n.': 24, '2n.': 12, '4n.': 6, '8n.': 3,
    '1t': 16/3, '2t': 8/3, '4t': 4/3, '8t': 2/3, '16t': 1/3
  };
  return Math.max(1, durations[duration] || 1);
}