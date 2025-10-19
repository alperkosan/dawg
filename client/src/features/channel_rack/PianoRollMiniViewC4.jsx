import React, { useRef, useEffect } from 'react';
import { NativeTimeUtils } from '@/lib/utils/NativeTimeUtils';

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

/**
 * ⚡ Mini Piano Roll Preview - All notes displayed at C4 level in 1/4 grid
 * Shows notes in a single horizontal line for easy visualization
 */
export default function PianoRollMiniViewC4({ notes = [], patternLength, onNoteClick }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);

    // ⚡ PERFORMANCE: Batch grid lines
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    const stepWidth = width / patternLength;

    // Draw 1/4 beat grid (every 4 steps)
    for (let beat = 0; beat <= patternLength; beat += 4) {
      const x = beat * stepWidth;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();

    // Draw bar lines (every 16 steps) - thicker
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;

    for (let bar = 0; bar <= patternLength; bar += 16) {
      const x = bar * stepWidth;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();

    // Draw center line (C4 level)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw notes at C4 level (center)
    if (notes.length > 0) {
      const noteY = height / 2;
      const noteHeight = Math.min(height * 0.6, 24); // Max 24px height

      notes.forEach(note => {
        const x = note.time * stepWidth;
        // ✅ FIX: Use actual note duration instead of fixed width
        const noteLengthInSteps = getDurationInSteps(note);
        const noteWidth = Math.max(noteLengthInSteps * stepWidth - 1, 2); // Min 2px width, -1 for gap

        // Note with glow
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00ff88';
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(
          x,
          noteY - noteHeight / 2,
          noteWidth,
          noteHeight
        );
        ctx.shadowBlur = 0;

        // Border
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          x,
          noteY - noteHeight / 2,
          noteWidth,
          noteHeight
        );
      });
    } else {
      // No notes message
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Click to add notes in Piano Roll', width / 2, height / 2);
    }
  }, [notes, patternLength]);

  const handleClick = (e) => {
    e.stopPropagation();
    onNoteClick();
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        position: 'relative'
      }}
      title="Click to open Piano Roll"
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
}
