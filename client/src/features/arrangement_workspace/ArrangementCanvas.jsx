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
import ReactDOM from 'react-dom';
import { useArrangementWorkspaceStore } from '@/store/useArrangementWorkspaceStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { usePlaybackStore } from '@/store/usePlaybackStoreV2';
import { useArrangementEngine } from './hooks/useArrangementEngine';
import { usePatternInteraction } from './hooks/usePatternInteraction';
import { drawArrangement } from './renderers/arrangementRenderer';
import { TrackHeaderOverlay } from './components/TrackHeaderOverlay';
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
    selectClips,
    toggleTrackMute,
    toggleTrackSolo,
    zoom: zoomFromStore
  } = useArrangementWorkspaceStore();

  const { patterns } = useArrangementStore();
  const { instruments, handleAddNewInstrument } = useInstrumentsStore();

  // ✅ PERFORMANCE: Only subscribe to position updates in song mode
  const playbackMode = usePlaybackStore(state => state.playbackMode);
  const isPlaying = usePlaybackStore(state => state.isPlaying);
  const currentStep = usePlaybackStore(state => playbackMode === 'song' ? state.currentStep : 0);
  const togglePlay = usePlaybackStore(state => state.togglePlayPause);
  const stop = usePlaybackStore(state => state.handleStop);
  const setTransportPosition = usePlaybackStore(state => state.setTransportPosition);

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
  const [dropPreview, setDropPreview] = useState(null); // Pattern library drop preview
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false); // Track Alt key for stretch mode indicator
  const [contextMenu, setContextMenu] = useState(null); // Right-click context menu

  // Playback mode handler - Song mode için arrangement çalma
  useEffect(() => {
    if (playbackMode === 'song') {
      console.log('🎵 Song mode active - Arrangement clips:', {
        clipCount: clips.length,
        clips: clips.map(c => ({
          id: c.id,
          patternId: c.patternId,
          startTime: c.startTime,
          duration: c.duration,
          trackId: c.trackId
        }))
      });
      // TODO: Schedule arrangement clips to audio engine
    }
  }, [playbackMode, clips]);

  // Keyboard shortcuts and Alt key tracking
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Track Alt key for stretch mode
      if (e.key === 'Alt') {
        setIsAltKeyPressed(true);
      }

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

    const handleKeyUp = (e) => {
      // Track Alt key release
      if (e.key === 'Alt') {
        setIsAltKeyPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
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
      patterns, // Pattern data for mini view
      instruments, // Audio samples for waveform rendering
      playhead: {
        // Only show playhead position in song mode
        position: playbackMode === 'song' ? currentStep : 0,
        isPlaying: playbackMode === 'song' && isPlaying
      },
      patternInteraction: patternInteraction.interactionState,
      dropPreview
    };

    drawArrangement(ctx, engineWithData);
  }, [engine, gridSize, tracks, clips, selectedClips, patterns, instruments, currentStep, isPlaying, playbackMode, patternInteraction.interactionState, dropPreview]);

  // Mouse handlers for pattern interaction
  const handleCanvasMouseDown = useCallback((e) => {
    // Ignore right-click - handled by onContextMenu
    if (e.button === 2) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const TRACK_HEADER_WIDTH = 150;
    const TIMELINE_HEIGHT = 40;
    const PIXELS_PER_BEAT = 32;

    // Timeline click detection
    if (mouseY < TIMELINE_HEIGHT && mouseX > TRACK_HEADER_WIDTH) {
      // Clicked on timeline - stop propagation to prevent panning
      e.stopPropagation();
      const scrollX = engine.viewport?.scrollX || 0;
      const zoomX = engine.viewport?.zoomX || 1;
      const relativeX = mouseX - TRACK_HEADER_WIDTH;
      const worldX = (scrollX + relativeX) / zoomX;
      const beatPosition = worldX / PIXELS_PER_BEAT;

      // Convert beat to bar:beat:tick format (4 beats per bar, 480 ticks per beat)
      const bar = Math.floor(beatPosition / 4);
      const beat = Math.floor(beatPosition % 4);
      const tick = Math.floor((beatPosition % 1) * 480);
      const transportPos = `${bar + 1}:${beat + 1}:${tick}`;
      const step = Math.floor(beatPosition * 4); // Convert to 16th note steps

      setTransportPosition(transportPos, step);
      console.log(`🎯 Timeline clicked: Beat ${beatPosition.toFixed(2)} → ${transportPos} (step ${step})`);
      return;
    }

    const interaction = patternInteraction.handleMouseDown(e, rect);

    if (interaction) {
      // Pattern/audio clip interaction started - prevent canvas panning
      e.stopPropagation();

      if (e.shiftKey) {
        setSelectedClips(prev => [...prev, interaction.clip.id]);
      } else {
        setSelectedClips([interaction.clip.id]);
      }
      setIsDragging(true);
    } else {
      // Empty area clicked - allow canvas panning (don't stopPropagation)
      // Unless Alt key is pressed for time stretch mode
      if (e.altKey) {
        // Alt key pressed but no clip - still prevent panning for UX clarity
        e.stopPropagation();
      }

      setSelectedClips([]);
      setIsDragging(false);
    }
  }, [patternInteraction, engine.viewport, setTransportPosition]);

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

    // Clip interaction in progress - prevent canvas panning
    e.stopPropagation();

    const rect = canvasRef.current.getBoundingClientRect();
    patternInteraction.handleMouseMove(e, rect);
  }, [isDragging, patternInteraction, engine.viewport]);

  const handleCanvasMouseUp = useCallback((e) => {
    if (!isDragging) return;

    // Clip interaction finished - prevent canvas panning events
    e?.stopPropagation();

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

  // Drag and drop handlers for patterns and audio from library
  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();
    setDropPreview(null); // Clear preview

    try {
      const dataText = e.dataTransfer.getData('text/plain');
      const data = JSON.parse(dataText);

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
      const snappedBeat = patternInteraction.snapToGrid(beatPosition);

      // Ensure track exists at this index (auto-create if virtual)
      const trackId = ensureTrackAtIndex(trackIndex);

      if (!trackId) return;

      if (data.type === 'pattern' && data.patternId) {
        // Get pattern data
        const pattern = patterns?.[data.patternId];

        // Convert pattern length from steps to beats (1 beat = 4 steps)
        const patternLengthBeats = pattern?.length ? pattern.length / 4 : 4;

        // Create clip from pattern
        const newClipId = addClip({
          type: 'pattern',
          patternId: data.patternId,
          trackId,
          startTime: snappedBeat,
          duration: patternLengthBeats,
          name: pattern?.name || 'Pattern',
          color: pattern?.color
        });

        console.log(`🎵 Dropped pattern on track ${trackIndex + 1} at beat ${snappedBeat.toFixed(2)}`);

        // ✅ Select the newly created clip for potential immediate editing
        if (newClipId) {
          selectClips([newClipId], false);
        }
      } else if (data.type === 'audio' && data.sampleId) {
        // Create audio clip from sample
        // Default duration: 4 beats (will be adjusted based on actual audio length later)
        const defaultDuration = 4;

        const newClipId = addClip({
          type: 'audio',
          sampleId: data.sampleId,
          trackId,
          startTime: snappedBeat,
          duration: defaultDuration,
          name: data.sampleName || 'Audio Clip',
          color: '#f59e0b' // Orange color for audio clips
        });

        console.log(`🎵 Dropped audio sample on track ${trackIndex + 1} at beat ${snappedBeat.toFixed(2)}`);

        // ✅ Select the newly created clip
        if (newClipId) {
          selectClips([newClipId], false);
        }
      } else if (data.name && data.url) {
        // File browser sample drop (direct from file browser)
        const defaultDuration = 4;

        // Create a temporary sample ID from the URL
        const sampleId = `file-${data.url.replace(/[^a-zA-Z0-9]/g, '-')}`;

        // Check if this audio file is already loaded as an instrument
        let existingInstrument = instruments.find(inst => inst.id === sampleId);

        if (!existingInstrument) {
          // Create a temporary instrument for this audio file
          // This allows the renderer to access the audioBuffer
          const newSample = {
            id: sampleId,
            name: data.name,
            url: data.url,
            type: 'audio'
          };
          handleAddNewInstrument(newSample);
        }

        const newClipId = addClip({
          type: 'audio',
          sampleId, // Use generated ID so renderer can find it
          audioUrl: data.url, // Keep URL for reference
          trackId,
          startTime: snappedBeat,
          duration: defaultDuration,
          name: data.name,
          color: '#f59e0b' // Orange color for audio clips
        });

        console.log(`🎵 Dropped file browser sample "${data.name}" on track ${trackIndex + 1} at beat ${snappedBeat.toFixed(2)}`);

        // ✅ Select the newly created clip
        if (newClipId) {
          selectClips([newClipId], false);
        }
      }
    } catch (error) {
      console.error('Failed to handle drop:', error);
    }
  }, [engine, ensureTrackAtIndex, addClip, patterns, patternInteraction, selectClips, instruments, handleAddNewInstrument]);

  const handleDragLeave = useCallback((e) => {
    // Only clear if leaving canvas completely
    if (e.currentTarget === e.target) {
      setDropPreview(null);
    }
  }, []);

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
          onContextMenu={(e) => {
            e.preventDefault();
            const rect = canvasRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left + engine.viewport.scrollX;
            const mouseY = e.clientY - rect.top + engine.viewport.scrollY;

            // Find clip at mouse position
            const clickedClip = patternInteraction.getClipAtPosition(mouseX, mouseY);

            if (clickedClip) {
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                clipId: clickedClip.id
              });
            }
          }}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleDragLeave}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />

        {/* Track Header Overlay */}
        <TrackHeaderOverlay
          tracks={tracks}
          virtualTrackCount={engine.dimensions.virtualTrackCount}
          trackHeight={engine.dimensions.trackHeight}
          scrollY={engine.viewport.scrollY}
          onToggleMute={toggleTrackMute}
          onToggleSolo={toggleTrackSolo}
          onTrackColorChange={(trackId, color) => {
            // TODO: Implement color change
            console.log('Color change:', trackId, color);
          }}
        />

        {/* Time Stretch Mode Indicator */}
        {isAltKeyPressed && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            background: 'rgba(100, 200, 255, 0.9)',
            color: '#000',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            pointerEvents: 'none',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            <span style={{ fontSize: '14px' }}>⏱️</span>
            TIME STRETCH MODE
          </div>
        )}

        {/* Context Menu - Rendered via Portal to body */}
        {contextMenu && ReactDOM.createPortal(
          <>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999
              }}
              onClick={() => setContextMenu(null)}
            />
            <div
              style={{
                position: 'fixed',
                top: contextMenu.y,
                left: contextMenu.x,
                background: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '4px',
                padding: '4px',
                zIndex: 10000,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                minWidth: '120px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  color: '#ff5555',
                  fontSize: '13px',
                  borderRadius: '2px',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#3a3a3a'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteClip(contextMenu.clipId);
                  setContextMenu(null);
                }}
              >
                Delete Clip
              </div>
            </div>
          </>,
          document.body
        )}
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
