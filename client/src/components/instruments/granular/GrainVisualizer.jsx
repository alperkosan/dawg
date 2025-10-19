/**
 * GrainVisualizer - Interactive grain canvas for granular sampler
 *
 * Visualizes grains as glass pieces that can be clicked to trigger
 * Each grain's size represents its duration
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import './GrainVisualizer.css';

export const GrainVisualizer = ({
  sampleBuffer,
  grainSize,
  grainDensity,
  onGrainClick
}) => {
  const canvasRef = useRef(null);
  const [grains, setGrains] = useState([]);
  const [hoveredGrain, setHoveredGrain] = useState(null);
  const [activeGrains, setActiveGrains] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [playedGrainsDuringDrag, setPlayedGrainsDuringDrag] = useState(new Set());

  /**
   * Calculate grain positions based on sample duration and density
   */
  const calculateGrains = useCallback(() => {
    if (!sampleBuffer) return [];

    const sampleDuration = sampleBuffer.duration;
    const grainDurationSec = grainSize / 1000; // ms to seconds
    const grainsPerSecond = grainDensity;

    // Calculate total number of grains that fit in the sample
    const totalGrains = Math.floor(sampleDuration * grainsPerSecond);
    const maxGrains = Math.min(totalGrains, 100); // Limit to 100 for performance

    const newGrains = [];

    for (let i = 0; i < maxGrains; i++) {
      // Position in sample (0 to 1)
      const position = i / maxGrains;

      // Calculate grain properties
      const grain = {
        id: i,
        position: position, // 0 to 1
        duration: grainDurationSec,
        startTime: position * sampleDuration,
        endTime: Math.min((position * sampleDuration) + grainDurationSec, sampleDuration),
        // Random vertical position for visual variety
        yOffset: Math.random() * 0.6 + 0.2, // 0.2 to 0.8
        // Color variation
        hue: 180 + (position * 60), // Cyan to blue gradient
        brightness: 0.7 + (Math.random() * 0.3)
      };

      newGrains.push(grain);
    }

    return newGrains;
  }, [sampleBuffer, grainSize, grainDensity]);

  /**
   * Recalculate grains when parameters change
   */
  useEffect(() => {
    const newGrains = calculateGrains();
    setGrains(newGrains);
  }, [calculateGrains]);

  /**
   * Draw grain canvas - Solstice inspired
   */
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Dark background (like Solstice)
    const bgGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
    bgGradient.addColorStop(0, '#1a0a28');
    bgGradient.addColorStop(0.5, '#0f0518');
    bgGradient.addColorStop(1, '#050208');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw voronoi-style grain cells
    grains.forEach(grain => {
      const x = grain.position * width;
      const y = grain.yOffset * height;

      // Cell size based on grain duration
      const cellSize = Math.max((grain.duration / (sampleBuffer?.duration || 1)) * width * 2, 15);
      const sides = 6; // Hexagon-like cells

      const isHovered = hoveredGrain === grain.id;
      const isActive = activeGrains.has(grain.id);

      ctx.save();
      ctx.translate(x, y);

      // Glow effect for active/hovered grains
      if (isActive || isHovered) {
        const glowRadius = cellSize * (isActive ? 2 : 1.5);
        const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
        glowGradient.addColorStop(0, `rgba(168, 85, 247, ${isActive ? 0.6 : 0.3})`);
        glowGradient.addColorStop(0.5, `rgba(139, 92, 246, ${isActive ? 0.3 : 0.15})`);
        glowGradient.addColorStop(1, 'rgba(124, 58, 237, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw organic cell shape (irregular polygon)
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = (Math.PI * 2 * i) / sides + grain.id * 0.1; // Slight rotation per grain
        const radius = cellSize * (0.8 + Math.sin(grain.id + i) * 0.2); // Organic variation
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();

      // Fill with purple gradient (Solstice style)
      const cellGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, cellSize);
      const baseAlpha = isActive ? 0.8 : (isHovered ? 0.6 : 0.3);

      // Purple palette like Solstice
      cellGradient.addColorStop(0, `rgba(192, 132, 252, ${baseAlpha})`); // Light purple
      cellGradient.addColorStop(0.4, `rgba(147, 51, 234, ${baseAlpha * 0.8})`); // Medium purple
      cellGradient.addColorStop(0.7, `rgba(109, 40, 217, ${baseAlpha * 0.6})`); // Deep purple
      cellGradient.addColorStop(1, `rgba(88, 28, 135, ${baseAlpha * 0.3})`); // Dark purple

      ctx.fillStyle = cellGradient;
      ctx.fill();

      // Stroke with glowing purple
      const strokeAlpha = isActive ? 1 : (isHovered ? 0.8 : 0.4);
      ctx.strokeStyle = `rgba(168, 85, 247, ${strokeAlpha})`;
      ctx.lineWidth = isActive ? 2 : (isHovered ? 1.5 : 0.8);
      ctx.stroke();

      // Inner glow lines (voronoi effect)
      if (isActive || isHovered || Math.random() > 0.7) {
        ctx.strokeStyle = `rgba(192, 132, 252, ${strokeAlpha * 0.5})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const angle = (Math.PI * 2 * i) / sides + grain.id * 0.1;
          const innerRadius = cellSize * 0.5;
          const px = Math.cos(angle) * innerRadius;
          const py = Math.sin(angle) * innerRadius;
          ctx.moveTo(0, 0);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      ctx.restore();
    });

    // Subtle grid overlay (like Solstice)
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Timeline markers with purple accent
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
    ctx.lineWidth = 1;
    const seconds = Math.ceil(sampleBuffer?.duration || 0);
    for (let i = 0; i <= seconds; i++) {
      const x = (i / (sampleBuffer?.duration || 1)) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Time label
      ctx.fillStyle = 'rgba(192, 132, 252, 0.6)';
      ctx.font = '10px monospace';
      ctx.fillText(`${i}s`, x + 2, 12);
    }
  }, [grains, hoveredGrain, activeGrains, sampleBuffer]);

  /**
   * Draw on mount and when dependencies change
   */
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  /**
   * Helper: Find grain at coordinates
   */
  const findGrainAtPosition = useCallback((x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    return grains.find(grain => {
      const grainX = grain.position * canvas.width;
      const grainY = grain.yOffset * canvas.height;

      // Cell size based on grain duration (matching draw logic)
      const cellSize = Math.max((grain.duration / (sampleBuffer?.duration || 1)) * canvas.width * 2, 15);

      // Simple radial distance check
      const distance = Math.sqrt(
        Math.pow(x - grainX, 2) +
        Math.pow(y - grainY, 2)
      );

      return distance < cellSize;
    });
  }, [grains, sampleBuffer]);

  /**
   * Trigger a grain with visual feedback
   */
  const triggerGrain = useCallback((grain) => {
    if (!grain || !onGrainClick) return;

    // Trigger audio
    onGrainClick(grain.position, grain.duration);

    // Visual feedback
    setActiveGrains(prev => new Set(prev).add(grain.id));
    setTimeout(() => {
      setActiveGrains(prev => {
        const newSet = new Set(prev);
        newSet.delete(grain.id);
        return newSet;
      });
    }, grain.duration * 1000);
  }, [onGrainClick]);

  /**
   * Handle mouse down - Start drag
   */
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const grain = findGrainAtPosition(x, y);

    if (grain) {
      setIsDragging(true);
      setPlayedGrainsDuringDrag(new Set([grain.id]));
      triggerGrain(grain);
    }
  }, [findGrainAtPosition, triggerGrain]);

  /**
   * Handle mouse up - End drag
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setPlayedGrainsDuringDrag(new Set());
  }, []);

  /**
   * Handle mouse move - Hover effect + Drag-to-play
   */
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Scale mouse coordinates to canvas coordinate system
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find grain at current position
    const grain = findGrainAtPosition(x, y);

    // Update hover state
    setHoveredGrain(grain ? grain.id : null);

    // Drag-to-play: If dragging and found a new grain, play it
    if (isDragging && grain && !playedGrainsDuringDrag.has(grain.id)) {
      setPlayedGrainsDuringDrag(prev => new Set(prev).add(grain.id));
      triggerGrain(grain);
    }
  }, [findGrainAtPosition, isDragging, playedGrainsDuringDrag, triggerGrain]);

  /**
   * Handle mouse leave - Stop drag and clear hover
   */
  const handleMouseLeave = useCallback(() => {
    setHoveredGrain(null);
    setIsDragging(false);
    setPlayedGrainsDuringDrag(new Set());
  }, []);

  return (
    <div className="grain-visualizer">
      <div className="grain-visualizer__header">
        <div className="grain-visualizer__title">Grain Canvas</div>
        <div className="grain-visualizer__info">
          {grains.length} grains · {isDragging ? 'Drag to play' : 'Click or drag to trigger'}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="grain-visualizer__canvas"
        width={600}
        height={200}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {hoveredGrain !== null && (
        <div className="grain-visualizer__tooltip">
          Grain #{hoveredGrain} · Position: {(grains[hoveredGrain]?.position * 100).toFixed(1)}% ·
          Duration: {(grains[hoveredGrain]?.duration * 1000).toFixed(0)}ms
        </div>
      )}
    </div>
  );
};
