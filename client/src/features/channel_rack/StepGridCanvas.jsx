import React, { useRef, useEffect, useCallback } from 'react';

const STEP_WIDTH = 16;
const ROW_HEIGHT = 64;

/**
 * ⚡ PERFORMANCE: Canvas-based StepGrid for infinite scroll support
 * Replaces DOM-based StepGrid to avoid rendering thousands of DOM nodes
 */
export default function StepGridCanvas({ instrumentId, notes, totalSteps, onNoteToggle }) {
  const canvasRef = useRef(null);
  const noteSet = new Set(notes.map(n => n.time));
  const [hoveredStep, setHoveredStep] = React.useState(-1);

  // ⚡ PERFORMANCE: Virtual rendering - only draw visible steps
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // 🎨 Get Zenith design tokens from CSS
    const computedStyle = getComputedStyle(document.documentElement);
    const accentCool = computedStyle.getPropertyValue('--zenith-accent-cool').trim();
    const accentCoolRgb = computedStyle.getPropertyValue('--zenith-accent-cool-rgb').trim();
    const borderSubtle = computedStyle.getPropertyValue('--zenith-border-subtle').trim();
    const overlayLight = computedStyle.getPropertyValue('--zenith-overlay-light').trim();

    // Set canvas size
    const width = totalSteps * STEP_WIDTH;
    const height = ROW_HEIGHT;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // ⚡ PERFORMANCE: Batch background grid drawing
    ctx.beginPath();
    ctx.fillStyle = overlayLight;

    // Draw bar backgrounds (every 16 steps)
    for (let bar = 0; bar < Math.ceil(totalSteps / 16); bar++) {
      const barX = bar * 16 * STEP_WIDTH;
      ctx.fillRect(barX, 0, 16 * STEP_WIDTH, height);
    }

    // ⚡ PERFORMANCE: Batch beat dividers
    ctx.beginPath();
    ctx.strokeStyle = borderSubtle;
    ctx.lineWidth = 1;

    for (let beat = 0; beat < totalSteps / 4; beat++) {
      const beatX = beat * 4 * STEP_WIDTH;
      ctx.moveTo(beatX, 0);
      ctx.lineTo(beatX, height);
    }
    ctx.stroke();

    // ⚡ PERFORMANCE: Batch bar dividers (thicker)
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${accentCoolRgb}, 0.1)`;
    ctx.lineWidth = 2;

    for (let bar = 0; bar < Math.ceil(totalSteps / 16); bar++) {
      const barX = bar * 16 * STEP_WIDTH;
      ctx.moveTo(barX, 0);
      ctx.lineTo(barX, height);
    }
    ctx.stroke();

    // ⚡ Draw 1/4 note slots with visible mini-steps
    const slotSize = 4 * STEP_WIDTH; // 1/4 beat = 4 steps
    const noteSlotWidth = slotSize - 4; // Leave 4px gap
    const noteSlotHeight = height * 0.6;
    const noteY = (height - noteSlotHeight) / 2;
    const miniStepWidth = noteSlotWidth / 4;

    // Draw each 1/4 slot background with subtle gradient
    for (let slot = 0; slot < totalSteps / 4; slot++) {
      const x = slot * slotSize + 2;
      const gradient = ctx.createLinearGradient(x, noteY, x, noteY + noteSlotHeight);
      gradient.addColorStop(0, overlayLight);
      gradient.addColorStop(0.5, overlayLight);
      gradient.addColorStop(1, overlayLight);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, noteY, noteSlotWidth, noteSlotHeight);

      // Subtle border around each slot
      ctx.strokeStyle = borderSubtle;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, noteY + 0.5, noteSlotWidth - 1, noteSlotHeight - 1);
    }

    // Draw mini-step dividers within each slot with subtle style
    ctx.strokeStyle = `rgba(${accentCoolRgb}, 0.12)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let slot = 0; slot < totalSteps / 4; slot++) {
      const slotX = slot * slotSize + 2;
      for (let i = 1; i < 4; i++) {
        const dividerX = slotX + (i * miniStepWidth);
        ctx.moveTo(dividerX, noteY + 2);
        ctx.lineTo(dividerX, noteY + noteSlotHeight - 2);
      }
    }
    ctx.stroke();

    // Draw ghost preview for hovered step (if not already a note)
    if (hoveredStep >= 0 && !noteSet.has(hoveredStep)) {
      const slot = Math.floor(hoveredStep / 4);
      const slotX = slot * slotSize + 2;
      const positionInSlot = hoveredStep % 4;
      const ghostX = slotX + (positionInSlot * miniStepWidth) + 1;
      const ghostWidth = miniStepWidth - 2;

      // Ghost preview with low opacity
      ctx.fillStyle = `rgba(${accentCoolRgb}, 0.2)`;
      ctx.fillRect(ghostX, noteY + 1, ghostWidth, noteSlotHeight - 2);

      // Ghost border
      ctx.strokeStyle = `rgba(${accentCoolRgb}, 0.4)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(ghostX + 0.5, noteY + 1.5, ghostWidth - 1, noteSlotHeight - 3);
      ctx.setLineDash([]);
    }

    // Draw active notes with premium style
    notes.forEach(note => {
      const step = note.time;

      // Calculate which 1/4 slot this step belongs to
      const slot = Math.floor(step / 4);
      const slotX = slot * slotSize + 2;

      // Calculate position within the slot (0-3)
      const positionInSlot = step % 4;
      const noteX = slotX + (positionInSlot * miniStepWidth) + 1;
      const noteWidth = miniStepWidth - 2;

      // Gradient fill for notes
      const noteGradient = ctx.createLinearGradient(noteX, noteY, noteX, noteY + noteSlotHeight);
      noteGradient.addColorStop(0, accentCool);
      noteGradient.addColorStop(0.5, accentCool);
      noteGradient.addColorStop(1, accentCool);

      // Glow effect
      ctx.shadowBlur = 12;
      ctx.shadowColor = `rgba(${accentCoolRgb}, 0.6)`;
      ctx.fillStyle = noteGradient;
      ctx.fillRect(noteX, noteY + 1, noteWidth, noteSlotHeight - 2);

      // Inner highlight
      ctx.shadowBlur = 0;
      const highlightGradient = ctx.createLinearGradient(noteX, noteY, noteX, noteY + noteSlotHeight * 0.3);
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = highlightGradient;
      ctx.fillRect(noteX, noteY + 1, noteWidth, noteSlotHeight * 0.3);

      // Border
      ctx.strokeStyle = `rgba(${accentCoolRgb}, 0.8)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(noteX + 0.5, noteY + 1.5, noteWidth - 1, noteSlotHeight - 3);
    });

    ctx.shadowBlur = 0;
  }, [totalSteps, noteSet, hoveredStep]);

  // Redraw when notes change
  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  // Handle mouse move for ghost preview
  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const slotSize = 4 * STEP_WIDTH;
    const slot = Math.floor(x / slotSize);
    const xInSlot = x - (slot * slotSize);
    const miniStepWidth = slotSize / 4;
    const miniStep = Math.floor(xInSlot / miniStepWidth);
    const step = (slot * 4) + miniStep;

    if (step >= 0 && step < totalSteps) {
      setHoveredStep(step);
    }
  }, [totalSteps]);

  const handleMouseLeave = useCallback(() => {
    setHoveredStep(-1);
  }, []);

  // Handle canvas click - detect exact mini-step within 1/4 beat
  const handleClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Calculate which 1/4 slot was clicked
    const slotSize = 4 * STEP_WIDTH;
    const slot = Math.floor(x / slotSize);

    // Calculate which mini-step within the slot (0-3)
    const xInSlot = x - (slot * slotSize);
    const miniStepWidth = slotSize / 4;
    const miniStep = Math.floor(xInSlot / miniStepWidth);

    // Final step = slot * 4 + mini-step position
    const step = (slot * 4) + miniStep;

    if (step >= 0 && step < totalSteps) {
      onNoteToggle(instrumentId, step);
    }
  }, [instrumentId, totalSteps, onNoteToggle]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'block',
        cursor: 'pointer',
        width: `${totalSteps * STEP_WIDTH}px`,
        height: `${ROW_HEIGHT}px`
      }}
    />
  );
}
