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
import { usePanelsStore } from '@/store/usePanelsStore';
import { useArrangementEngine } from './hooks/useArrangementEngine';
import { usePatternInteraction } from './hooks/usePatternInteraction';
import { drawArrangement } from './renderers/arrangementRenderer';
import { TrackHeaderOverlay } from './components/TrackHeaderOverlay';
import { Plus, Play, Pause, Square, ZoomIn, ZoomOut } from 'lucide-react';
import { audioAssetManager } from '@/lib/audio/AudioAssetManager';

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
    updateClipInstance,
    addClip,
    deleteClip,
    selectClips,
    toggleTrackMute,
    toggleTrackSolo,
    zoom: zoomFromStore,
    makeClipUnique,
    getInstanceClipCount,
    audioInstances
  } = useArrangementWorkspaceStore();

  const { patterns } = useArrangementStore();
  const { instruments, handleAddNewInstrument } = useInstrumentsStore();
  const { togglePanel, setEditorBuffer, setEditorClipData } = usePanelsStore();

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
  const [marqueeSelection, setMarqueeSelection] = useState(null); // Marquee selection box { startX, startY, currentX, currentY }
  const [isRightClickDelete, setIsRightClickDelete] = useState(false); // Right-click delete mode
  const [deletedClipsInSession, setDeletedClipsInSession] = useState(new Set()); // Track deleted clips during right-click drag
  const [lastDuplicateAction, setLastDuplicateAction] = useState(null); // Track last Ctrl+B action for sequential duplication

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

  // Subscribe to audio asset loading events for auto-refresh and duration update
  useEffect(() => {
    const unsubscribe = audioAssetManager.subscribe((assetId, buffer) => {
      console.log('🎨 Audio asset loaded, updating clip duration:', assetId);

      // Find clips using this asset and update their duration
      const audioClips = clips.filter(clip => clip.assetId === assetId);
      audioClips.forEach(clip => {
        // Calculate duration in beats (assuming 140 BPM)
        const BPM = 140;
        const beatsPerSecond = BPM / 60;
        const durationInBeats = buffer.duration * beatsPerSecond;

        // Update clip duration
        updateClip(clip.id, { duration: durationInBeats });
      });

      // Force canvas re-render
      engine.render?.();
    });

    return unsubscribe;
  }, [engine, clips, updateClip]);

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

      // Ctrl+B / Cmd+B - Sequential duplication with memory
      if ((e.metaKey || e.ctrlKey) && e.key === 'b' && selectedClips.length > 0) {
        e.preventDefault();

        // Grid size to beat conversion
        const gridSizeMap = {
          '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125
        };
        const gridInterval = gridSizeMap[gridSize] || 1;

        // Check if this is a continuation of previous Ctrl+B
        const selectedClipObjects = selectedClips.map(id => clips.find(c => c.id === id)).filter(Boolean);
        let clipTemplate = null;
        let baseTime = 0;

        if (lastDuplicateAction &&
            lastDuplicateAction.newClipIds.length === selectedClips.length &&
            lastDuplicateAction.newClipIds.every(id => selectedClips.includes(id))) {
          // Continuing sequential duplication - use saved clip template
          clipTemplate = lastDuplicateAction.clipTemplate;
          baseTime = lastDuplicateAction.lastEndTime;
        } else {
          // New duplication sequence - create clip template from selected clips
          // Find the clip that ends last (startTime + duration)
          const lastEndingClip = selectedClipObjects.reduce((max, clip) => {
            const clipEnd = clip.startTime + clip.duration;
            const maxEnd = max.startTime + max.duration;
            return clipEnd > maxEnd ? clip : max;
          }, selectedClipObjects[0]);

          baseTime = lastEndingClip.startTime + lastEndingClip.duration;

          // Create clip template (pure data, no IDs but preserve instanceId for sharing)
          const firstClipTime = selectedClipObjects[0].startTime;
          clipTemplate = selectedClipObjects.map(clip => ({
            offsetTime: clip.startTime - firstClipTime,
            clipData: {
              type: clip.type,
              patternId: clip.patternId,
              sampleId: clip.sampleId,
              assetId: clip.assetId,
              audioUrl: clip.audioUrl,
              instanceId: clip.instanceId, // Preserve instance for shared properties
              trackId: clip.trackId,
              duration: clip.duration,
              name: clip.name,
              color: clip.color
            }
          }));
        }

        // Place directly after the end of the last clip (no grid snapping for tighter placement)
        const targetTime = baseTime;

        const newClipIds = [];
        let maxEndTime = targetTime;

        clipTemplate.forEach(template => {
          // Create new clip from template
          const newClipId = addClip({
            ...template.clipData,
            startTime: targetTime + template.offsetTime,
            id: undefined // Let store generate new ID
          });

          if (newClipId) {
            newClipIds.push(newClipId);
            // Track the end time of the last clip in this duplication
            const clipEnd = targetTime + template.offsetTime + template.clipData.duration;
            if (clipEnd > maxEndTime) {
              maxEndTime = clipEnd;
            }
          }
        });

        // Save duplication memory with clip template (no clip references)
        setLastDuplicateAction({
          clipTemplate: clipTemplate,
          newClipIds: newClipIds,
          lastEndTime: maxEndTime  // Save end time for next sequential duplication
        });

        // Select the newly created clips for next duplication
        if (newClipIds.length > 0) {
          setSelectedClips(newClipIds);
        }
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
  }, [selectedClips, clips, addClip, deleteClip, gridSize, lastDuplicateAction]);

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
      audioInstances, // Shared audio instance properties
      playhead: {
        // Only show playhead position in song mode
        position: playbackMode === 'song' ? currentStep : 0,
        isPlaying: playbackMode === 'song' && isPlaying
      },
      patternInteraction: patternInteraction.interactionState,
      dropPreview,
      marqueeSelection,
      isRightClickDelete
    };

    drawArrangement(ctx, engineWithData);
  }, [engine, gridSize, tracks, clips, selectedClips, patterns, instruments, audioInstances, currentStep, isPlaying, playbackMode, patternInteraction.interactionState, dropPreview, marqueeSelection, isRightClickDelete]);

  // Mouse handlers for pattern interaction
  const handleCanvasMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const TRACK_HEADER_WIDTH = 150;
    const TIMELINE_HEIGHT = 40;
    const PIXELS_PER_BEAT = 32;

    // Right-click - delete mode
    if (e.button === 2) {
      e.stopPropagation();
      setIsRightClickDelete(true);
      setDeletedClipsInSession(new Set());

      // Check if we're over a clip and delete it immediately
      const worldX = mouseX + engine.viewport.scrollX;
      const worldY = mouseY + engine.viewport.scrollY;
      const clickedClip = patternInteraction.getClipAtPosition(worldX, worldY);

      if (clickedClip) {
        deleteClip(clickedClip.id);
        setDeletedClipsInSession(new Set([clickedClip.id]));
      }
      return;
    }

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

      // Reset duplicate memory when interacting with clips
      setLastDuplicateAction(null);

      if (e.shiftKey) {
        setSelectedClips(prev => [...prev, interaction.clip.id]);
      } else {
        setSelectedClips([interaction.clip.id]);
      }
      setIsDragging(true);
    } else {
      // Empty area clicked - start marquee selection
      e.stopPropagation();

      // Calculate world position relative to canvas area (excluding headers)
      const canvasX = mouseX - TRACK_HEADER_WIDTH;
      const canvasY = mouseY - TIMELINE_HEIGHT;
      const worldX = canvasX + engine.viewport.scrollX;
      const worldY = canvasY + engine.viewport.scrollY;

      setMarqueeSelection({
        startX: worldX,
        startY: worldY,
        currentX: worldX,
        currentY: worldY
      });

      setSelectedClips([]);
      setIsDragging(false);
    }
  }, [patternInteraction, engine.viewport, setTransportPosition, deleteClip]);

  const handleCanvasMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const TRACK_HEADER_WIDTH = 150;
    const TIMELINE_HEIGHT = 40;
    const PIXELS_PER_BEAT = 32;

    // Right-click delete mode - delete clips as we hover over them
    if (isRightClickDelete) {
      e.stopPropagation();

      const worldX = mouseX + engine.viewport.scrollX;
      const worldY = mouseY + engine.viewport.scrollY;
      const hoveredClip = patternInteraction.getClipAtPosition(worldX, worldY);

      if (hoveredClip && !deletedClipsInSession.has(hoveredClip.id)) {
        deleteClip(hoveredClip.id);
        setDeletedClipsInSession(prev => new Set([...prev, hoveredClip.id]));
      }

      // Set cursor to indicate delete mode
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'not-allowed';
      }
      return;
    }

    // Marquee selection
    if (marqueeSelection) {
      e.stopPropagation();

      // Calculate world position relative to canvas area (excluding headers)
      const canvasX = mouseX - TRACK_HEADER_WIDTH;
      const canvasY = mouseY - TIMELINE_HEIGHT;
      const worldX = canvasX + engine.viewport.scrollX;
      const worldY = canvasY + engine.viewport.scrollY;

      setMarqueeSelection(prev => ({
        ...prev,
        currentX: worldX,
        currentY: worldY
      }));

      // Calculate which clips are inside marquee
      const minX = Math.min(marqueeSelection.startX, worldX);
      const maxX = Math.max(marqueeSelection.startX, worldX);
      const minY = Math.min(marqueeSelection.startY, worldY);
      const maxY = Math.max(marqueeSelection.startY, worldY);

      const selectedClipIds = clips.filter(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        if (!track) return false;

        const trackIndex = tracks.indexOf(track);
        const clipX = (clip.startTime * PIXELS_PER_BEAT * engine.viewport.zoomX);
        const clipY = (trackIndex * engine.dimensions.trackHeight);
        const clipWidth = (clip.duration * PIXELS_PER_BEAT * engine.viewport.zoomX);
        const clipHeight = engine.dimensions.trackHeight;

        // Check if clip intersects with marquee
        return !(clipX + clipWidth < minX || clipX > maxX || clipY + clipHeight < minY || clipY > maxY);
      }).map(clip => clip.id);

      setSelectedClips(selectedClipIds);
      return;
    }

    if (!isDragging) {
      // Sadece cursor güncelle
      const worldX = mouseX + engine.viewport.scrollX;
      const worldY = mouseY + engine.viewport.scrollY;

      const cursor = patternInteraction.getCursorStyle(worldX, worldY);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = cursor;
      }
      return;
    }

    // Clip interaction in progress - prevent canvas panning
    e.stopPropagation();
    patternInteraction.handleMouseMove(e, rect);
  }, [isDragging, patternInteraction, engine.viewport, isRightClickDelete, deletedClipsInSession, deleteClip, marqueeSelection, clips, tracks, engine.dimensions.trackHeight]);

  const handleCanvasMouseUp = useCallback((e) => {
    // Right-click delete mode - exit
    if (isRightClickDelete) {
      setIsRightClickDelete(false);
      setDeletedClipsInSession(new Set());
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'default';
      }
      return;
    }

    // Marquee selection - finalize
    if (marqueeSelection) {
      setMarqueeSelection(null);
      return;
    }

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
        // Regular clip update
        updateClip(result.clip.id, result.updates);
      }
    }

    setIsDragging(false);
    setDraggedClip(null);
  }, [isDragging, patternInteraction, updateClip, addClip, patterns, isRightClickDelete, marqueeSelection]);

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
        // File browser sample drop - use AudioAssetManager for centralized loading
        const assetId = audioAssetManager.generateAssetId(data.url);

        // Always try to load asset (returns immediately if cached)
        // Note: Duration update is handled by the useEffect subscription to audioAssetManager
        audioAssetManager.loadAsset(data.url, {
          name: data.name,
          source: 'file-browser',
          type: 'audio'
        }).catch(error => {
          console.error('Failed to load audio asset:', error);
        });

        // Check if already cached to set correct initial duration
        const existingAsset = audioAssetManager.getAsset(assetId);
        let initialDuration = 4;

        if (existingAsset?.buffer) {
          const BPM = 140;
          const beatsPerSecond = BPM / 60;
          initialDuration = existingAsset.buffer.duration * beatsPerSecond;
        }

        // Create clip
        const newClipId = addClip({
          type: 'audio',
          assetId, // Use centralized asset ID
          audioUrl: data.url,
          trackId,
          startTime: snappedBeat,
          duration: initialDuration,
          name: data.name,
          color: '#f59e0b',
          fadeIn: 0, // No fade by default
          fadeOut: 0, // No fade by default
          gain: 0 // 0 dB gain
        });

        console.log(`🎵 Dropped file browser sample "${data.name}" on track ${trackIndex + 1} at beat ${snappedBeat.toFixed(2)}`);

        if (newClipId) {
          selectClips([newClipId], false);
        }
      }
    } catch (error) {
      console.error('Failed to handle drop:', error);
    }
  }, [engine, ensureTrackAtIndex, addClip, patterns, patternInteraction, selectClips]);

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

  // ✅ Double-click handler - open audio clips in sample editor
  const handleCanvasDoubleClick = useCallback(async (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickedClip = patternInteraction.handleDoubleClick(e, rect);

    if (!clickedClip) return;

    // Only handle audio clips (frozen patterns or audio samples)
    if (clickedClip.type !== 'audio') {
      console.log('🎵 Double-clicked non-audio clip, ignoring');
      return;
    }

    console.log('🎵 Opening audio clip in Sample Editor:', clickedClip);

    // Get audio buffer from asset manager
    let audioBuffer = null;

    if (clickedClip.assetId) {
      const asset = audioAssetManager.getAsset(clickedClip.assetId);
      audioBuffer = asset?.buffer;
    } else if (clickedClip.sampleId) {
      // Legacy: Find instrument with this sample
      const instrument = instruments.find(inst => inst.id === clickedClip.sampleId);
      if (instrument?.buffer) {
        audioBuffer = instrument.buffer;
      }
    }

    if (!audioBuffer) {
      console.warn('🎵 No audio buffer found for clip:', clickedClip);
      return;
    }

    // Set buffer and clip metadata for sample editor
    setEditorBuffer(audioBuffer);
    setEditorClipData({
      id: clickedClip.id,
      name: clickedClip.name || 'Audio Clip',
      color: clickedClip.color || '#f59e0b',
      duration: clickedClip.duration,
      startTime: clickedClip.startTime,
      type: 'audio-clip' // Flag to indicate this is from arrangement, not an instrument
    });

    // Open sample editor panel
    const { panels } = usePanelsStore.getState();
    if (!panels['sample-editor']?.isOpen) {
      togglePanel('sample-editor');
    }

    console.log('🎵 Sample editor opened with audio clip:', clickedClip.name, audioBuffer.duration.toFixed(2), 's');
  }, [patternInteraction, instruments, setEditorBuffer, setEditorClipData, togglePanel]);

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
          onDoubleClick={handleCanvasDoubleClick}
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
                clip: clickedClip
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
              {/* Make Unique - only show for shared audio instances */}
              {contextMenu.clip?.instanceId && getInstanceClipCount(contextMenu.clip.instanceId) > 1 && (
                <div
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: '#4ecdc4',
                    fontSize: '13px',
                    borderRadius: '2px',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#3a3a3a'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={(e) => {
                    e.stopPropagation();
                    makeClipUnique(contextMenu.clip.id);
                    setContextMenu(null);
                  }}
                >
                  Make Unique
                </div>
              )}

              {/* Delete */}
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
                  deleteClip(contextMenu.clip.id);
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
