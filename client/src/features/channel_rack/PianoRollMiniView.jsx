import React, { useMemo, useRef, useEffect } from 'react';
import { PlaybackAnimatorService } from '../../lib/core/PlaybackAnimatorService';
import './PianoRollMiniView.css';

const MINI_HEIGHT = 60;
const MIN_PITCH = 0; // C-1
const MAX_PITCH = 127; // G9
const PITCH_RANGE = MAX_PITCH - MIN_PITCH;

export default function PianoRollMiniView({ instrument, notes, patternLength, theme, onNoteClick }) {
  const canvasRef = useRef(null);
  const playheadRef = useRef(null);

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
    
    // Temizle
    ctx.fillStyle = theme.colors.surface;
    ctx.fillRect(0, 0, width, height);
    
    // Grid çiz
    ctx.strokeStyle = theme.colors.border + '20';
    ctx.lineWidth = 1;
    
    // Bar lines
    for (let i = 0; i <= patternLength / 16; i++) {
      const x = i * 256;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Beat lines (daha soluk)
    ctx.strokeStyle = theme.colors.border + '10';
    for (let i = 0; i < patternLength; i += 4) {
      if (i % 16 !== 0) {
        const x = i * 16;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
    
    // Notaları çiz
    const pitchRange = noteRange.max - noteRange.min;
    const noteHeight = Math.max(2, height / pitchRange);
    
    notes.forEach(note => {
      const midiNumber = typeof note.pitch === 'string' 
        ? pitchToMidi(note.pitch) 
        : note.pitch;
      
      const x = note.time * 16;
      const y = height - ((midiNumber - noteRange.min) / pitchRange * height) - noteHeight;
      const noteWidth = getDurationInSteps(note.duration) * 16;
      
      // Nota gölgesi
      ctx.fillStyle = theme.colors.primary + '20';
      ctx.fillRect(x, y + 1, noteWidth, noteHeight);
      
      // Ana nota
      const gradient = ctx.createLinearGradient(x, y, x + noteWidth, y);
      gradient.addColorStop(0, theme.colors.primary);
      gradient.addColorStop(1, theme.colors.accent);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, noteWidth - 1, noteHeight - 1);
      
      // Velocity göstergesi
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (note.velocity * 0.3) + ')';
      ctx.fillRect(x, y, noteWidth - 1, 2);
    });
    
  }, [notes, patternLength, noteRange, theme]);

  // Playhead animasyonu
  useEffect(() => {
    const updatePlayhead = (progress) => {
      if (playheadRef.current) {
        const position = progress * patternLength * 16;
        playheadRef.current.style.transform = `translateX(${position}px)`;
      }
    };

    PlaybackAnimatorService.subscribe(updatePlayhead);
    return () => PlaybackAnimatorService.unsubscribe(updatePlayhead);
  }, [patternLength]);

  return (
    <div 
      className="piano-roll-mini-view"
      onClick={onNoteClick}
      style={{
        height: `${MINI_HEIGHT}px`,
        backgroundColor: theme.colors.surface,
        borderBottom: `1px solid ${theme.colors.border}`,
        cursor: 'pointer'
      }}
    >
      <div className="mini-view-content">
        <canvas ref={canvasRef} className="mini-view-canvas" />
        <div 
          ref={playheadRef}
          className="mini-view-playhead"
          style={{ 
            backgroundColor: theme.colors.accent,
            height: `${MINI_HEIGHT}px`
          }}
        />
      </div>
      
      {/* Hover overlay */}
      <div className="mini-view-overlay">
        <div className="mini-view-info" style={{ color: theme.colors.text }}>
          <span className="note-count">{notes.length} notes</span>
          <span className="click-hint">Click to edit</span>
        </div>
      </div>
    </div>
  );
}

// Yardımcı fonksiyonlar
function pitchToMidi(pitch) {
  const noteNames = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const noteName = pitch.replace(/[0-9-]/g, '');
  const octave = parseInt(pitch.replace(/[^0-9-]/g, ''));
  return (octave + 1) * 12 + noteNames[noteName];
}

function getDurationInSteps(duration) {
  const durations = {
    '1n': 16, '2n': 8, '4n': 4, '8n': 2, '16n': 1,
    '1n.': 24, '2n.': 12, '4n.': 6, '8n.': 3,
    '1t': 16/3, '2t': 8/3, '4t': 4/3, '8t': 2/3, '16t': 1/3
  };
  return durations[duration] || 1;
}