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
 * OPTIMIZED: Viewport rendering for memory efficiency
 */
export default function PianoRollMiniViewC4({ notes = [], patternLength, onNoteClick, scrollX = 0, viewportWidth = 1000 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // ⚡ PERFORMANCE: Calculate viewport bounds
  const STEP_WIDTH = 16;
  const bufferSteps = 32;
  const visibleSteps = Math.ceil(viewportWidth / STEP_WIDTH);
  const startStep = Math.max(0, Math.floor(scrollX / STEP_WIDTH) - bufferSteps);
  const endStep = Math.min(patternLength, startStep + visibleSteps + bufferSteps * 2);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    // ⚡ PERFORMANCE: Only create canvas for visible viewport
    const viewportSteps = endStep - startStep;
    const stepWidth = STEP_WIDTH;
    const width = viewportSteps * stepWidth;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);

    // ⚡ PERFORMANCE: Draw grid only for visible range
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    // Draw 1/4 beat grid (every 4 steps) - only visible
    const startBeat = Math.floor(startStep / 4) * 4;
    const endBeat = Math.ceil(endStep / 4) * 4;
    for (let beat = startBeat; beat <= endBeat; beat += 4) {
      const x = (beat - startStep) * stepWidth;
      if (x >= 0 && x <= width) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
    }
    ctx.stroke();

    // Draw bar lines (every 16 steps) - thicker, only visible
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;

    const startBar = Math.floor(startStep / 16) * 16;
    const endBar = Math.ceil(endStep / 16) * 16;
    for (let bar = startBar; bar <= endBar; bar += 16) {
      const x = (bar - startStep) * stepWidth;
      if (x >= 0 && x <= width) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
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

    // ⚡ PERFORMANCE: Draw notes only in visible viewport
    if (notes.length > 0) {
      const noteY = height / 2;
      const noteHeight = Math.min(height * 0.6, 24); // Max 24px height

      notes.forEach(note => {
        const noteTime = note.time;
        const noteLengthInSteps = getDurationInSteps(note);
        const noteEndTime = noteTime + noteLengthInSteps;

        // Skip notes outside viewport
        if (noteEndTime < startStep || noteTime > endStep) return;

        // ⚡ PERFORMANCE: Offset position by startStep
        const x = (noteTime - startStep) * stepWidth;
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
  }, [notes, patternLength, scrollX, viewportWidth, startStep, endStep]);

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
          position: 'absolute',
          left: `${startStep * STEP_WIDTH}px`,
        }}
      />
    </div>
  );
}
