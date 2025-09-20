// src/features/piano_roll_v2/components/Minimap.jsx
import React, { useRef, useEffect, useMemo, useCallback } from 'react';

const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 120;

export const Minimap = React.memo(({ notes, selectedNotes, engine, onNavigate }) => {
  const canvasRef = useRef(null);

  const scaleFactors = useMemo(() => ({
    x: MINIMAP_WIDTH / engine.gridWidth,
    y: MINIMAP_HEIGHT / engine.gridHeight
  }), [engine.gridWidth, engine.gridHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || engine.gridWidth === 0) return;
    
    // === DÜZELTME BÖLGESİ BAŞLANGICI ===
    // 1. O anki tema renklerini DOM'dan oku
    const computedStyle = getComputedStyle(canvas);
    const primaryColor = computedStyle.getPropertyValue('--color-primary').trim();
    const accentSecondaryColor = computedStyle.getPropertyValue('--color-accent-secondary').trim();
    // === DÜZELTME BÖLGESİ SONU ===
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = 'rgba(17, 24, 39, 0.9)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    notes.forEach(note => {
      const rect = engine.getNoteRect(note);
      // 2. Okunan renkleri kullan
      ctx.fillStyle = selectedNotes.has(note.id) 
        ? primaryColor 
        : 'rgba(59, 130, 246, 0.7)';
      ctx.fillRect(
        rect.x * scaleFactors.x,
        rect.y * scaleFactors.y,
        Math.max(1, rect.width * scaleFactors.x),
        Math.max(1, rect.height * scaleFactors.y)
      );
    });

    // 3. Okunan rengi burada da kullan
    ctx.strokeStyle = accentSecondaryColor; // Önceki kodda yanlışlıkla primary'e çevrilmişti, düzeltildi.
    ctx.lineWidth = 2;
    ctx.strokeRect(
      engine.scroll.x * scaleFactors.x,
      engine.scroll.y * scaleFactors.y,
      engine.size.width * scaleFactors.x,
      engine.size.height * scaleFactors.y
    );
  }, [notes, engine, scaleFactors, selectedNotes]);

  const handleNavigate = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const targetScrollX = (mouseX / MINIMAP_WIDTH) * engine.gridWidth - (engine.size.width / 2);
    const targetScrollY = (mouseY / MINIMAP_HEIGHT) * engine.gridHeight - (engine.size.height / 2);
    
    onNavigate(targetScrollX, targetScrollY);
  }, [engine, onNavigate]);

  return (
    <div className="prv2-minimap">
      <div className="prv2-minimap__header">OVERVIEW</div>
      <canvas
        ref={canvasRef}
        className="prv2-minimap__canvas"
        onClick={handleNavigate}
      />
    </div>
  );
});