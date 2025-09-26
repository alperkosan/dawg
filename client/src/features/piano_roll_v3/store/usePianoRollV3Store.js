/**
 * @file usePianoRollV3Store.js
 * @description Enhanced V3 Store - True infinite scroll, dynamic grid expansion
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// LOD seviyeleri
export const LOD_LEVELS = {
  ULTRA_SIMPLIFIED: 'ultra_simplified',
  SIMPLIFIED: 'simplified',
  NORMAL: 'normal',
  DETAILED: 'detailed',
  ULTRA_DETAILED: 'ultra_detailed'
};

// Viewport konfigürasyonu
export const VIEWPORT_CONFIG = {
  MIN_ZOOM_X: 0.05,
  MAX_ZOOM_X: 10.0,
  MIN_ZOOM_Y: 0.5,
  MAX_ZOOM_Y: 3.0,
  BASE_STEP_WIDTH: 32,
  BASE_KEY_HEIGHT: 18,
  VIRTUAL_PADDING: 200,
  SCROLL_DEBOUNCE: 16,
  CHUNK_SIZE: 256, // Grid chunk size for infinite scroll
  INITIAL_BARS: 64, // Start with 64 bars
  MAX_CACHED_CHUNKS: 10, // Memory optimization
};

const getLODFromZoom = (zoomX) => {
  if (zoomX < 0.25) return LOD_LEVELS.ULTRA_SIMPLIFIED;
  if (zoomX < 0.5) return LOD_LEVELS.SIMPLIFIED;
  if (zoomX < 1.5) return LOD_LEVELS.NORMAL;
  if (zoomX < 3.0) return LOD_LEVELS.DETAILED;
  return LOD_LEVELS.ULTRA_DETAILED;
};

export const usePianoRollV3Store = create(
  subscribeWithSelector((set, get) => ({
    // === VIEWPORT STATE ===
    viewport: {
      width: 0,
      height: 0,
      scrollX: 0,
      scrollY: 0,
      zoomX: 1.0,  // Başlangıç zoom %100
      zoomY: 1.0,  // Başlangıç zoom %100
      maxScrollX: 0,
      maxScrollY: 0,
    },

    // === VIRTUALIZATION STATE ===
    virtualization: {
      visibleStartX: 0,
      visibleEndX: 1000,
      visibleStartY: 0,
      visibleEndY: 108,
      renderPadding: VIEWPORT_CONFIG.VIRTUAL_PADDING,
      loadedChunks: new Set(), // Track loaded grid chunks
      chunkCache: new Map(), // Cache rendered chunks
    },

    // === GRID CONFIGURATION ===
    grid: {
      dynamicBars: VIEWPORT_CONFIG.INITIAL_BARS, // Dynamic expansion
      totalKeys: 108,
      stepWidth: VIEWPORT_CONFIG.BASE_STEP_WIDTH,
      keyHeight: VIEWPORT_CONFIG.BASE_KEY_HEIGHT,
      snapMode: 16,
      gridExpansionThreshold: 0.8, // Expand when 80% scrolled
    },

    // === NOTES DATA ===
    notes: {
      byId: {}, // Note storage by ID
      byPosition: new Map(), // Spatial index for fast lookup
      selectedIds: new Set(),
      clipboard: [],
      undoStack: [],
      redoStack: [],
    },

    // === UI STATE ===
    ui: {
      showVelocityLane: false,
      velocityLaneHeight: 120,
      selectedTool: 'select',
      isPlaying: false,
      currentStep: 0,
      ghostNote: null, // Preview note while drawing
      selectionBox: null, // Selection rectangle
      isDragging: false,
      dragStartPos: null,
    },

    // === PERFORMANCE STATE ===
    performance: {
      lodLevel: LOD_LEVELS.NORMAL,
      renderVersion: 0,
      isScrolling: false,
      lastScrollTime: 0,
      frameRate: 60,
      lastFrameTime: 0,
      renderStats: {
        visibleNotes: 0,
        totalNotes: 0,
        gridLines: 0,
        renderTime: 0,
      },
    },

    // === ACTIONS ===

    // Dynamic grid expansion for infinite scroll
    expandGridIfNeeded: () => {
      const { viewport, grid } = get();
      const currentMaxX = grid.dynamicBars * 64 * grid.stepWidth;
      const scrollProgress = viewport.scrollX / currentMaxX;

      if (scrollProgress > grid.gridExpansionThreshold) {
        // Double the grid size
        set(state => ({
          grid: {
            ...state.grid,
            dynamicBars: state.grid.dynamicBars * 2
          }
        }));
        console.log(`📏 Grid expanded to ${get().grid.dynamicBars} bars`);
      }
    },

    // Viewport updates
    setViewportSize: (width, height) => {
      set(state => ({
        viewport: { 
          ...state.viewport, 
          width, 
          height,
          maxScrollX: state.grid.dynamicBars * 64 * state.grid.stepWidth - width,
          maxScrollY: state.grid.totalKeys * state.grid.keyHeight - height,
        }
      }));
      get().updateVirtualization();
    },

    setScroll: (scrollX, scrollY) => {
      const now = performance.now();
      const { expandGridIfNeeded } = get();
      
      set(state => ({
        viewport: { 
          ...state.viewport, 
          scrollX: Math.max(0, scrollX), 
          scrollY: Math.max(0, scrollY) 
        },
        performance: {
          ...state.performance,
          isScrolling: true,
          lastScrollTime: now,
        }
      }));
      
      expandGridIfNeeded();
      get().updateVirtualization();
      get().loadVisibleChunks();

      // Debounce scroll end detection
      clearTimeout(get().scrollEndTimer);
      get().scrollEndTimer = setTimeout(() => {
        set(state => ({
          performance: { ...state.performance, isScrolling: false }
        }));
      }, 150);
    },

    setZoom: (zoomX, zoomY = null) => {
      const clampedZoomX = Math.max(
        VIEWPORT_CONFIG.MIN_ZOOM_X,
        Math.min(VIEWPORT_CONFIG.MAX_ZOOM_X, zoomX)
      );

      let clampedZoomY = get().viewport.zoomY;
      if (zoomY !== null) {
        clampedZoomY = Math.max(
          VIEWPORT_CONFIG.MIN_ZOOM_Y,
          Math.min(VIEWPORT_CONFIG.MAX_ZOOM_Y, zoomY)
        );
      }

      const newLOD = getLODFromZoom(clampedZoomX);
      const stepWidth = VIEWPORT_CONFIG.BASE_STEP_WIDTH * clampedZoomX;
      const keyHeight = VIEWPORT_CONFIG.BASE_KEY_HEIGHT * clampedZoomY;

      set(state => ({
        viewport: {
          ...state.viewport,
          zoomX: clampedZoomX,
          zoomY: clampedZoomY,
        },
        grid: {
          ...state.grid,
          stepWidth,
          keyHeight,
        },
        performance: {
          ...state.performance,
          lodLevel: newLOD,
          renderVersion: state.performance.renderVersion + 1,
        }
      }));

      get().updateVirtualization();
      get().clearChunkCache(); // Clear cache on zoom change
    },

    // Virtualization hesaplamaları - FIXED
    updateVirtualization: () => {
      const { viewport, grid, virtualization } = get();

      // Add safety checks
      if (!viewport.width || !viewport.height) {
        console.warn('Viewport not initialized');
        return;
      }

      // Calculate visible range with padding
      const padding = virtualization.renderPadding || 200;
      
      const startX = Math.max(0, 
        Math.floor((viewport.scrollX - padding) / grid.stepWidth)
      );
      const endX = Math.min(
        grid.dynamicBars * 64,
        Math.ceil((viewport.scrollX + viewport.width + padding) / grid.stepWidth)
      );

      const startY = Math.max(0,
        Math.floor((viewport.scrollY - padding) / grid.keyHeight)
      );
      const endY = Math.min(
        grid.totalKeys,
        Math.ceil((viewport.scrollY + viewport.height + padding) / grid.keyHeight)
      );

      // Ensure we have a valid range
      if (endX <= startX || endY <= startY) {
        console.warn('Invalid virtualization range:', { startX, endX, startY, endY });
        return;
      }

      set(state => ({
        virtualization: {
          ...state.virtualization,
          visibleStartX: startX,
          visibleEndX: endX,
          visibleStartY: startY,
          visibleEndY: endY,
        }
      }));
    },

    // Chunk-based loading for infinite scroll
    loadVisibleChunks: () => {
      const { virtualization } = get();
      const chunkSize = VIEWPORT_CONFIG.CHUNK_SIZE;
      
      const startChunk = Math.floor(virtualization.visibleStartX / chunkSize);
      const endChunk = Math.ceil(virtualization.visibleEndX / chunkSize);
      
      const newChunks = new Set();
      for (let i = startChunk; i <= endChunk; i++) {
        newChunks.add(i);
        if (!virtualization.loadedChunks.has(i)) {
          get().loadChunk(i);
        }
      }

      // Unload distant chunks to save memory
      const chunksToUnload = [...virtualization.loadedChunks].filter(
        chunk => chunk < startChunk - 2 || chunk > endChunk + 2
      );
      
      chunksToUnload.forEach(chunk => get().unloadChunk(chunk));
    },

    loadChunk: (chunkIndex) => {
      // Simulate loading chunk data (in real app, this could be from server)
      set(state => ({
        virtualization: {
          ...state.virtualization,
          loadedChunks: new Set([...state.virtualization.loadedChunks, chunkIndex])
        }
      }));
    },

    unloadChunk: (chunkIndex) => {
      set(state => {
        const newLoadedChunks = new Set(state.virtualization.loadedChunks);
        newLoadedChunks.delete(chunkIndex);
        state.virtualization.chunkCache.delete(chunkIndex);
        
        return {
          virtualization: {
            ...state.virtualization,
            loadedChunks: newLoadedChunks
          }
        };
      });
    },

    clearChunkCache: () => {
      set(state => ({
        virtualization: {
          ...state.virtualization,
          chunkCache: new Map()
        }
      }));
    },

    // === NOTE MANAGEMENT ===
    addNote: (note) => {
      const id = `note-${Date.now()}-${Math.random()}`;
      const newNote = { id, ...note };
      const posKey = `${note.step}-${note.key}`;

      set(state => ({
        notes: {
          ...state.notes,
          byId: { ...state.notes.byId, [id]: newNote },
          byPosition: new Map(state.notes.byPosition).set(posKey, id),
        },
        performance: {
          ...state.performance,
          renderStats: {
            ...state.performance.renderStats,
            totalNotes: Object.keys(state.notes.byId).length + 1,
          }
        }
      }));

      get().addToUndoStack({ type: 'add', note: newNote });
      return id;
    },

    updateNote: (id, updates) => {
      const note = get().notes.byId[id];
      if (!note) return;

      const oldPosKey = `${note.step}-${note.key}`;
      const newNote = { ...note, ...updates };
      const newPosKey = `${newNote.step}-${newNote.key}`;

      set(state => {
        const newByPosition = new Map(state.notes.byPosition);
        if (oldPosKey !== newPosKey) {
          newByPosition.delete(oldPosKey);
          newByPosition.set(newPosKey, id);
        }

        return {
          notes: {
            ...state.notes,
            byId: { ...state.notes.byId, [id]: newNote },
            byPosition: newByPosition,
          }
        };
      });

      get().addToUndoStack({ type: 'update', note: newNote, oldNote: note });
    },

    deleteNote: (id) => {
      const note = get().notes.byId[id];
      if (!note) return;

      const posKey = `${note.step}-${note.key}`;

      set(state => {
        const newById = { ...state.notes.byId };
        delete newById[id];
        
        const newByPosition = new Map(state.notes.byPosition);
        newByPosition.delete(posKey);

        return {
          notes: {
            ...state.notes,
            byId: newById,
            byPosition: newByPosition,
            selectedIds: new Set([...state.notes.selectedIds].filter(sid => sid !== id)),
          },
          performance: {
            ...state.performance,
            renderStats: {
              ...state.performance.renderStats,
              totalNotes: Object.keys(newById).length,
            }
          }
        };
      });

      get().addToUndoStack({ type: 'delete', note });
    },

    selectNote: (id, multiSelect = false) => {
      set(state => ({
        notes: {
          ...state.notes,
          selectedIds: multiSelect 
            ? new Set([...state.notes.selectedIds, id])
            : new Set([id])
        }
      }));
    },

    deselectNote: (id) => {
      set(state => ({
        notes: {
          ...state.notes,
          selectedIds: new Set([...state.notes.selectedIds].filter(sid => sid !== id))
        }
      }));
    },

    clearSelection: () => {
      set(state => ({
        notes: {
          ...state.notes,
          selectedIds: new Set()
        }
      }));
    },

    // Get notes in visible range (for rendering)
    getVisibleNotes: () => {
      const { notes, virtualization } = get();
      const visible = [];
      
      for (let step = virtualization.visibleStartX; step <= virtualization.visibleEndX; step++) {
        for (let key = virtualization.visibleStartY; key <= virtualization.visibleEndY; key++) {
          const posKey = `${step}-${key}`;
          const noteId = notes.byPosition.get(posKey);
          if (noteId && notes.byId[noteId]) {
            visible.push(notes.byId[noteId]);
          }
        }
      }

      // Update stats
      set(state => ({
        performance: {
          ...state.performance,
          renderStats: {
            ...state.performance.renderStats,
            visibleNotes: visible.length,
          }
        }
      }));

      return visible;
    },

    // === UI INTERACTIONS ===
    setGhostNote: (ghostNote) => {
      set(state => ({
        ui: { ...state.ui, ghostNote }
      }));
    },

    setSelectionBox: (box) => {
      set(state => ({
        ui: { ...state.ui, selectionBox: box }
      }));
    },

    startDragging: (x, y) => {
      set(state => ({
        ui: { 
          ...state.ui, 
          isDragging: true,
          dragStartPos: { x, y }
        }
      }));
    },

    stopDragging: () => {
      set(state => ({
        ui: { 
          ...state.ui, 
          isDragging: false,
          dragStartPos: null,
          selectionBox: null
        }
      }));
    },

    // === UNDO/REDO ===
    addToUndoStack: (action) => {
      set(state => ({
        notes: {
          ...state.notes,
          undoStack: [...state.notes.undoStack.slice(-49), action], // Keep last 50
          redoStack: [] // Clear redo on new action
        }
      }));
    },

    undo: () => {
      const { undoStack } = get().notes;
      if (undoStack.length === 0) return;

      const action = undoStack[undoStack.length - 1];
      
      // Implement undo logic based on action type
      switch(action.type) {
        case 'add':
          get().deleteNote(action.note.id);
          break;
        case 'delete':
          get().addNote(action.note);
          break;
        case 'update':
          get().updateNote(action.note.id, action.oldNote);
          break;
      }

      set(state => ({
        notes: {
          ...state.notes,
          undoStack: state.notes.undoStack.slice(0, -1),
          redoStack: [...state.notes.redoStack, action]
        }
      }));
    },

    redo: () => {
      const { redoStack } = get().notes;
      if (redoStack.length === 0) return;

      const action = redoStack[redoStack.length - 1];
      
      // Implement redo logic
      switch(action.type) {
        case 'add':
          get().addNote(action.note);
          break;
        case 'delete':
          get().deleteNote(action.note.id);
          break;
        case 'update':
          get().updateNote(action.note.id, action.note);
          break;
      }

      set(state => ({
        notes: {
          ...state.notes,
          redoStack: state.notes.redoStack.slice(0, -1),
          undoStack: [...state.notes.undoStack, action]
        }
      }));
    },

    // === UTILITIES ===
    scrollEndTimer: null,
    
    zoomIn: () => {
      const currentZoom = get().viewport.zoomX;
      get().setZoom(currentZoom * 1.25);
    },

    zoomOut: () => {
      const currentZoom = get().viewport.zoomX;
      get().setZoom(currentZoom / 1.25);
    },

    setTool: (tool) => {
      set(state => ({
        ui: { ...state.ui, selectedTool: tool }
      }))
    },

    // === GETTERS ===
    getVisibleRange: () => {
      const { virtualization } = get();
      return {
        startX: virtualization.visibleStartX,
        endX: virtualization.visibleEndX,
        startY: virtualization.visibleStartY,
        endY: virtualization.visibleEndY,
      };
    },

    getCurrentLOD: () => get().performance.lodLevel,

    getTotalGridSize: () => {
      const { grid } = get();
      return {
        width: grid.dynamicBars * 64 * grid.stepWidth,
        height: grid.totalKeys * grid.keyHeight,
      };
    },

    getPerformanceStats: () => get().performance.renderStats,
  }))
);