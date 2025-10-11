/**
 * 🎵 ARRANGEMENT PANEL V2
 *
 * Complete rewrite using canvas-based rendering (Piano Roll v7 pattern)
 * - Multi-layer canvas: grid, clips, handles
 * - React overlays: track headers, timeline ruler
 * - 60fps smooth rendering with viewport culling
 * - Zenith theme styling
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useArrangementCanvas, useClipInteraction } from './hooks';
import { useArrangementV2Store } from '@/store/useArrangementV2Store';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useTransportManager } from '@/hooks/useTransportManager';
import { drawGrid, renderAudioClip, renderPatternClip } from './renderers';
import { TimelineRuler } from './components/TimelineRuler';
import { TrackHeader } from './components/TrackHeader';
import { ClipContextMenu } from './components/ClipContextMenu';
import { ArrangementToolbar } from './components/ArrangementToolbar';
import { PatternBrowser } from './components/PatternBrowser';
import { SampleEditor } from './components/SampleEditor';
import { audioAssetManager } from '@/lib/audio/AudioAssetManager';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from '@/lib/core/UIUpdateManager';
import './ArrangementPanelV2.css';

/**
 * Convert pitch string (e.g., "C4", "F#5") to MIDI note number
 */
function pitchToMIDI(pitch) {
  const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
  const match = pitch.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60; // Default to C4

  const [, noteName, octave] = match;
  const midiNote = (parseInt(octave) + 1) * 12 + noteMap[noteName];
  return midiNote;
}

/**
 * Convert Tone.js duration (e.g., "4n", "8n", "16n") to beats
 */
function durationToBeats(duration) {
  if (typeof duration === 'number') return duration;

  const durationMap = {
    '1n': 4,    // Whole note = 4 beats
    '2n': 2,    // Half note = 2 beats
    '4n': 1,    // Quarter note = 1 beat
    '8n': 0.5,  // Eighth note = 0.5 beats
    '16n': 0.25 // Sixteenth note = 0.25 beats
  };

  return durationMap[duration] || 0.25;
}

/**
 * Convert pattern data format to notes array for rendering
 * Pattern data is stored as { channel: [notes] }, we need flat array
 * Pattern notes use: { time: stepNumber, pitch: "C4", velocity, duration: "4n" }
 * Renderer expects: { note: midiNumber, time: beats, duration: beats, velocity }
 */
function convertPatternDataToNotes(pattern) {
  if (!pattern || !pattern.data) {
    return [];
  }

  const notes = [];
  Object.values(pattern.data).forEach((channelNotes) => {
    if (Array.isArray(channelNotes)) {
      channelNotes.forEach(noteData => {
        const midiNote = pitchToMIDI(noteData.pitch);
        const timeInBeats = noteData.time / 16; // Convert steps (16th notes) to beats
        const durationInBeats = durationToBeats(noteData.duration);

        notes.push({
          note: midiNote,
          time: timeInBeats,
          duration: durationInBeats,
          velocity: (noteData.velocity || 1.0) * 127 // Convert 0-1 to 0-127
        });
      });
    }
  });

  return notes;
}

/**
 * Main ArrangementPanelV2 component
 */
export function ArrangementPanelV2() {
  const containerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const gridCanvasRef = useRef(null);
  const clipsCanvasRef = useRef(null);
  const handlesCanvasRef = useRef(null);

  // Transport hook - enables position tracking
  const transport = useTransportManager({ trackPosition: true });

  // Store state
  const tracks = useArrangementV2Store(state => state.tracks);
  const clips = useArrangementV2Store(state => state.clips);
  const selectedClipIds = useArrangementV2Store(state => state.selectedClipIds);
  const clipboard = useArrangementV2Store(state => state.clipboard);
  const cursorPosition = useArrangementV2Store(state => state.cursorPosition);
  const snapEnabled = useArrangementV2Store(state => state.snapEnabled);
  const snapSize = useArrangementV2Store(state => state.snapSize);
  const markers = useArrangementV2Store(state => state.markers);
  const loopRegions = useArrangementV2Store(state => state.loopRegions);

  // Pattern store (for pattern clip rendering)
  const patterns = useArrangementStore(state => state.patterns);
  const updateTrack = useArrangementV2Store(state => state.updateTrack);
  const setCursorPosition = useArrangementV2Store(state => state.setCursorPosition);
  const setSnapEnabled = useArrangementV2Store(state => state.setSnapEnabled);
  const setSnapSize = useArrangementV2Store(state => state.setSnapSize);
  const copySelection = useArrangementV2Store(state => state.copySelection);
  const cutSelection = useArrangementV2Store(state => state.cutSelection);
  const paste = useArrangementV2Store(state => state.paste);
  const duplicateClips = useArrangementV2Store(state => state.duplicateClips);
  const removeClips = useArrangementV2Store(state => state.removeClips);
  const splitClip = useArrangementV2Store(state => state.splitClip);
  const addPatternClip = useArrangementV2Store(state => state.addPatternClip);
  const updateClip = useArrangementV2Store(state => state.updateClip);
  const addMarker = useArrangementV2Store(state => state.addMarker);
  const removeMarker = useArrangementV2Store(state => state.removeMarker);
  const addLoopRegion = useArrangementV2Store(state => state.addLoopRegion);
  const removeLoopRegion = useArrangementV2Store(state => state.removeLoopRegion);
  const updateLoopRegion = useArrangementV2Store(state => state.updateLoopRegion);
  const initializeTransport = useArrangementV2Store(state => state.initializeTransport);
  const cleanupTransport = useArrangementV2Store(state => state.cleanupTransport);

  // Canvas engine
  const engine = useArrangementCanvas(containerRef, tracks);
  const { viewport, dimensions, lod, eventHandlers, setupCanvas, constants } = engine;

  // Layout constants
  const TOOLBAR_HEIGHT = 48;
  const PATTERN_BROWSER_WIDTH = 250;
  const LEFT_OFFSET = PATTERN_BROWSER_WIDTH + constants.TRACK_HEADER_WIDTH; // Total left sidebar width

  // Sample editor state
  const [sampleEditorClip, setSampleEditorClip] = useState(null);

  // Clip double-click handler for sample editor
  const handleClipDoubleClick = useCallback((clip) => {
    // Only open sample editor for audio clips
    if (clip.type === 'audio') {
      console.log('🎵 Opening sample editor for clip:', clip.name);
      setSampleEditorClip(clip);
    }
  }, []);

  // Clip interaction
  const clipInteraction = useClipInteraction(viewport, tracks, clips, constants, dimensions, TOOLBAR_HEIGHT, LEFT_OFFSET, handleClipDoubleClick);
  const {
    marqueeBox,
    hoveredClipId,
    hoveredHandle,
    dragGhosts,
    resizeGhosts,
    fadeGhosts,
    gainGhosts,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    cancelDrag,
    cancelResize,
    cancelFade,
    cancelGain
  } = clipInteraction;

  // Local state
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, clipIds }
  const [activeTool, setActiveTool] = useState('select'); // 'select' | 'delete' | 'split' | 'draw'
  const [deletionMode, setDeletionMode] = useState(false);
  const deletionTimerRef = useRef(null);
  const [splitPreview, setSplitPreview] = useState(null); // { x, y, clips } - preview line position and affected clips
  const [splitStart, setSplitStart] = useState(null); // { x, screenX } - first point when shift+click
  const [splitRange, setSplitRange] = useState(null); // { startX, endX, clips } - range between two points
  const [drawGhost, setDrawGhost] = useState(null); // { trackId, startTime, endTime, x, y, width, height } - preview of clip being drawn
  const [drawStart, setDrawStart] = useState(null); // { x, y, trackId, startTime } - where drawing started

  // Pattern drag state
  const [patternDragPreview, setPatternDragPreview] = useState(null); // { patternId, trackId, startTime, x, y, width, height } - pattern being dragged

  // Loop region interaction state
  const [loopDragStart, setLoopDragStart] = useState(null); // { regionId, startTime, initialX } - for creating/dragging loops
  const [loopDragMode, setLoopDragMode] = useState(null); // 'create' | 'move' | 'resize-start' | 'resize-end'
  const [hoveredLoop, setHoveredLoop] = useState(null); // { regionId, handle } - for hover feedback

  // Initialize transport on mount
  useEffect(() => {
    console.log('🎵 ArrangementV2 mounting, initializing transport...');
    initializeTransport();

    return () => {
      console.log('🎵 ArrangementV2 unmounting, cleaning up transport...');
      cleanupTransport();
    };
  }, [initializeTransport, cleanupTransport]);

  // Sync deletion mode with active tool
  useEffect(() => {
    if (activeTool === 'delete') {
      setDeletionMode(true);
    } else {
      setDeletionMode(false);
    }
  }, [activeTool]);

  // ============================================================================
  // CANVAS RENDERING
  // ============================================================================

  // Grid canvas (background) - static render
  useEffect(() => {
    const canvas = gridCanvasRef.current;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    // Draw grid
    drawGrid(
      ctx,
      viewport.width - constants.TRACK_HEADER_WIDTH,
      viewport.height - constants.TIMELINE_HEIGHT,
      {
        offsetX: viewport.scrollX,
        offsetY: viewport.scrollY,
        zoomX: viewport.zoomX,
        zoomY: viewport.zoomY
      },
      tracks,
      snapSize
    );
  }, [viewport, tracks, snapSize, setupCanvas, constants, dimensions, lod]);

  // Clips canvas (middle layer) - render clips
  useEffect(() => {
    const canvas = clipsCanvasRef.current;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    // Canvas is already positioned after headers (see HTML structure)
    // No clipping needed - just draw directly
    ctx.save();

    // Draw clips with viewport culling
    const { start: startBeat, end: endBeat } = viewport.visibleBeats;
    const { start: startTrack, end: endTrack } = viewport.visibleTracks;

    clips.forEach(async (clip) => {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) {
        console.warn('Clip has invalid trackId:', clip.name, clip.trackId);
        return;
      }

      const trackIndex = tracks.indexOf(track);

      if (trackIndex < startTrack || trackIndex >= endTrack) return;

      const clipEndBeat = clip.startTime + clip.duration;
      if (clipEndBeat < startBeat || clip.startTime > endBeat) return;

      // Calculate clip dimensions in world space
      const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const worldY = trackIndex * dimensions.trackHeight;
      const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
      const height = dimensions.trackHeight;

      // Convert to canvas space (canvas already positioned after headers, like grid)
      // Canvas (0,0) = content area start (after headers)
      // But clipping rect is in canvas coordinates at (TRACK_HEADER_WIDTH, TIMELINE_HEIGHT)
      // So we need to account for that offset
      const x = worldX - viewport.scrollX;
      const y = worldY - viewport.scrollY + 4; // +4 for top padding
      const clipHeight = height - 8; // -8 for top/bottom padding

      const isSelected = selectedClipIds.includes(clip.id);

      // Render based on clip type
      if (clip.type === 'audio') {
        // Load audio buffer if not already loaded
        let audioBuffer = null;
        if (clip.assetId) {
          try {
            // Try to get from cache - don't await to keep rendering synchronous
            const asset = audioAssetManager.assets.get(clip.assetId);
            audioBuffer = asset?.buffer || null;
          } catch (error) {
            console.warn('Failed to load audio buffer for clip', clip.id, error);
          }
        }

        renderAudioClip(ctx, audioBuffer, clip, x, y, width, clipHeight, isSelected, 140, lod);
      } else if (clip.type === 'pattern') {
        // Load pattern data from pattern store
        const pattern = patterns[clip.patternId] || null;

        // Convert pattern data to expected format (data -> notes)
        const patternData = pattern ? {
          ...pattern,
          notes: convertPatternDataToNotes(pattern)
        } : null;

        renderPatternClip(ctx, patternData, clip, x, y, width, clipHeight, isSelected, lod);
      }
    });

    ctx.restore();
  }, [viewport, clips, tracks, selectedClipIds, dimensions, setupCanvas, constants, lod, patterns]);

  // Handles canvas (top layer) - interaction overlays
  useEffect(() => {
    const canvas = handlesCanvasRef.current;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    // Canvas is already positioned after headers (see HTML structure)
    ctx.save();

    // Draw marquee selection box (marqueeBox is already in world space)
    if (marqueeBox) {
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      // Convert marquee from world space to canvas space
      const x = marqueeBox.x - viewport.scrollX;
      const y = marqueeBox.y - viewport.scrollY;

      ctx.fillRect(x, y, marqueeBox.width, marqueeBox.height);
      ctx.strokeRect(x, y, marqueeBox.width, marqueeBox.height);

      ctx.setLineDash([]);
    }

    // Draw drag ghost clips
    if (dragGhosts && dragGhosts.length > 0) {
      dragGhosts.forEach(ghost => {
        // Convert to canvas space
        const x = ghost.x - viewport.scrollX;
        const y = ghost.y - viewport.scrollY + 4;
        const width = ghost.width;
        const height = ghost.height - 8;

        // Draw semi-transparent ghost
        ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.fillRect(x, y, width, height);

        // Draw dashed border
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);

        // Draw clip name
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(ghost.clip.name, x + 8, y + 6);
      });
    }

    // Draw resize ghosts
    if (resizeGhosts && resizeGhosts.length > 0) {
      resizeGhosts.forEach(ghost => {
        // Convert to canvas space
        const x = ghost.x - viewport.scrollX;
        const y = ghost.y - viewport.scrollY + 4;
        const width = ghost.width;
        const height = ghost.height - 8;

        // Draw semi-transparent ghost
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Blue tint for resize
        ctx.fillRect(x, y, width, height);

        // Draw dashed border
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);

        // Draw duration label
        const durationBeats = ghost.newDuration.toFixed(2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${durationBeats} beats`, x + width / 2, y + height / 2);
      });
    }

    // Draw fade ghosts (with gradient overlay)
    if (fadeGhosts && fadeGhosts.length > 0) {
      fadeGhosts.forEach(ghost => {
        // Convert to canvas space
        const x = ghost.x - viewport.scrollX;
        const y = ghost.y - viewport.scrollY + 4;
        const width = ghost.width;
        const height = ghost.height - 8;

        // Draw semi-transparent ghost overlay
        ctx.fillStyle = 'rgba(236, 72, 153, 0.2)'; // Pink tint for fade
        ctx.fillRect(x, y, width, height);

        // Draw fade in gradient (if > 0)
        if (ghost.newFadeIn > 0) {
          const fadeInWidth = (ghost.newFadeIn / ghost.clip.duration) * width;
          const gradient = ctx.createLinearGradient(x, y, x + fadeInWidth, y);
          gradient.addColorStop(0, 'rgba(236, 72, 153, 0.6)');
          gradient.addColorStop(1, 'rgba(236, 72, 153, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, fadeInWidth, height);

          // Draw fade in label
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`In: ${ghost.newFadeIn.toFixed(2)}`, x + 4, y + 4);
        }

        // Draw fade out gradient (if > 0)
        if (ghost.newFadeOut > 0) {
          const fadeOutWidth = (ghost.newFadeOut / ghost.clip.duration) * width;
          const gradient = ctx.createLinearGradient(x + width - fadeOutWidth, y, x + width, y);
          gradient.addColorStop(0, 'rgba(236, 72, 153, 0)');
          gradient.addColorStop(1, 'rgba(236, 72, 153, 0.6)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x + width - fadeOutWidth, y, fadeOutWidth, height);

          // Draw fade out label
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          ctx.fillText(`Out: ${ghost.newFadeOut.toFixed(2)}`, x + width - 4, y + 4);
        }

        // Draw dashed border
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
      });
    }

    // Draw gain ghosts (with gain indicator)
    if (gainGhosts && gainGhosts.length > 0) {
      gainGhosts.forEach(ghost => {
        // Convert to canvas space
        const x = ghost.x - viewport.scrollX;
        const y = ghost.y - viewport.scrollY + 4;
        const width = ghost.width;
        const height = ghost.height - 8;

        // Draw semi-transparent ghost overlay
        ctx.fillStyle = 'rgba(168, 85, 247, 0.2)'; // Purple tint for gain
        ctx.fillRect(x, y, width, height);

        // Draw gain indicator bar (vertical bar showing gain level)
        const gainBarWidth = 4;
        const gainBarX = x + width - gainBarWidth - 8;
        const gainBarY = y + 4;
        const gainBarHeight = height - 8;

        // Normalize gain to 0-1 (from -12 to +12)
        const normalizedGain = (ghost.newGain + 12) / 24;

        // Draw background bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(gainBarX, gainBarY, gainBarWidth, gainBarHeight);

        // Draw gain level indicator
        const gainIndicatorHeight = gainBarHeight * normalizedGain;
        const gainIndicatorY = gainBarY + (gainBarHeight - gainIndicatorHeight);

        // Color based on gain (green = normal, yellow = boost, red = high boost)
        let gainColor;
        if (ghost.newGain < 0) {
          gainColor = 'rgba(34, 197, 94, 0.8)'; // Green for attenuation
        } else if (ghost.newGain < 6) {
          gainColor = 'rgba(168, 85, 247, 0.8)'; // Purple for moderate boost
        } else {
          gainColor = 'rgba(239, 68, 68, 0.8)'; // Red for high boost
        }

        ctx.fillStyle = gainColor;
        ctx.fillRect(gainBarX, gainIndicatorY, gainBarWidth, gainIndicatorHeight);

        // Draw gain label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const gainText = ghost.newGain >= 0 ? `+${ghost.newGain.toFixed(1)} dB` : `${ghost.newGain.toFixed(1)} dB`;
        ctx.fillText(gainText, x + width - 16, y + height - 4);

        // Draw dashed border
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
      });
    }

    // Draw handle highlights (resize, fade, or gain)
    if (hoveredHandle && !dragGhosts && !resizeGhosts && !fadeGhosts && !gainGhosts) {
      const clip = clips.find(c => c.id === hoveredHandle.clipId);
      if (clip) {
        const track = tracks.find(t => t.id === clip.trackId);
        const trackIndex = tracks.indexOf(track);

        if (trackIndex >= 0) {
          // Calculate in world space
          const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = trackIndex * dimensions.trackHeight;
          const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          // Convert to canvas space
          const x = worldX - viewport.scrollX;
          const y = worldY - viewport.scrollY + 4;
          const clipHeight = height - 8;

          if (hoveredHandle.handle === 'left' || hoveredHandle.handle === 'right') {
            // Resize handle highlight (rectangular)
            const handleWidth = 8;
            const handleX = hoveredHandle.handle === 'left' ? x : x + width - handleWidth;

            ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'; // Blue highlight
            ctx.fillRect(handleX, y, handleWidth, clipHeight);

            ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(handleX, y, handleWidth, clipHeight);
          } else if (hoveredHandle.handle === 'fadeIn') {
            // Fade in handle highlight (larger triangular - top-left corner)
            const handleSize = 30; // Larger for better visibility
            ctx.fillStyle = 'rgba(236, 72, 153, 0.5)'; // Brighter pink highlight
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + handleSize, y);
            ctx.lineTo(x, y + handleSize);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(236, 72, 153, 1.0)'; // Solid pink border
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (hoveredHandle.handle === 'fadeOut') {
            // Fade out handle highlight (larger triangular - top-right corner)
            const handleSize = 30; // Larger for better visibility
            ctx.fillStyle = 'rgba(236, 72, 153, 0.5)'; // Brighter pink highlight
            ctx.beginPath();
            ctx.moveTo(x + width, y);
            ctx.lineTo(x + width - handleSize, y);
            ctx.lineTo(x + width, y + handleSize);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(236, 72, 153, 1.0)'; // Solid pink border
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (hoveredHandle.handle === 'gain') {
            // Gain handle highlight (circular - center-bottom of clip)
            // Scale with zoom (smaller when zoomed out)
            const baseRadius = 10;
            const minRadius = 6;
            const handleRadius = Math.max(minRadius, baseRadius * Math.sqrt(viewport.zoomX));
            const handleX = x + width / 2;
            const handleY = y + clipHeight * 0.75; // 75% down from top

            // Draw glow circle
            ctx.fillStyle = 'rgba(168, 85, 247, 0.3)'; // Purple glow
            ctx.beginPath();
            ctx.arc(handleX, handleY, handleRadius + 4, 0, Math.PI * 2);
            ctx.fill();

            // Draw handle circle
            ctx.fillStyle = 'rgba(168, 85, 247, 0.6)'; // Purple highlight
            ctx.beginPath();
            ctx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
            ctx.fill();

            // Draw border
            ctx.strokeStyle = 'rgba(168, 85, 247, 1.0)'; // Solid purple border
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw icon (vertical lines for gain) - scale with handle size
            const iconScale = handleRadius / baseRadius;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 1.5 * iconScale;
            for (let i = -1; i <= 1; i++) {
              const barHeight = (4 + Math.abs(i) * 2) * iconScale;
              ctx.beginPath();
              ctx.moveTo(handleX + i * 3 * iconScale, handleY - barHeight / 2);
              ctx.lineTo(handleX + i * 3 * iconScale, handleY + barHeight / 2);
              ctx.stroke();
            }
          }
        }
      }
    }

    // Draw hover highlight
    if (hoveredClipId && !selectedClipIds.includes(hoveredClipId) && !dragGhosts) {
      const clip = clips.find(c => c.id === hoveredClipId);
      if (clip) {
        const track = tracks.find(t => t.id === clip.trackId);
        const trackIndex = tracks.indexOf(track);

        if (trackIndex >= 0) {
          // Calculate in world space
          const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = trackIndex * dimensions.trackHeight;
          const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          // Convert to canvas space (canvas already after headers)
          const x = worldX - viewport.scrollX;
          const y = worldY - viewport.scrollY + 4;
          const clipHeight = height - 8;

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, clipHeight);
        }
      }
    }

    // Draw split preview line
    if (splitPreview && splitPreview.clips.length > 0) {
      const x = splitPreview.screenX;

      // Draw vertical split line
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)'; // Purple
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw thicker highlight line at cursor
      ctx.strokeStyle = 'rgba(168, 85, 247, 1.0)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height);
      ctx.stroke();

      // Highlight affected clips
      splitPreview.clips.forEach(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        const trackIndex = tracks.indexOf(track);

        if (trackIndex >= 0) {
          const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = trackIndex * dimensions.trackHeight;
          const width = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          const clipX = worldX - viewport.scrollX;
          const clipY = worldY - viewport.scrollY + 4;
          const clipHeight = height - 8;

          // Semi-transparent purple overlay on affected clips
          ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
          ctx.fillRect(clipX, clipY, width, clipHeight);

          // Purple border
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
          ctx.lineWidth = 2;
          ctx.strokeRect(clipX, clipY, width, clipHeight);
        }
      });

      // Draw split icon at cursor
      const iconSize = 24;
      const iconY = 10;

      // Icon background
      ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
      ctx.beginPath();
      ctx.arc(x, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Scissors icon (simplified)
      ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      // Left blade
      ctx.beginPath();
      ctx.moveTo(x - 6, iconY + 8);
      ctx.lineTo(x - 2, iconY + 12);
      ctx.stroke();

      // Right blade
      ctx.beginPath();
      ctx.moveTo(x + 6, iconY + 8);
      ctx.lineTo(x + 2, iconY + 12);
      ctx.stroke();

      // Center pivot
      ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
      ctx.beginPath();
      ctx.arc(x, iconY + 10, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw split range (rectangular area between two vertical lines)
    if (splitRange && splitRange.clips.length > 0) {
      const startX = splitRange.startScreenX;
      const endX = splitRange.endScreenX;
      const width = endX - startX;

      // Draw filled rectangle
      ctx.fillStyle = 'rgba(168, 85, 247, 0.2)'; // Purple semi-transparent
      ctx.fillRect(startX, 0, width, viewport.height);

      // Draw vertical lines at boundaries
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);

      // Start line
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, viewport.height);
      ctx.stroke();

      // End line
      ctx.beginPath();
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, viewport.height);
      ctx.stroke();

      ctx.setLineDash([]);

      // Draw solid lines
      ctx.strokeStyle = 'rgba(168, 85, 247, 1.0)';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, viewport.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, viewport.height);
      ctx.stroke();

      // Highlight affected clips
      splitRange.clips.forEach(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        const trackIndex = tracks.indexOf(track);

        if (trackIndex >= 0) {
          const worldX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = trackIndex * dimensions.trackHeight;
          const clipWidth = clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          const clipX = worldX - viewport.scrollX;
          const clipY = worldY - viewport.scrollY + 4;
          const clipHeight = height - 8;

          // Purple border on affected clips
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
          ctx.lineWidth = 2;
          ctx.strokeRect(clipX, clipY, clipWidth, clipHeight);
        }
      });

      // Draw scissors icons at both boundaries
      const iconSize = 24;
      const positions = [
        { x: startX, label: 'START' },
        { x: endX, label: 'END' }
      ];

      positions.forEach(pos => {
        const iconY = 10;

        // Icon background
        ctx.fillStyle = 'rgba(168, 85, 247, 0.95)';
        ctx.beginPath();
        ctx.arc(pos.x, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Scissors icon
        ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(pos.x - 6, iconY + 8);
        ctx.lineTo(pos.x - 2, iconY + 12);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pos.x + 6, iconY + 8);
        ctx.lineTo(pos.x + 2, iconY + 12);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.beginPath();
        ctx.arc(pos.x, iconY + 10, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw range info label
      const labelY = 50;
      const labelX = (startX + endX) / 2;
      const labelText = `${splitRange.clips.length} clip${splitRange.clips.length > 1 ? 's' : ''}`;

      ctx.fillStyle = 'rgba(168, 85, 247, 0.95)';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      const labelWidth = ctx.measureText(labelText).width + 16;
      const labelHeight = 24;

      ctx.fillRect(labelX - labelWidth / 2, labelY, labelWidth, labelHeight);

      ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, labelX, labelY + labelHeight / 2);
    }

    // Draw ghost clip (being drawn)
    if (drawGhost) {
      const x = drawGhost.x - viewport.scrollX;
      const y = drawGhost.y - viewport.scrollY + 4;
      const width = drawGhost.width;
      const height = drawGhost.height - 8;

      // Draw semi-transparent ghost with green tint
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'; // Green for new clip
      ctx.fillRect(x, y, width, height);

      // Draw dashed border
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // Draw duration label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const durationText = `${drawGhost.duration.toFixed(2)} beats`;
      ctx.fillText(durationText, x + width / 2, y + height / 2);

      // Draw pencil icon at start
      const iconX = x + 8;
      const iconY = y + 8;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.font = '16px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('✏️', iconX, iconY);
    }

    // Draw playhead/cursor line
    if (cursorPosition !== undefined && cursorPosition !== null) {
      const cursorX = (cursorPosition * constants.PIXELS_PER_BEAT * viewport.zoomX) - viewport.scrollX;

      // Only draw if cursor is visible on screen
      if (cursorX >= 0 && cursorX <= viewport.width) {
        // Draw thin vertical line
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // Red playhead
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cursorX, 0);
        ctx.lineTo(cursorX, viewport.height);
        ctx.stroke();

        // Draw playhead indicator at top
        const playheadSize = 8;
        ctx.fillStyle = 'rgba(239, 68, 68, 1.0)';
        ctx.beginPath();
        ctx.moveTo(cursorX, 0);
        ctx.lineTo(cursorX - playheadSize, -playheadSize);
        ctx.lineTo(cursorX + playheadSize, -playheadSize);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw pattern drag preview
    if (patternDragPreview) {
      const x = patternDragPreview.x - viewport.scrollX;
      const y = patternDragPreview.y - viewport.scrollY + 4;
      const width = patternDragPreview.width;
      const height = patternDragPreview.height - 8;

      // Draw semi-transparent ghost with cyan/blue tint
      ctx.fillStyle = 'rgba(34, 211, 238, 0.3)'; // Cyan for pattern
      ctx.fillRect(x, y, width, height);

      // Draw dashed border
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // Draw pattern icon and label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = `🎹 Pattern ${patternDragPreview.patternId}`;
      ctx.fillText(label, x + width / 2, y + height / 2);

      // Draw time label at top
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${patternDragPreview.startTime.toFixed(2)} beats`, x + 8, y + 4);
    }

    ctx.restore();
  }, [viewport, setupCanvas, marqueeBox, hoveredClipId, hoveredHandle, dragGhosts, resizeGhosts, fadeGhosts, gainGhosts, clips, tracks, selectedClipIds, constants, dimensions, splitPreview, splitRange, drawGhost, cursorPosition, patternDragPreview]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input/textarea
      if (e.target.matches('input, textarea')) return;

      // Escape - cancel operations or close context menu or exit deletion mode or cancel split range
      if (e.key === 'Escape') {
        cancelDrag();
        cancelResize();
        cancelFade();
        cancelGain();
        setContextMenu(null);

        // Cancel draw mode
        if (drawStart || drawGhost) {
          setDrawStart(null);
          setDrawGhost(null);
          console.log('✅ Draw cancelled');
          return;
        }

        // Cancel split range selection
        if (splitStart || splitRange) {
          setSplitStart(null);
          setSplitRange(null);
          console.log('✅ Split range cancelled');
          return;
        }

        // Exit deletion mode
        if (deletionMode) {
          setDeletionMode(false);
          setActiveTool('select');
          console.log('✅ Deletion mode deactivated');
        }

        return;
      }

      // Copy - Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          copySelection();
          console.log(`Copied ${selectedClipIds.length} clip(s)`);
        }
        return;
      }

      // Cut - Ctrl+X
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          cutSelection();
          console.log(`Cut ${selectedClipIds.length} clip(s)`);
        }
        return;
      }

      // Paste - Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard && clipboard.length > 0) {
          e.preventDefault();
          paste(cursorPosition);
          console.log(`Pasted ${clipboard.length} clip(s)`);
        }
        return;
      }

      // Duplicate - Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          const newClipIds = duplicateClips(selectedClipIds);
          useArrangementV2Store.getState().setSelection(newClipIds);
          console.log(`Duplicated ${selectedClipIds.length} clip(s)`);
        }
        return;
      }

      // Select All - Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        useArrangementV2Store.getState().selectAll();
        return;
      }

      // Space - toggle play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        // TODO: Connect to playback system
        console.log('Toggle play/pause');
        return;
      }

      // Delete - remove selected clips
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          removeClips(selectedClipIds);
        }
        return;
      }

      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setActiveTool('select');
        console.log('✋ Select tool activated');
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        if (!(e.ctrlKey || e.metaKey)) { // Avoid conflict with Ctrl+D (duplicate)
          e.preventDefault();
          setActiveTool('delete');
          console.log('🗑️ Delete tool activated');
          return;
        }
      }

      if (e.key === 's' || e.key === 'S') {
        if (!(e.ctrlKey || e.metaKey)) { // Avoid conflict with Ctrl+S (save)
          e.preventDefault();
          setActiveTool('split');
          console.log('✂️ Split tool activated');
          return;
        }
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setActiveTool('draw');
        console.log('✏️ Draw tool activated');
        return;
      }

      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const newZoomX = Math.min(4, viewport.zoomX * 1.25);
        eventHandlers.onZoom(newZoomX, viewport.zoomY);
        console.log(`🔍 Zoom in: ${newZoomX.toFixed(2)}x`);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        const newZoomX = Math.max(0.25, viewport.zoomX * 0.8);
        eventHandlers.onZoom(newZoomX, viewport.zoomY);
        console.log(`🔍 Zoom out: ${newZoomX.toFixed(2)}x`);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        eventHandlers.onZoom(1.0, 1.0);
        console.log('🔍 Reset zoom');
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        if (!(e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          // Fit to view - same logic as toolbar button
          if (clips.length === 0) {
            eventHandlers.onZoom(1.0, 1.0);
            return;
          }

          let minTime = Infinity;
          let maxTime = -Infinity;

          clips.forEach(clip => {
            minTime = Math.min(minTime, clip.startTime);
            maxTime = Math.max(maxTime, clip.startTime + clip.duration);
          });

          const totalBeats = maxTime - minTime;
          const availableWidth = viewport.width - constants.TRACK_HEADER_WIDTH;
          const pixelsPerBeat = availableWidth / totalBeats;
          const newZoomX = Math.max(0.25, Math.min(4, pixelsPerBeat / constants.PIXELS_PER_BEAT));

          eventHandlers.onZoom(newZoomX, 1.0);
          console.log(`🔍 Fit to view: ${totalBeats.toFixed(1)} beats, zoom ${newZoomX.toFixed(2)}x`);
          return;
        }
      }

      // Marker shortcuts
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const label = prompt('Marker name:', 'Marker');
        if (label) {
          addMarker(cursorPosition || 0, label);
          console.log(`📍 Added marker "${label}" at ${(cursorPosition || 0).toFixed(2)} beats`);
        }
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        if (!(e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          const label = prompt('Loop region name:', 'Loop');
          if (label) {
            const start = cursorPosition || 0;
            const end = start + 8; // Default 8 beats
            addLoopRegion(start, end, label);
            console.log(`🔄 Added loop region "${label}" from ${start.toFixed(2)} to ${end.toFixed(2)} beats`);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds, clipboard, cursorPosition, cancelDrag, cancelResize, cancelFade, cancelGain, copySelection, cutSelection, paste, duplicateClips, removeClips, setActiveTool, viewport, eventHandlers, clips, constants, deletionMode, setDeletionMode, drawStart, drawGhost, setDrawStart, setDrawGhost, splitStart, splitRange, setSplitStart, setSplitRange, addMarker, addLoopRegion]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleTrackUpdate = (trackId, updates) => {
    updateTrack(trackId, updates);
  };

  const handleTrackClick = (trackIndex) => {
    setSelectedTrackIndex(trackIndex);
  };

  const handleTimelineSeek = (beat) => {
    setCursorPosition(beat);
    // TODO: Connect to playback system
    console.log('Seek to beat:', beat);
  };

  // Context menu handlers
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Get mouse position in canvas coordinates
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Skip if over toolbar, timeline or left sidebars (pattern browser + track headers)
    const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
    if (screenX < LEFT_OFFSET || screenY < totalHeaderHeight) {
      return;
    }

    // Find clip at position using clip interaction helper
    const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
    const canvasY = screenY - totalHeaderHeight + viewport.scrollY;
    const { findClipAtPosition } = clipInteraction;
    const clip = findClipAtPosition(canvasX, canvasY);

    if (clip) {
      // Determine which clips to show in menu
      let menuClipIds;

      if (selectedClipIds.includes(clip.id)) {
        // Right-clicking on a selected clip - show menu for all selected clips
        menuClipIds = selectedClipIds;
      } else {
        // Right-clicking on unselected clip - select only this clip
        useArrangementV2Store.getState().setSelection([clip.id]);
        menuClipIds = [clip.id];
      }

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        clipIds: menuClipIds
      });
    } else {
      // Right-click on empty space - start deletion mode timer
      setContextMenu(null);

      // Clear any existing timer
      if (deletionTimerRef.current) {
        clearTimeout(deletionTimerRef.current);
      }

      // Start deletion mode after 500ms hold
      deletionTimerRef.current = setTimeout(() => {
        setDeletionMode(true);
        setActiveTool('delete');
        console.log('🗑️ Deletion mode activated - Click clips to delete them');
      }, 500);
    }
  };

  const handleRenameClip = () => {
    if (contextMenu && contextMenu.clipIds.length === 1) {
      const clipId = contextMenu.clipIds[0];
      const clip = clips.find(c => c.id === clipId);
      if (clip) {
        const newName = prompt('Rename clip:', clip.name);
        if (newName) {
          useArrangementV2Store.getState().updateClip(clipId, { name: newName });
        }
      }
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Combined mouse handlers (viewport + clip interaction)
  const handleCombinedMouseDown = (e) => {
    // Close context menu on any click
    setContextMenu(null);

    // Cancel deletion mode timer if clicking
    if (deletionTimerRef.current) {
      clearTimeout(deletionTimerRef.current);
      deletionTimerRef.current = null;
    }

    // If in deletion mode and clicking a clip, delete it
    if (deletionMode && e.button === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
        const canvasY = screenY - totalHeaderHeight + viewport.scrollY;
        const { findClipAtPosition } = clipInteraction;
        const clip = findClipAtPosition(canvasX, canvasY);

        if (clip) {
          removeClips([clip.id]);
          console.log(`🗑️ Deleted clip: ${clip.name}`);
          return; // Don't process other interactions
        }
      }
    }

    // If in split mode and clicking
    if (activeTool === 'split' && e.button === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;

        // Shift+Click: Single line split (all clips at once)
        if (e.shiftKey) {
          if (splitPreview && splitPreview.clips.length > 0) {
            const splitTime = splitPreview.x / (constants.PIXELS_PER_BEAT * viewport.zoomX);

            let successCount = 0;
            let failCount = 0;

            splitPreview.clips.forEach(clip => {
              if (splitTime > clip.startTime && splitTime < clip.startTime + clip.duration) {
                const result = splitClip(clip.id, splitTime);
                if (result) {
                  successCount++;
                } else {
                  failCount++;
                }
              } else {
                failCount++;
              }
            });

            if (successCount > 0) {
              console.log(`✂️ Split ${successCount} clip${successCount > 1 ? 's' : ''} at ${splitTime.toFixed(2)} beats`);
            }
            if (failCount > 0) {
              console.warn(`⚠️ ${failCount} clip${failCount > 1 ? 's' : ''} could not be split`);
            }

            setSplitPreview(null);
            return;
          }
        } else {
          // Regular click (no shift): Range split
          if (!splitStart) {
            // First click: Set start point
            setSplitStart({
              x: canvasX,
              screenX: screenX - LEFT_OFFSET
            });
            console.log('📍 Split range start point set');
            return;
          } else if (splitRange && splitRange.clips.length > 0) {
            // Second click: Execute range split
            const startTime = splitRange.startX / (constants.PIXELS_PER_BEAT * viewport.zoomX);
            const endTime = splitRange.endX / (constants.PIXELS_PER_BEAT * viewport.zoomX);

            let successCount = 0;
            let failCount = 0;

            // Split each affected clip at both boundaries
            splitRange.clips.forEach(clip => {
              const clipStart = clip.startTime;
              const clipEnd = clip.startTime + clip.duration;

              // Collect split points within this clip
              const splitPoints = [];
              if (startTime > clipStart && startTime < clipEnd) {
                splitPoints.push(startTime);
              }
              if (endTime > clipStart && endTime < clipEnd && endTime !== startTime) {
                splitPoints.push(endTime);
              }

              // Sort split points
              splitPoints.sort((a, b) => a - b);

              // Execute splits from right to left (to maintain clip IDs)
              splitPoints.reverse().forEach(splitTime => {
                const result = splitClip(clip.id, splitTime);
                if (result) {
                  successCount++;
                } else {
                  failCount++;
                }
              });
            });

            if (successCount > 0) {
              console.log(`✂️ Range split: ${successCount} cut${successCount > 1 ? 's' : ''} made between ${startTime.toFixed(2)} and ${endTime.toFixed(2)} beats`);
            }
            if (failCount > 0) {
              console.warn(`⚠️ ${failCount} cut${failCount > 1 ? 's' : ''} could not be made`);
            }

            // Clear range split state
            setSplitStart(null);
            setSplitRange(null);
            return;
          }
        }
      }
    }

    // If in draw mode and clicking on empty space, start drawing
    if (activeTool === 'draw' && e.button === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
        const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

        // Find which track we're drawing on
        const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
        if (trackIndex >= 0 && trackIndex < tracks.length) {
          const track = tracks[trackIndex];

          // Calculate start time (with snap if enabled)
          let startTime = canvasX / (constants.PIXELS_PER_BEAT * viewport.zoomX);
          if (snapEnabled) {
            startTime = Math.round(startTime / snapSize) * snapSize;
          }

          // Check if clicking on empty space (no existing clip)
          const { findClipAtPosition } = clipInteraction;
          const existingClip = findClipAtPosition(canvasX, canvasY);

          if (!existingClip) {
            setDrawStart({
              x: canvasX,
              y: canvasY,
              trackId: track.id,
              trackIndex,
              startTime
            });
            console.log(`✏️ Started drawing clip on ${track.name} at ${startTime.toFixed(2)} beats`);
            return;
          }
        }
      }
    }

    // Clip interaction takes priority for left mouse button
    if (e.button === 0 && activeTool !== 'draw') {
      handleMouseDown(e);
    }
    // Viewport panning for middle mouse button
    eventHandlers.onMouseDown(e);
  };

  const handleCombinedMouseMove = (e) => {
    handleMouseMove(e);
    eventHandlers.onMouseMove(e);

    // Split preview logic - show where split will occur
    if (activeTool === 'split') {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;

      // Check if mouse is in valid canvas area
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;

        // If we have a split start point, show range preview
        if (splitStart) {
          const startX = Math.min(splitStart.x, canvasX);
          const endX = Math.max(splitStart.x, canvasX);

          // Find all clips that intersect with the range
          const affectedClips = clips.filter(clip => {
            const track = tracks.find(t => t.id === clip.trackId);
            if (!track) return false;

            const clipStartX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
            const clipEndX = clipStartX + (clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX);

            // Check if range overlaps with clip
            return !(endX < clipStartX || startX > clipEndX);
          });

          setSplitRange({
            startX,
            endX,
            startScreenX: Math.min(splitStart.screenX, screenX - LEFT_OFFSET),
            endScreenX: Math.max(splitStart.screenX, screenX - LEFT_OFFSET),
            clips: affectedClips
          });
          setSplitPreview(null);
        } else {
          // Single line preview mode
          const affectedClips = clips.filter(clip => {
            const track = tracks.find(t => t.id === clip.trackId);
            if (!track) return false;

            const clipStartX = clip.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
            const clipEndX = clipStartX + (clip.duration * constants.PIXELS_PER_BEAT * viewport.zoomX);

            return canvasX >= clipStartX && canvasX <= clipEndX;
          });

          if (affectedClips.length > 0) {
            setSplitPreview({
              x: canvasX,
              screenX: screenX - LEFT_OFFSET,
              clips: affectedClips
            });
          } else {
            setSplitPreview(null);
          }
          setSplitRange(null);
        }
      } else {
        setSplitPreview(null);
        setSplitRange(null);
      }
    } else {
      // Clear preview if not in split mode
      if (splitPreview) setSplitPreview(null);
      if (splitRange) setSplitRange(null);
      if (splitStart) setSplitStart(null);
    }

    // Draw mode - show ghost preview while dragging
    if (activeTool === 'draw' && drawStart) {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;

        // Calculate end time (with snap if enabled)
        let endTime = canvasX / (constants.PIXELS_PER_BEAT * viewport.zoomX);
        if (snapEnabled) {
          endTime = Math.round(endTime / snapSize) * snapSize;
        }

        // Ensure end time is after start time
        if (endTime > drawStart.startTime) {
          const duration = endTime - drawStart.startTime;
          const worldX = drawStart.startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = drawStart.trackIndex * dimensions.trackHeight;
          const width = duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          setDrawGhost({
            trackId: drawStart.trackId,
            startTime: drawStart.startTime,
            endTime,
            duration,
            x: worldX,
            y: worldY,
            width,
            height
          });
        } else {
          setDrawGhost(null);
        }
      }
    } else if (drawGhost) {
      setDrawGhost(null);
    }
  };

  const handleCombinedMouseUp = (e) => {
    // Draw mode - create clip on mouse up
    if (activeTool === 'draw' && drawStart && drawGhost) {
      const duration = drawGhost.duration;

      // Minimum duration check (at least 0.25 beats)
      if (duration >= 0.25) {
        // Create a pattern clip (for now, we'll use a default pattern)
        addPatternClip(
          drawStart.trackId,
          drawStart.startTime,
          'default-pattern', // TODO: Allow pattern selection
          duration,
          'default-instrument', // TODO: Allow instrument selection
          `Clip ${drawStart.startTime.toFixed(1)}`
        );
        console.log(`✏️ Created clip with duration ${duration.toFixed(2)} beats`);
      } else {
        console.warn('⚠️ Clip too small (minimum 0.25 beats)');
      }

      // Clear draw state
      setDrawStart(null);
      setDrawGhost(null);
      return;
    }

    handleMouseUp(e);
    eventHandlers.onMouseUp(e);
  };

  const handleCombinedMouseLeave = (e) => {
    handleMouseLeave(e);
    eventHandlers.onMouseLeave(e);
  };

  // Handle pattern drop from pattern browser
  const handlePatternDrop = useCallback((e, patternId) => {
    console.log('🎹 handlePatternDrop called with patternId:', patternId);

    // Clear preview
    setPatternDragPreview(null);

    // Calculate drop position
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Skip if over toolbar, timeline or left sidebars
    const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
    if (screenX < LEFT_OFFSET || screenY < totalHeaderHeight) {
      return;
    }

    // Convert to canvas coordinates
    const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
    const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

    // Find track
    const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
    if (trackIndex < 0 || trackIndex >= tracks.length) return;

    const track = tracks[trackIndex];
    if (!track) return;

    // Calculate start time
    const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
    let startTime = canvasX / (constants.PIXELS_PER_BEAT * zoomX);

    // Snap to grid if enabled
    if (snapEnabled) {
      startTime = Math.round(startTime / snapSize) * snapSize;
    }

    // Default pattern duration (4 bars = 16 beats)
    const duration = 16;

    // Add pattern clip
    addPatternClip(
      track.id,
      startTime,
      patternId,
      duration,
      'default-instrument',
      patterns[patternId]?.name || `Pattern ${patternId}`
    );

    console.log(`🎹 Added pattern "${patterns[patternId]?.name}" at ${startTime.toFixed(2)} beats on track ${track.name}`);
  }, [viewport, tracks, dimensions.trackHeight, snapEnabled, snapSize, addPatternClip, patterns]);

  // Handle audio file and pattern drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    // Don't stop propagation - let it bubble up

    console.log('📦 handleDrop called, dataTransfer types:', e.dataTransfer.types);

    try {
      // Check for pattern drop first
      const patternId = e.dataTransfer.getData('application/x-dawg-pattern');
      console.log('📦 Pattern ID from dataTransfer:', patternId);

      if (patternId) {
        console.log('📦 Calling handlePatternDrop with:', patternId);
        handlePatternDrop(e, patternId);
        return;
      }

      // Otherwise, handle audio file drop
      const data = e.dataTransfer.getData('text/plain');
      if (!data) return;

      const fileData = JSON.parse(data);
      const { name, url } = fileData;

      // Calculate drop position
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Skip if over toolbar, timeline or left sidebars
      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;
      if (screenX < LEFT_OFFSET || screenY < totalHeaderHeight) {
        return;
      }

      // Convert to canvas coordinates
      const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
      const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

      // Find track
      const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
      if (trackIndex < 0 || trackIndex >= tracks.length) return;

      const track = tracks[trackIndex];
      if (!track) return;

      // Calculate start time
      const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
      let startTime = canvasX / (constants.PIXELS_PER_BEAT * zoomX);

      // Snap to grid if enabled
      if (snapEnabled) {
        startTime = Math.round(startTime / snapSize) * snapSize;
      }

      // Load audio buffer to get duration
      audioAssetManager.loadAsset(url, { name, source: 'file-browser' }).then((buffer) => {
        const duration = buffer.duration / (60 / 120); // Convert seconds to beats at 120 BPM

        // Generate asset ID for storage
        const assetId = audioAssetManager.generateAssetId(url);

        // Add audio clip
        const addAudioClip = useArrangementV2Store.getState().addAudioClip;
        addAudioClip(track.id, startTime, assetId, duration, name);

        console.log(`Added audio clip: ${name} at ${startTime} beats on track ${track.name}`);
      }).catch(err => {
        console.error('Failed to load audio:', err);
      });

    } catch (err) {
      console.error('Failed to handle drop:', err);
    }
  }, [handlePatternDrop, viewport, tracks, dimensions.trackHeight, snapEnabled, snapSize]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    // Don't stop propagation - let it bubble up
    e.dataTransfer.dropEffect = 'copy';

    console.log('🔄 DragOver called, types:', Array.from(e.dataTransfer.types));

    // Check if dragging a pattern
    const types = e.dataTransfer.types;
    if (types.includes('application/x-dawg-pattern')) {
      console.log('🔄 DragOver: Pattern detected');
      // Calculate drag position for preview
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const totalHeaderHeight = TOOLBAR_HEIGHT + constants.TIMELINE_HEIGHT;

      // Only show preview if over valid canvas area
      if (screenX >= LEFT_OFFSET && screenY >= totalHeaderHeight) {
        const canvasX = screenX - LEFT_OFFSET + viewport.scrollX;
        const canvasY = screenY - totalHeaderHeight + viewport.scrollY;

        // Find track
        const trackIndex = Math.floor(canvasY / dimensions.trackHeight);
        if (trackIndex >= 0 && trackIndex < tracks.length) {
          const track = tracks[trackIndex];

          // Calculate start time
          const zoomX = isFinite(viewport.zoomX) && viewport.zoomX > 0 ? viewport.zoomX : 1;
          let startTime = canvasX / (constants.PIXELS_PER_BEAT * zoomX);

          // Snap to grid if enabled
          if (snapEnabled) {
            startTime = Math.round(startTime / snapSize) * snapSize;
          }

          // Pattern duration (16 beats = 4 bars)
          const duration = 16;

          // Calculate preview dimensions in world space
          const worldX = startTime * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const worldY = trackIndex * dimensions.trackHeight;
          const width = duration * constants.PIXELS_PER_BEAT * viewport.zoomX;
          const height = dimensions.trackHeight;

          setPatternDragPreview({
            patternId: 'preview', // We'll update with actual ID on drop
            trackId: track.id,
            startTime,
            x: worldX,
            y: worldY,
            width,
            height
          });
        } else {
          setPatternDragPreview(null);
        }
      } else {
        setPatternDragPreview(null);
      }
    } else {
      setPatternDragPreview(null);
    }
  }, [viewport, tracks, dimensions.trackHeight, snapEnabled, snapSize]);

  const handleDragLeave = useCallback(() => {
    // Clear preview when leaving the drop zone
    setPatternDragPreview(null);
  }, []);

  // Fix passive event listener warning - we need { passive: false } for preventDefault
  useEffect(() => {
    const container = containerRef.current;
    const canvasContainer = canvasContainerRef.current;
    if (!container) return;

    // Main container wheel handler (for scrolling)
    const wheelHandler = (e) => {
      eventHandlers.onWheel(e);
    };

    // Canvas container wheel handler (for zooming with Ctrl+Wheel)
    const canvasWheelHandler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        const zoomFactor = 1 + delta;

        if (e.shiftKey) {
          // Shift+Ctrl+Wheel: Vertical zoom
          const newZoomY = Math.max(0.5, Math.min(2, viewport.zoomY * zoomFactor));
          eventHandlers.onZoom(viewport.zoomX, newZoomY);
        } else {
          // Ctrl+Wheel: Horizontal zoom
          const newZoomX = Math.max(0.25, Math.min(4, viewport.zoomX * zoomFactor));
          eventHandlers.onZoom(newZoomX, viewport.zoomY);
        }
      }
    };

    container.addEventListener('wheel', wheelHandler, { passive: false });
    if (canvasContainer) {
      canvasContainer.addEventListener('wheel', canvasWheelHandler, { passive: false });
    }

    return () => {
      container.removeEventListener('wheel', wheelHandler);
      if (canvasContainer) {
        canvasContainer.removeEventListener('wheel', canvasWheelHandler);
      }
    };
  }, [eventHandlers, viewport.zoomX, viewport.zoomY]);

  return (
    <div
      ref={containerRef}
      className="arr-v2-container"
      onMouseDown={handleCombinedMouseDown}
      onMouseMove={handleCombinedMouseMove}
      onMouseUp={handleCombinedMouseUp}
      onMouseLeave={handleCombinedMouseLeave}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Toolbar */}
      <ArrangementToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        snapEnabled={snapEnabled}
        snapSize={snapSize}
        onSnapToggle={() => setSnapEnabled(!snapEnabled)}
        onSnapSizeChange={setSnapSize}
        zoomX={viewport.zoomX}
        zoomY={viewport.zoomY}
        onZoomChange={(zoomX, zoomY) => {
          eventHandlers.onZoom(zoomX, zoomY);
        }}
        onFitToView={() => {
          // Calculate zoom to fit all clips
          if (clips.length === 0) {
            eventHandlers.onZoom(1.0, 1.0);
            return;
          }

          // Find bounds of all clips
          let minTime = Infinity;
          let maxTime = -Infinity;

          clips.forEach(clip => {
            minTime = Math.min(minTime, clip.startTime);
            maxTime = Math.max(maxTime, clip.startTime + clip.duration);
          });

          const totalBeats = maxTime - minTime;
          const availableWidth = viewport.width - constants.TRACK_HEADER_WIDTH;
          const pixelsPerBeat = availableWidth / totalBeats;
          const newZoomX = Math.max(0.25, Math.min(4, pixelsPerBeat / constants.PIXELS_PER_BEAT));

          eventHandlers.onZoom(newZoomX, 1.0);
          console.log(`🔍 Fit to view: ${totalBeats.toFixed(1)} beats, zoom ${newZoomX.toFixed(2)}x`);
        }}
      />

      {/* Timeline Ruler (top overlay) */}
      <div
        className="arr-v2-timeline-container"
        style={{
          height: `${constants.TIMELINE_HEIGHT}px`,
          marginLeft: `${LEFT_OFFSET}px`
        }}
      >
        <TimelineRuler
          viewport={viewport}
          cursorPosition={cursorPosition}
          onSeek={handleTimelineSeek}
          height={constants.TIMELINE_HEIGHT}
          markers={markers}
          loopRegions={loopRegions}
          onAddMarker={(time) => {
            const label = prompt('Marker name:', 'Marker');
            if (label) {
              addMarker(time, label);
              console.log(`📍 Added marker "${label}" at ${time.toFixed(2)} beats`);
            }
          }}
          onRemoveMarker={removeMarker}
          onAddLoopRegion={(startTime, endTime) => {
            const label = prompt('Loop region name:', 'Loop');
            if (label) {
              addLoopRegion(startTime, endTime, label);
              console.log(`🔄 Added loop region "${label}" from ${startTime.toFixed(2)} to ${endTime.toFixed(2)} beats`);
            }
          }}
          onUpdateLoopRegion={updateLoopRegion}
          onRemoveLoopRegion={removeLoopRegion}
          snapEnabled={snapEnabled}
          snapSize={snapSize}
        />
      </div>

      {/* Main content area */}
      <div className="arr-v2-main-content">
        {/* Pattern Browser (left sidebar) */}
        <PatternBrowser />

        {/* Track Headers (left overlay) */}
        <div
          className="arr-v2-track-headers"
          style={{
            width: `${constants.TRACK_HEADER_WIDTH}px`,
            transform: `translateY(${-viewport.scrollY}px)`
          }}
        >
          {tracks.map((track, index) => (
            <TrackHeader
              key={track.id}
              track={track}
              index={index}
              height={dimensions.trackHeight}
              onUpdate={(updates) => handleTrackUpdate(track.id, updates)}
              onDoubleClick={() => handleTrackClick(index)}
              isSelected={selectedTrackIndex === index}
            />
          ))}

          {/* Add Track Button */}
          <button
            className="arr-v2-add-track-btn"
            onClick={() => {
              const addTrack = useArrangementV2Store.getState().addTrack;
              addTrack();
            }}
            title="Add new track"
          >
            <span className="arr-v2-add-track-icon">+</span>
            <span className="arr-v2-add-track-label">Add Track</span>
          </button>
        </div>

        {/* Canvas layers */}
        <div
          ref={canvasContainerRef}
          className="arr-v2-canvas-container"
          style={{
            cursor:
              deletionMode ? 'not-allowed' :
              activeTool === 'split' ? 'col-resize' :
              activeTool === 'draw' ? 'crosshair' :
              hoveredHandle?.handle === 'fadeIn' || hoveredHandle?.handle === 'fadeOut' ? 'nw-resize' :
              hoveredHandle?.handle === 'gain' ? 'ns-resize' :
              hoveredHandle ? 'ew-resize' :
              dragGhosts ? 'grabbing' :
              resizeGhosts ? 'ew-resize' :
              fadeGhosts ? 'nw-resize' :
              gainGhosts ? 'ns-resize' :
              'default'
          }}
          onContextMenu={handleContextMenu}
        >
          <canvas ref={gridCanvasRef} className="arr-v2-canvas arr-v2-canvas-grid" />
          <canvas ref={clipsCanvasRef} className="arr-v2-canvas arr-v2-canvas-clips" />
          <canvas ref={handlesCanvasRef} className="arr-v2-canvas arr-v2-canvas-handles" />
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ClipContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipIds={contextMenu.clipIds}
          hasClipboard={clipboard && clipboard.length > 0}
          onCopy={copySelection}
          onCut={cutSelection}
          onPaste={() => paste(cursorPosition)}
          onDelete={() => removeClips(contextMenu.clipIds)}
          onDuplicate={() => {
            const newClipIds = duplicateClips(contextMenu.clipIds);
            useArrangementV2Store.getState().setSelection(newClipIds);
          }}
          onRename={handleRenameClip}
          onColorChange={(color) => {
            // Apply color to all selected clips
            contextMenu.clipIds.forEach(clipId => {
              updateClip(clipId, { color });
            });
            console.log(`🎨 Changed color for ${contextMenu.clipIds.length} clip${contextMenu.clipIds.length > 1 ? 's' : ''} to ${color}`);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Deletion Mode Indicator */}
      {deletionMode && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            padding: '16px 32px',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 'bold',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        >
          🗑️ DELETION MODE - Click clips to delete (ESC to exit)
        </div>
      )}

      {/* Split Mode Indicator */}
      {activeTool === 'split' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(139, 92, 246, 0.95)',
            color: 'white',
            padding: '16px 32px',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 'bold',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        >
          ✂️ SPLIT MODE - {splitRange ? `Click to cut ${splitRange.clips.length} clip${splitRange.clips.length > 1 ? 's' : ''}` : splitStart ? 'Move and Click for second point' : splitPreview ? `Shift+Click to split ${splitPreview.clips.length} clip${splitPreview.clips.length > 1 ? 's' : ''} | Click for range` : 'Click for range split'} (ESC to exit)
        </div>
      )}

      {/* Draw Mode Indicator */}
      {activeTool === 'draw' && (
        <div
          style={{
            position: 'fixed',
            top: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(34, 197, 94, 0.95)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        >
          ✏️ DRAW MODE - {drawGhost ? `Drawing ${drawGhost.duration.toFixed(2)} beats` : 'Click and drag to create clip'} (ESC to exit)
        </div>
      )}

      {/* Debug overlay */}
      <div className="arr-v2-debug-overlay">
        <div>Zoom: {viewport.zoomX.toFixed(2)}x, {viewport.zoomY.toFixed(2)}y</div>
        <div>Scroll: {Math.round(viewport.scrollX)}, {Math.round(viewport.scrollY)}</div>
        <div>LOD: {lod}</div>
        <div>Tracks: {tracks.length} | Clips: {clips.length}</div>
        <div>Snap: {snapEnabled ? `${snapSize} beats` : 'Off'}</div>
        <div>Tool: {activeTool.toUpperCase()}</div>
        {deletionMode && <div style={{ color: '#ef4444', fontWeight: 'bold' }}>🗑️ DELETION MODE</div>}
        {activeTool === 'split' && <div style={{ color: '#8b5cf6', fontWeight: 'bold' }}>✂️ SPLIT MODE</div>}
        {activeTool === 'draw' && <div style={{ color: '#22c55e', fontWeight: 'bold' }}>✏️ DRAW MODE</div>}
      </div>

      {/* Sample Editor Modal */}
      {sampleEditorClip && (
        <SampleEditor
          clip={sampleEditorClip}
          onClose={() => setSampleEditorClip(null)}
          onUpdate={(updatedClip) => {
            updateClip(sampleEditorClip.id, updatedClip);
            setSampleEditorClip(null);
          }}
        />
      )}
    </div>
  );
}

export default ArrangementPanelV2;
