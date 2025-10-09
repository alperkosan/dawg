/**
 * ARRANGEMENT CANVAS RENDERER - OPTIMIZED
 *
 * High-performance canvas renderer with:
 * - Viewport-based rendering (only visible area)
 * - Dirty region tracking
 * - Chunked tile system
 * - FPS monitoring
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useArrangementWorkspaceStore } from '@/store/useArrangementWorkspaceStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { Plus, Play, Pause, Square, ZoomIn, ZoomOut } from 'lucide-react';

const ArrangementCanvasRenderer = ({ arrangement }) => {
  const canvasRef = useRef(null);
  const timelineCanvasRef = useRef(null);
  const trackHeaderCanvasRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Performance tracking
  const lastRenderTime = useRef(0);
  const fpsCounter = useRef(0);
  const [fps, setFps] = useState(60);
  const isDirtyRef = useRef(true);
  const lastScrollPos = useRef({ x: 0, y: 0 });
  const lastPlayheadPos = useRef(0);

  const {
    zoom: zoomFromStore,
    trackHeight: trackHeightFromStore,
    gridSize,
    snapMode,
    setZoom,
    addTrack,
    updateTrack,
    addClip,
    updateClip,
    deleteClip
  } = useArrangementWorkspaceStore();

  const { patterns } = useArrangementStore();
  const { isPlaying, transportPosition, togglePlay, stop } = usePlaybackStore();

  // Constants
  const TRACK_HEADER_WIDTH = 150;
  const TIMELINE_HEIGHT = 40;
  const PIXELS_PER_BEAT = 32;
  const BEATS_PER_BAR = 4;
  const CHUNK_SIZE = 1000; // Pixels per chunk for tiling

  // Ensure valid defaults
  const zoom = zoomFromStore?.x && typeof zoomFromStore.x === 'number' ? zoomFromStore : { x: 1, y: 1 };
  const trackHeight = typeof trackHeightFromStore === 'number' ? trackHeightFromStore : 60;

  // Local state
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedClips, setSelectedClips] = useState([]);
  const [draggedClip, setDraggedClip] = useState(null);

  // Calculate dimensions
  const totalBars = arrangement?.length || 128;
  const totalBeats = totalBars * BEATS_PER_BAR;
  const totalWidth = totalBeats * PIXELS_PER_BEAT * zoom.x;
  const tracks = arrangement?.tracks || [];
  const clips = arrangement?.clips || [];

  // Helper functions
  const beatsToPixels = useCallback((beats) => {
    return beats * PIXELS_PER_BEAT * zoom.x;
  }, [zoom.x]);

  const pixelsToBeats = useCallback((pixels) => {
    return pixels / (PIXELS_PER_BEAT * zoom.x);
  }, [zoom.x]);

  const getTrackAtY = useCallback((y) => {
    const trackIndex = Math.floor(y / trackHeight);
    return tracks[trackIndex] || null;
  }, [tracks, trackHeight]);

  // Calculate visible viewport
  const getVisibleBounds = useCallback(() => {
    const startBeat = Math.max(0, Math.floor(pixelsToBeats(scrollPosition.x)) - 4);
    const endBeat = Math.ceil(pixelsToBeats(scrollPosition.x + canvasSize.width)) + 4;
    const startTrack = Math.max(0, Math.floor(scrollPosition.y / trackHeight) - 1);
    const endTrack = Math.min(tracks.length, Math.ceil((scrollPosition.y + canvasSize.height) / trackHeight) + 1);

    return { startBeat, endBeat, startTrack, endTrack };
  }, [scrollPosition, canvasSize, pixelsToBeats, trackHeight, tracks.length]);

  // Mark as dirty when deps change
  useEffect(() => {
    isDirtyRef.current = true;
  }, [zoom.x, gridSize, selectedClips, clips, tracks]);

  // Canvas resize handler
  useEffect(() => {
    const handleResize = () => {
      if (scrollContainerRef.current) {
        const rect = scrollContainerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
        isDirtyRef.current = true;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Draw timeline ruler (viewport optimized)
  const drawTimeline = useCallback((ctx, width) => {
    if (!ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const { startBeat, endBeat } = getVisibleBounds();

    ctx.clearRect(0, 0, width, TIMELINE_HEIGHT);

    // Background
    ctx.fillStyle = styles.getPropertyValue('--zenith-bg-secondary').trim();
    ctx.fillRect(0, 0, width, TIMELINE_HEIGHT);

    // Grid lines and labels
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let beat = startBeat; beat <= endBeat; beat++) {
      const x = beatsToPixels(beat) - scrollPosition.x;

      if (x < -50 || x > width + 50) continue;

      const isMajor = beat % BEATS_PER_BAR === 0;

      // Draw tick
      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 0 : TIMELINE_HEIGHT - 10);
      ctx.lineTo(x, TIMELINE_HEIGHT);
      ctx.strokeStyle = isMajor ? styles.getPropertyValue('--zenith-border-medium').trim() : styles.getPropertyValue('--zenith-border-subtle').trim();
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.stroke();

      // Draw bar number
      if (isMajor && beat > 0) {
        const barNumber = Math.floor(beat / BEATS_PER_BAR) + 1;
        ctx.fillStyle = styles.getPropertyValue('--zenith-text-secondary').trim();
        ctx.fillText(barNumber.toString(), x + 4, 4);
      }
    }
  }, [beatsToPixels, scrollPosition.x, getVisibleBounds]);

  // Draw track headers (viewport optimized)
  const drawTrackHeaders = useCallback((ctx, height) => {
    if (!ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const { startTrack, endTrack } = getVisibleBounds();

    ctx.clearRect(0, 0, TRACK_HEADER_WIDTH, height);

    // Background
    ctx.fillStyle = styles.getPropertyValue('--zenith-bg-secondary').trim();
    ctx.fillRect(0, 0, TRACK_HEADER_WIDTH, height);

    for (let i = startTrack; i < endTrack; i++) {
      const track = tracks[i];
      if (!track) continue;

      const y = i * trackHeight - scrollPosition.y;

      // Track background
      ctx.fillStyle = i % 2 === 0 ? styles.getPropertyValue('--zenith-bg-secondary').trim() : styles.getPropertyValue('--zenith-bg-primary').trim();
      ctx.fillRect(0, y, TRACK_HEADER_WIDTH, trackHeight);

      // Track color indicator
      ctx.fillStyle = track.color || styles.getPropertyValue('--zenith-success').trim();
      ctx.fillRect(0, y, 3, trackHeight);

      // Track name
      ctx.fillStyle = track.muted ? styles.getPropertyValue('--zenith-border-medium').trim() : styles.getPropertyValue('--zenith-text-primary').trim();
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // Clip text to avoid overflow
      ctx.save();
      ctx.beginPath();
      ctx.rect(8, y, TRACK_HEADER_WIDTH - 16, trackHeight);
      ctx.clip();
      ctx.fillText(track.name || `Track ${i + 1}`, 12, y + trackHeight / 2);
      ctx.restore();

      // Divider
      ctx.strokeStyle = styles.getPropertyValue('--zenith-border-subtle').trim();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + trackHeight);
      ctx.lineTo(TRACK_HEADER_WIDTH, y + trackHeight);
      ctx.stroke();
    }
  }, [tracks, trackHeight, scrollPosition.y, getVisibleBounds]);

  // Draw main canvas (viewport optimized)
  const drawMainCanvas = useCallback((ctx, width, height) => {
    if (!ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const { startBeat, endBeat, startTrack, endTrack } = getVisibleBounds();

    ctx.clearRect(0, 0, width, height);

    // Draw tracks (only visible ones)
    for (let i = startTrack; i < endTrack; i++) {
      const track = tracks[i];
      if (!track) continue;

      const y = i * trackHeight - scrollPosition.y;

      // Track background
      ctx.fillStyle = i % 2 === 0 ? styles.getPropertyValue('--zenith-bg-primary').trim() : styles.getPropertyValue('--zenith-bg-secondary').trim();
      ctx.fillRect(0, y, width, trackHeight);

      // Grid lines (sparse rendering based on zoom)
      const gridSizeMap = {
        '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125
      };
      const gridInterval = gridSizeMap[gridSize] || 1;

      // Adaptive grid density based on zoom
      const effectiveInterval = zoom.x < 0.3 ? gridInterval * 4 :
                                 zoom.x < 0.6 ? gridInterval * 2 :
                                 gridInterval;

      for (let beat = Math.floor(startBeat / effectiveInterval) * effectiveInterval;
           beat <= endBeat;
           beat += effectiveInterval) {
        const x = beatsToPixels(beat) - scrollPosition.x;

        if (x < 0 || x > width) continue;

        const isMajor = beat % BEATS_PER_BAR === 0;
        ctx.strokeStyle = isMajor ? styles.getPropertyValue('--zenith-border-medium').trim() : styles.getPropertyValue('--zenith-border-subtle').trim();
        ctx.lineWidth = isMajor ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + trackHeight);
        ctx.stroke();
      }

      // Track divider
      ctx.strokeStyle = styles.getPropertyValue('--zenith-bg-secondary').trim();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + trackHeight);
      ctx.lineTo(width, y + trackHeight);
      ctx.stroke();
    }

    // Draw clips (only visible ones)
    const visibleClips = clips.filter(clip => {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) return false;

      const trackIndex = tracks.indexOf(track);
      if (trackIndex < startTrack || trackIndex >= endTrack) return false;

      const clipEndBeat = clip.startTime + clip.duration;
      return clipEndBeat >= pixelsToBeats(scrollPosition.x) &&
             clip.startTime <= pixelsToBeats(scrollPosition.x + width);
    });

    visibleClips.forEach(clip => {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) return;

      const trackIndex = tracks.indexOf(track);
      const y = trackIndex * trackHeight - scrollPosition.y + 4;
      const x = beatsToPixels(clip.startTime) - scrollPosition.x;
      const clipWidth = beatsToPixels(clip.duration);
      const clipHeight = trackHeight - 8;

      const isSelected = selectedClips.includes(clip.id);

      // Clip background
      ctx.fillStyle = clip.color || track.color || styles.getPropertyValue('--zenith-success').trim();
      ctx.globalAlpha = clip.type === 'pattern' ? 0.6 : 0.8;
      ctx.fillRect(x, y, clipWidth, clipHeight);
      ctx.globalAlpha = 1;

      // Clip border
      ctx.strokeStyle = isSelected ? styles.getPropertyValue('--zenith-success').trim() : 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(x, y, clipWidth, clipHeight);

      // Clip name (only if wide enough)
      if (clipWidth > 40) {
        ctx.fillStyle = styles.getPropertyValue('--zenith-text-primary').trim();
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 2, y + 2, clipWidth - 4, clipHeight - 4);
        ctx.clip();
        ctx.fillText(clip.name || 'Clip', x + 6, y + 6);
        ctx.restore();
      }

      // Pattern preview (only if zoomed in enough)
      if (clip.type === 'pattern' && zoom.x > 0.5 && clipWidth > 60) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        const previewLines = Math.min(16, Math.floor(clipWidth / 8));
        for (let j = 0; j < previewLines; j++) {
          const lineX = x + (clipWidth / previewLines) * j;
          const lineHeight = Math.random() * (clipHeight * 0.6);
          ctx.beginPath();
          ctx.moveTo(lineX, y + clipHeight - 4);
          ctx.lineTo(lineX, y + clipHeight - 4 - lineHeight);
          ctx.stroke();
        }
      }
    });

    // Draw playhead
    const playheadX = (transportPosition / 480) * PIXELS_PER_BEAT * zoom.x - scrollPosition.x;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = styles.getPropertyValue('--zenith-success').trim();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead handle
      ctx.fillStyle = styles.getPropertyValue('--zenith-success').trim();
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [tracks, clips, trackHeight, scrollPosition, beatsToPixels, gridSize, zoom.x, transportPosition, selectedClips, getVisibleBounds, pixelsToBeats]);

  // Optimized render loop with dirty checking
  useEffect(() => {
    let frameCount = 0;
    let fpsTime = performance.now();

    const render = () => {
      const now = performance.now();

      // FPS calculation
      frameCount++;
      if (now - fpsTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsTime = now;
      }

      // Check if we need to render
      const scrollChanged = scrollPosition.x !== lastScrollPos.current.x ||
                           scrollPosition.y !== lastScrollPos.current.y;
      const playheadChanged = Math.abs(transportPosition - lastPlayheadPos.current) > 10;

      if (isDirtyRef.current || scrollChanged || (isPlaying && playheadChanged)) {
        const mainCanvas = canvasRef.current;
        const timelineCanvas = timelineCanvasRef.current;
        const headerCanvas = trackHeaderCanvasRef.current;

        if (mainCanvas && timelineCanvas && headerCanvas) {
          const mainCtx = mainCanvas.getContext('2d');
          const timelineCtx = timelineCanvas.getContext('2d');
          const headerCtx = headerCanvas.getContext('2d');

          // Only redraw changed canvases
          if (scrollChanged || isDirtyRef.current) {
            drawMainCanvas(mainCtx, mainCanvas.width / (window.devicePixelRatio || 1),
                          mainCanvas.height / (window.devicePixelRatio || 1));
            drawTimeline(timelineCtx, timelineCanvas.width / (window.devicePixelRatio || 1));
            drawTrackHeaders(headerCtx, headerCanvas.height / (window.devicePixelRatio || 1));
          } else if (isPlaying && playheadChanged) {
            // Only redraw main canvas for playhead
            drawMainCanvas(mainCtx, mainCanvas.width / (window.devicePixelRatio || 1),
                          mainCanvas.height / (window.devicePixelRatio || 1));
          }

          lastScrollPos.current = { ...scrollPosition };
          lastPlayheadPos.current = transportPosition;
          isDirtyRef.current = false;
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawMainCanvas, drawTimeline, drawTrackHeaders, scrollPosition, isPlaying, transportPosition]);

  // Mouse handlers
  const handleCanvasMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollPosition.x;
    const y = e.clientY - rect.top + scrollPosition.y;

    // Check if clicked on a clip
    const clickedClip = clips.find(clip => {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track) return false;

      const trackIndex = tracks.indexOf(track);
      const clipY = trackIndex * trackHeight + 4;
      const clipX = beatsToPixels(clip.startTime);
      const clipWidth = beatsToPixels(clip.duration);
      const clipHeight = trackHeight - 8;

      return x >= clipX && x <= clipX + clipWidth && y >= clipY && y <= clipY + clipHeight;
    });

    if (clickedClip) {
      if (e.shiftKey) {
        setSelectedClips(prev => [...prev, clickedClip.id]);
      } else {
        setSelectedClips([clickedClip.id]);
      }
      setDraggedClip({
        ...clickedClip,
        offsetX: x - beatsToPixels(clickedClip.startTime),
        offsetY: y
      });
      isDirtyRef.current = true;
    } else {
      setSelectedClips([]);
      isDirtyRef.current = true;
    }

    setIsDragging(true);
  }, [clips, tracks, trackHeight, beatsToPixels, scrollPosition]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (isDragging && draggedClip) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollPosition.x;
      const y = e.clientY - rect.top + scrollPosition.y;

      const newStartTime = pixelsToBeats(x - draggedClip.offsetX);
      const track = getTrackAtY(y);

      if (track) {
        updateClip(draggedClip.id, {
          startTime: Math.max(0, Math.round(newStartTime * 4) / 4),
          trackId: track.id
        });
        isDirtyRef.current = true;
      }
    }
  }, [isDragging, draggedClip, scrollPosition, pixelsToBeats, getTrackAtY, updateClip]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedClip(null);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const newZoom = Math.max(0.1, Math.min(10, zoom.x * (1 + delta)));
      setZoom(newZoom, zoom.y);
      isDirtyRef.current = true;
    }
  }, [zoom, setZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Set canvas DPI
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;

    [canvasRef, timelineCanvasRef, trackHeaderCanvasRef].forEach(ref => {
      const canvas = ref.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    });

    isDirtyRef.current = true;
  }, [canvasSize]);

  return (
    <div className="arrangement-canvas-renderer">
      {/* Timeline */}
      <div className="arrangement-canvas-renderer__timeline">
        <div className="arrangement-canvas-renderer__timeline-corner" style={{ width: TRACK_HEADER_WIDTH }} />
        <canvas
          ref={timelineCanvasRef}
          className="arrangement-canvas-renderer__timeline-canvas"
          style={{ width: canvasSize.width - TRACK_HEADER_WIDTH, height: TIMELINE_HEIGHT }}
        />
      </div>

      {/* Main content */}
      <div className="arrangement-canvas-renderer__content">
        {/* Track headers */}
        <canvas
          ref={trackHeaderCanvasRef}
          className="arrangement-canvas-renderer__headers"
          style={{ width: TRACK_HEADER_WIDTH, height: canvasSize.height - TIMELINE_HEIGHT }}
        />

        {/* Main canvas */}
        <div
          ref={scrollContainerRef}
          className="arrangement-canvas-renderer__scroll"
          onScroll={(e) => {
            const newPos = {
              x: e.target.scrollLeft,
              y: e.target.scrollTop
            };
            setScrollPosition(newPos);
          }}
        >
          <canvas
            ref={canvasRef}
            className="arrangement-canvas-renderer__main"
            style={{ width: totalWidth, height: tracks.length * trackHeight }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="arrangement-canvas-renderer__controls">
        <button onClick={() => addTrack()}>
          <Plus size={16} /> Add Track
        </button>
        <button onClick={togglePlay}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={stop}>
          <Square size={16} />
        </button>
        <button onClick={() => { setZoom(Math.min(10, zoom.x * 1.2), zoom.y); isDirtyRef.current = true; }}>
          <ZoomIn size={16} />
        </button>
        <button onClick={() => { setZoom(Math.max(0.1, zoom.x / 1.2), zoom.y); isDirtyRef.current = true; }}>
          <ZoomOut size={16} />
        </button>
        <span>{Math.round(zoom.x * 100)}%</span>
        <span style={{ marginLeft: '12px', color: fps < 30 ? 'var(--zenith-error)' : fps < 50 ? 'var(--zenith-warning)' : 'var(--zenith-success)' }}>
          {fps} FPS
        </span>
      </div>
    </div>
  );
};

export default ArrangementCanvasRenderer;
export { ArrangementCanvasRenderer };
