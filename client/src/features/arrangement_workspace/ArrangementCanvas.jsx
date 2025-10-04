/**
 * ARRANGEMENT CANVAS - OPTIMIZED
 *
 * Piano Roll rendering pattern'i ile optimize edilmiş
 * - UIUpdateManager entegrasyonu
 * - Viewport-based rendering
 * - LOD sistemi
 * - Smooth animations
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useArrangementWorkspaceStore } from '../../store/useArrangementWorkspaceStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useArrangementEngine } from './hooks/useArrangementEngine';
import { usePatternInteraction } from './hooks/usePatternInteraction';
import { drawArrangement } from './renderers/arrangementRenderer';
import { Plus, Play, Pause, Square, ZoomIn, ZoomOut } from 'lucide-react';

const ArrangementCanvas = ({ arrangement }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const {
    gridSize,
    snapMode,
    editMode,
    setZoom,
    addTrack,
    ensureTrackAtIndex,
    updateClip,
    addClip,
    deleteClip,
    zoom: zoomFromStore
  } = useArrangementWorkspaceStore();

  const { patterns } = useArrangementStore();
  const { isPlaying, transportPosition, togglePlay, stop } = usePlaybackStore();

  const engine = useArrangementEngine(containerRef, arrangement);

  const tracks = arrangement?.tracks || [];
  const clips = arrangement?.clips || [];

  const patternInteraction = usePatternInteraction(
    engine,
    clips,
    tracks,
    gridSize,
    snapMode,
    editMode
  );

  const [selectedClips, setSelectedClips] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedClip, setDraggedClip] = useState(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+D / Ctrl+D - Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedClips.length > 0) {
        e.preventDefault();

        selectedClips.forEach(clipId => {
          const clip = clips.find(c => c.id === clipId);
          if (clip) {
            // Duplicate clip, offset by duration
            addClip({
              ...clip,
              startTime: clip.startTime + clip.duration,
              id: undefined // Let store generate new ID
            });
          }
        });
      }

      // Delete / Backspace - Delete selected clips
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClips.length > 0 && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        selectedClips.forEach(clipId => deleteClip(clipId));
        setSelectedClips([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClips, clips, addClip, deleteClip]);

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !engine.viewport.width) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const engineWithData = {
      ...engine,
      gridSize,
      tracks,
      clips,
      selectedClips,
      playhead: {
        position: transportPosition,
        isPlaying
      },
      patternInteraction: patternInteraction.interactionState
    };

    drawArrangement(ctx, engineWithData);
  }, [engine, gridSize, tracks, clips, selectedClips, transportPosition, isPlaying, patternInteraction.interactionState]);

  // Mouse handlers for pattern interaction
  const handleCanvasMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();

    const interaction = patternInteraction.handleMouseDown(e, rect);

    if (interaction) {
      // Pattern interaction başladı
      if (e.shiftKey) {
        setSelectedClips(prev => [...prev, interaction.clip.id]);
      } else {
        setSelectedClips([interaction.clip.id]);
      }
      setIsDragging(true);
    } else {
      // Boş alana tıklandı
      setSelectedClips([]);
      setIsDragging(false);
    }
  }, [patternInteraction]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (!isDragging) {
      // Sadece cursor güncelle
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + engine.viewport.scrollX;
      const mouseY = e.clientY - rect.top + engine.viewport.scrollY;

      const cursor = patternInteraction.getCursorStyle(mouseX, mouseY);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = cursor;
      }
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    patternInteraction.handleMouseMove(e, rect);
  }, [isDragging, patternInteraction, engine.viewport]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!isDragging) return;

    const result = patternInteraction.handleMouseUp();

    if (result && result.clip) {
      if (result.type === 'split' && result.splitAt) {
        // Split pattern
        const clip = result.clip;
        const pattern = patterns?.[clip.patternId];

        // Create two clips from split
        const leftDuration = result.splitAt - clip.startTime;
        const rightDuration = clip.duration - leftDuration;

        if (leftDuration > 0 && rightDuration > 0) {
          // Update left clip
          updateClip(clip.id, { duration: leftDuration });

          // Create right clip
          addClip({
            type: clip.type,
            patternId: clip.patternId,
            trackId: clip.trackId,
            startTime: result.splitAt,
            duration: rightDuration,
            name: clip.name,
            color: clip.color
          });
        }
      } else if (result.updates) {
        // Move or resize
        updateClip(result.clip.id, result.updates);
      }
    }

    setIsDragging(false);
    setDraggedClip(null);
  }, [isDragging, patternInteraction, updateClip, addClip, patterns]);

  // Drag and drop handlers for patterns from library
  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));

      if (data.type === 'pattern' && data.patternId) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + engine.viewport.scrollX;
        const y = e.clientY - rect.top + engine.viewport.scrollY;

        const TRACK_HEADER_WIDTH = 150;
        const TIMELINE_HEIGHT = 40;
        const PIXELS_PER_BEAT = 32;

        // Calculate which track and time position
        const relativeY = y - TIMELINE_HEIGHT;
        const relativeX = x - TRACK_HEADER_WIDTH;

        const trackIndex = Math.floor(relativeY / engine.dimensions.trackHeight);
        const beatPosition = Math.max(0, relativeX / (PIXELS_PER_BEAT * engine.viewport.zoomX));

        // Ensure track exists at this index (auto-create if virtual)
        const trackId = ensureTrackAtIndex(trackIndex);

        if (trackId) {
          // Get pattern data
          const pattern = patterns?.[data.patternId];

          // Create clip from pattern
          addClip({
            type: 'pattern',
            patternId: data.patternId,
            trackId,
            startTime: Math.floor(beatPosition), // Snap to beat
            duration: pattern?.length || 4,
            name: pattern?.name || 'Pattern',
            color: pattern?.color
          });

          console.log(`🎵 Dropped pattern on track ${trackIndex + 1} at beat ${beatPosition.toFixed(2)}`);
        }
      }
    } catch (error) {
      console.error('Failed to handle drop:', error);
    }
  }, [engine, ensureTrackAtIndex, addClip, patterns]);

  const handleCanvasDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Zoom controls - viewport merkezini koruyarak zoom yap
  const handleZoomIn = useCallback(() => {
    if (!engine.viewportRef?.current) return;

    const vp = engine.viewportRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const TRACK_HEADER_WIDTH = 150;
    const zoomFactor = 1.2;
    const newZoom = Math.min(10, vp.zoomX * zoomFactor);

    // Eğer scrollX 0 ise (sol kenarda), sola sabitlenmiş kal
    if (vp.scrollX === 0) {
      vp.zoomX = newZoom;
      vp.targetZoomX = newZoom;
      // scrollX 0'da kalır
    } else {
      // Viewport merkezine göre zoom
      const centerX = (rect.width - TRACK_HEADER_WIDTH) / 2;
      const worldX = (vp.scrollX + centerX) / vp.zoomX;
      const newScrollX = Math.max(0, (worldX * newZoom) - centerX);

      vp.scrollX = newScrollX;
      vp.zoomX = newZoom;
      vp.targetScrollX = newScrollX;
      vp.targetZoomX = newZoom;
    }

    setZoom(newZoom, vp.zoomY);
  }, [engine, setZoom, containerRef]);

  const handleZoomOut = useCallback(() => {
    if (!engine.viewportRef?.current) return;

    const vp = engine.viewportRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const TRACK_HEADER_WIDTH = 150;
    const zoomFactor = 1 / 1.2;
    const newZoom = Math.max(0.1, vp.zoomX * zoomFactor);

    // Eğer scrollX 0 ise veya olacaksa (sol kenarda), sola sabitlenmiş kal
    const centerX = (rect.width - TRACK_HEADER_WIDTH) / 2;
    const worldX = (vp.scrollX + centerX) / vp.zoomX;
    const newScrollX = (worldX * newZoom) - centerX;

    if (newScrollX <= 0 || vp.scrollX === 0) {
      // Sol kenarda - sola sabitle, scrollX 0'da kal
      vp.scrollX = 0;
      vp.zoomX = newZoom;
      vp.targetScrollX = 0;
      vp.targetZoomX = newZoom;
    } else {
      // Ortada - merkeze göre zoom
      vp.scrollX = newScrollX;
      vp.zoomX = newZoom;
      vp.targetScrollX = newScrollX;
      vp.targetZoomX = newZoom;
    }

    setZoom(newZoom, vp.zoomY);
  }, [engine, setZoom, containerRef]);

  return (
    <div className="arrangement-canvas-optimized">
      <div
        ref={containerRef}
        className="arrangement-canvas-optimized__container"
        onMouseDown={engine.eventHandlers.onMouseDown}
        onMouseMove={engine.eventHandlers.onMouseMove}
        onMouseUp={engine.eventHandlers.onMouseUp}
        tabIndex={0}
      >
        <canvas
          ref={canvasRef}
          className="arrangement-canvas-optimized__canvas"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
      </div>

      {/* Controls */}
      <div className="arrangement-canvas-optimized__controls">
        <button onClick={() => addTrack()}>
          <Plus size={16} /> Add Track
        </button>
        <button onClick={togglePlay}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={stop}>
          <Square size={16} />
        </button>
        <button onClick={handleZoomIn}>
          <ZoomIn size={16} />
        </button>
        <button onClick={handleZoomOut}>
          <ZoomOut size={16} />
        </button>
        <span>{Math.round(engine.viewport.zoomX * 100)}%</span>
        <span style={{ marginLeft: '12px', color: '#6bcf7f', fontSize: '11px' }}>
          LOD: {engine.lod} {(() => {
            const gridMap = { '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125 };
            const base = gridMap[gridSize] || 1;
            const effective = engine.lod >= 4 ? base * 8 :
                             engine.lod >= 3 ? base * 4 :
                             engine.lod >= 2 ? base * 2 : base;
            const effectiveSnap = effective >= 4 ? '1/1' :
                                 effective >= 2 ? '1/2' :
                                 effective >= 1 ? '1/4' :
                                 effective >= 0.5 ? '1/8' :
                                 effective >= 0.25 ? '1/16' : '1/32';
            return `(Grid: ${effectiveSnap})`;
          })()}
        </span>
      </div>
    </div>
  );
};

export default ArrangementCanvas;
export { ArrangementCanvas };
