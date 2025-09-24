// Infinite Grid Engine - Mühendislik Harikası Canvas Sistemi
// Ultra performanslı, sonsuz scroll, dinamik loading

export class InfiniteGridEngine {
    constructor(options = {}) {
        this.options = {
            cellWidth: 12,        // FL Studio compact: 1/16 note = 12px
            cellHeight: 12,       // FL Studio compact: 1 semitone = 12px
            bufferSize: 200,      // Pixels to render beyond viewport
            chunkSize: 4,         // Time range per chunk (in beats)
            maxZoom: 16,          // FL Studio ultra zoom
            minZoom: 0.01,        // FL Studio: 10 oktav gözükene kadar zoom out
            // FL Studio specific
            maxVisibleBars: 562,  // Maximum bar visibility
            totalOctaves: 10,     // 10 octave piano roll
            autoGridLOD: true,    // Automatic grid level of detail
            ...options
        };

        // FL Studio dynamic grid system
        this.snapMode = '1/16';

        // FL Studio grid levels based on zoom - MUST BE DEFINED BEFORE calculateGridLOD
        this.gridLevels = [
            { zoom: [8, 16], grid: '1/64', majorLine: 4, label: '1/64' },
            { zoom: [4, 8], grid: '1/32', majorLine: 4, label: '1/32' },
            { zoom: [2, 4], grid: '1/16', majorLine: 4, label: '1/16' },
            { zoom: [1, 2], grid: '1/8', majorLine: 4, label: '1/8' },
            { zoom: [0.5, 1], grid: '1/4', majorLine: 4, label: 'Beat' },
            { zoom: [0.25, 0.5], grid: '1', majorLine: 4, label: 'Bar' },
            { zoom: [0.1, 0.25], grid: '4', majorLine: 4, label: '4 Bars' },
            { zoom: [0.05, 0.1], grid: '8', majorLine: 8, label: '8 Bars' },
            { zoom: [0.01, 0.05], grid: '16', majorLine: 16, label: '16 Bars' }
        ];

        this.snapModes = {
            '1/64': { subdivisions: 64, pixels: this.options.cellWidth / 4 },
            '1/32': { subdivisions: 32, pixels: this.options.cellWidth / 2 },
            '1/16': { subdivisions: 16, pixels: this.options.cellWidth },
            '1/8': { subdivisions: 8, pixels: this.options.cellWidth * 2 },
            '1/4': { subdivisions: 4, pixels: this.options.cellWidth * 4 },
            '1': { subdivisions: 1, pixels: this.options.cellWidth * 16 },
            '4': { subdivisions: 0.25, pixels: this.options.cellWidth * 64 },
            '8': { subdivisions: 0.125, pixels: this.options.cellWidth * 128 },
            '16': { subdivisions: 0.0625, pixels: this.options.cellWidth * 256 }
        };

        // Initialize grid LOD after gridLevels is defined
        this.gridLOD = this.calculateGridLOD(1); // Default zoom = 1

        // Canvas layers for different elements
        this.layers = {
            background: null,     // Grid background
            notes: null,          // Note rectangles
            playhead: null,       // Playhead overlay
            selection: null,      // Selection overlay
            ui: null             // UI elements (rulers, etc)
        };

        // FL Studio viewport with keyboard visibility tracking
        this.viewport = {
            x: 0, y: 0,          // Top-left position
            width: 1200,         // Viewport width
            height: 800,         // Viewport height
            zoom: 1,             // Current zoom level
            // FL Studio specific
            visibleOctaves: 5,   // Currently visible octaves
            keyboardScrollY: 0,  // Vertical scroll for keyboard
            maxScrollX: 562 * 4 * this.options.cellWidth * 16, // 562 bars limit
            autoScroll: true,    // Auto-scroll during playback
            smoothScroll: true   // Smooth scrolling animation
        };

        // FL Studio world bounds - 10 octaves, 562 bars
        this.world = {
            minX: 0,             // Timeline starts at 0
            maxX: 562 * 4 * this.options.cellWidth * 16, // 562 bars max
            minY: 0,             // C0 (MIDI 12)
            maxY: 120 * this.options.cellHeight, // 10 octaves (120 semitones)
            chunks: new Map(),   // Loaded data chunks
            activeChunks: new Set(), // Currently visible chunks
            // FL Studio optimization
            visibleBars: 10,     // Currently visible bar count
            gridDensity: 16      // Current grid line density
        };

        // Performance tracking
        this.performance = {
            fps: 0,
            renderTime: 0,
            lastFrame: performance.now(),
            frameCount: 0
        };

        // Drag & Drop system
        this.dragDrop = {
            isDragging: false,
            draggedNote: null,
            dragStartPos: { x: 0, y: 0 },
            dragCurrentPos: { x: 0, y: 0 },
            selectedNotes: new Set(),
            dragOffset: { x: 0, y: 0 },
            // Resize system
            isResizing: false,
            resizeNote: null,
            resizeStartWidth: 0
        };

        // Mouse mode system
        this.mouseMode = 'select'; // select, write, delete, slice

        // Playhead system for audio playback visualization
        this.playhead = {
            position: 0,        // Current playback position in beats
            isPlaying: false,   // Is audio currently playing
            startTime: 0,       // When playback started (timestamp)
            bpm: 120           // Beats per minute
        };

        this.isInitialized = false;
        this.animationId = null;
    }

    // Initialize canvas layers
    init(container) {
        this.container = container;
        this.createCanvasLayers();
        this.setupEventListeners();
        this.startRenderLoop();
        this.isInitialized = true;

        // Force initial chunk loading and render
        console.log('🎨 Infinite Grid Engine initialized, loading initial chunks...');
        this.updateVisibleChunks();
        this.invalidateAll();

        // Debug: Force render first frame and check if notes are visible
        setTimeout(() => {
            console.log('🎨 Force rendering first frame');
            this.renderFrame();

            // Debug: Check if any chunks have notes
            let totalNotes = 0;
            this.world.chunks.forEach((chunk, chunkId) => {
                totalNotes += chunk.notes.length;
                console.log(`🔍 Chunk ${chunkId}: ${chunk.notes.length} notes, range: ${chunk.startTime}-${chunk.endTime}`);
            });

            if (totalNotes > 0) {
                console.log('🎯 Notes found! Checking rendering coordinates...');

                // Get first note and log its screen position
                const firstChunk = Array.from(this.world.chunks.values())[0];
                if (firstChunk && firstChunk.notes.length > 0) {
                    const note = firstChunk.notes[0];
                    const x = ((note.time * this.options.cellWidth) / 0.25 * this.viewport.zoom) - this.viewport.x;
                    const y = (note.pitch * this.options.cellHeight * this.viewport.zoom) - this.viewport.y;

                    console.log('🎯 First note rendering at:', { x, y, viewport: this.viewport, note });

                    // If note is far outside viewport, adjust viewport
                    if (x < -1000 || x > this.viewport.width + 1000) {
                        const targetViewportX = (note.time * this.options.cellWidth) / 0.25 * this.viewport.zoom;
                        this.viewport.x = targetViewportX - 100; // Show note 100px from left edge
                        console.log('🎯 Adjusting viewport to show notes:', { newX: this.viewport.x });
                        this.invalidateAll();
                    }
                }
            }
        }, 200);
    }

    createCanvasLayers() {
        const { width, height } = this.container.getBoundingClientRect();
        this.viewport.width = width;
        this.viewport.height = height;

        // Create multiple canvas layers for different elements
        const layerNames = ['background', 'notes', 'playhead', 'selection', 'ui'];

        layerNames.forEach((name, index) => {
            const canvas = document.createElement('canvas');
            canvas.width = width * window.devicePixelRatio;
            canvas.height = height * window.devicePixelRatio;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            canvas.style.position = 'absolute';
            canvas.style.zIndex = index * 10;

            const ctx = canvas.getContext('2d');
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

            this.layers[name] = { canvas, ctx };
            this.container.appendChild(canvas);
        });
    }

    // Advanced event handling for drag & drop + panning
    setupEventListeners() {
        let isPanning = false;
        let lastX = 0, lastY = 0;
        let mouseDownPos = { x: 0, y: 0 };
        let hasMoved = false;

        // Mouse wheel for zooming
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoomToPoint(mouseX, mouseY, zoomFactor);
        }, { passive: false });

        // Mouse down - check if clicking on note or empty space
        this.container.addEventListener('mousedown', (e) => {
            const rect = this.container.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const worldPos = this.screenToWorld(screenX, screenY);

            // Track mouse down position
            mouseDownPos = { x: e.clientX, y: e.clientY };
            hasMoved = false;

            // Check if clicking on a note with resize edge detection
            const noteHit = this.getNoteAtPosition(worldPos.worldX, worldPos.worldY, true);

            // Handle different mouse modes
            switch (this.mouseMode) {
                case 'select':
                    if (noteHit && noteHit.isOnResizeEdge) {
                        // Start note resizing
                        this.startNoteResize(noteHit.note, worldPos);
                    } else if (noteHit && !e.shiftKey) {
                        // Start note dragging (both horizontal and vertical)
                        this.startNoteDrag(noteHit.note, worldPos, e, true); // true = allow vertical drag
                    } else if (noteHit && e.shiftKey) {
                        // Multi-select notes
                        this.toggleNoteSelection(noteHit.note);
                    } else {
                        // Start panning
                        isPanning = true;
                        lastX = e.clientX;
                        lastY = e.clientY;
                        this.container.style.cursor = 'grabbing';
                    }
                    break;

                case 'write':
                    if (!noteHit || !noteHit.note) {
                        // Create new note - do nothing on mousedown, wait for mouseup
                        // Don't start panning in write mode for empty space
                    } else {
                        // Start panning if clicking on existing note
                        isPanning = true;
                        lastX = e.clientX;
                        lastY = e.clientY;
                        this.container.style.cursor = 'grabbing';
                    }
                    break;

                case 'delete':
                    if (noteHit && noteHit.note) {
                        // Delete note
                        if (this.onNoteDelete) {
                            this.onNoteDelete(noteHit.note);
                        }
                    }
                    break;

                case 'slice':
                    if (noteHit && noteHit.note) {
                        // Slice note at position
                        if (this.onNoteSlice) {
                            this.onNoteSlice(noteHit.note, worldPos.worldX);
                        }
                    }
                    break;

                default:
                    // Fallback to panning
                    isPanning = true;
                    lastX = e.clientX;
                    lastY = e.clientY;
                    this.container.style.cursor = 'grabbing';
            }
        });

        // Mouse move - handle dragging, resizing or panning
        this.container.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            // Check if mouse has moved significantly
            const mouseMoved = Math.abs(e.clientX - mouseDownPos.x) > 3 || Math.abs(e.clientY - mouseDownPos.y) > 3;
            if (mouseMoved) hasMoved = true;

            if (this.dragDrop.isDragging) {
                // Update note drag
                this.updateNoteDrag(screenX, screenY);
            } else if (this.dragDrop.isResizing) {
                // Update note resize
                this.updateNoteResize(screenX, screenY);
            } else if (isPanning) {
                // Handle panning
                const deltaX = e.clientX - lastX;
                const deltaY = e.clientY - lastY;
                this.pan(deltaX, deltaY);
                lastX = e.clientX;
                lastY = e.clientY;
            } else {
                // Update hover cursor based on mode and position
                const worldPos = this.screenToWorld(screenX, screenY);
                const noteHit = this.getNoteAtPosition(worldPos.worldX, worldPos.worldY, true);
                this.updateCursor(noteHit);
            }
        });

        // Mouse up - finish dragging, resizing or panning
        this.container.addEventListener('mouseup', (e) => {
            if (this.dragDrop.isDragging) {
                this.finishNoteDrag();
            } else if (this.dragDrop.isResizing) {
                this.finishNoteResize();
            } else if (isPanning) {
                isPanning = false;
                this.container.style.cursor = 'default';
            } else {
                // Handle mode-specific mouse up actions
                this.handleMouseUpForMode(e, hasMoved);
            }

            // Reset movement tracking
            hasMoved = false;
        });

        // Resize handling
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    // FL Studio: Zoom with intelligent limits
    zoomToPoint(mouseX, mouseY, zoomFactor) {
        const oldZoom = this.viewport.zoom;

        // FL Studio: Calculate keyboard visibility
        const keyboardRange = this.calculateKeyboardRange();
        const { cellHeight, totalOctaves } = this.options;

        // Calculate minimum zoom where all octaves are visible
        const minZoomForFullKeyboard = this.viewport.height / (totalOctaves * 12 * cellHeight);

        // FL Studio: Dynamic zoom limits based on content
        let effectiveMinZoom = this.options.minZoom;
        let effectiveMaxZoom = this.options.maxZoom;

        // Limit minimum zoom to show all keyboard
        if (!keyboardRange.canScroll) {
            effectiveMinZoom = Math.max(minZoomForFullKeyboard, this.options.minZoom);
        }

        const newZoom = Math.max(effectiveMinZoom,
                        Math.min(effectiveMaxZoom, oldZoom * zoomFactor));

        if (newZoom !== oldZoom) {
            // Calculate world position of mouse
            const worldX = (mouseX + this.viewport.x) / oldZoom;
            const worldY = (mouseY + this.viewport.y) / oldZoom;

            // Update zoom
            this.viewport.zoom = newZoom;

            // FL Studio: Update grid LOD
            this.gridLOD = this.calculateGridLOD(newZoom);

            // Recalculate viewport position to keep mouse point fixed
            this.viewport.x = worldX * newZoom - mouseX;
            this.viewport.y = worldY * newZoom - mouseY;

            // FL Studio: Constrain Y to keyboard bounds if all octaves visible
            if (newZoom <= minZoomForFullKeyboard) {
                this.viewport.y = 0; // Reset Y when all octaves visible
            } else {
                // Allow Y scrolling but limit to keyboard range
                const maxY = Math.max(0, (totalOctaves * 12 * cellHeight * newZoom) - this.viewport.height);
                this.viewport.y = Math.max(0, Math.min(maxY, this.viewport.y));
            }

            // FL Studio: Constrain X to max bars
            const maxX = this.world.maxX * newZoom - this.viewport.width;
            this.viewport.x = Math.max(0, Math.min(maxX, this.viewport.x));

            // Update keyboard scroll position
            this.viewport.keyboardScrollY = this.viewport.y;

            console.log(`🔍 FL Zoom: ${oldZoom.toFixed(3)} → ${newZoom.toFixed(3)}, Grid: ${this.gridLOD.label}, Visible bars: ${this.world.visibleBars}`);

            this.invalidateAll();
        }
    }

    // FL Studio: Pan with intelligent bounds
    pan(deltaX, deltaY) {
        const { cellHeight, totalOctaves } = this.options;
        const { zoom, height, width } = this.viewport;

        // Update viewport position
        const newX = this.viewport.x - deltaX;
        const newY = this.viewport.y - deltaY;

        // FL Studio: X bounds - 0 to 562 bars
        const maxX = Math.max(0, this.world.maxX - width);
        this.viewport.x = Math.max(0, Math.min(maxX, newX));

        // FL Studio: Y bounds based on keyboard visibility
        const keyboardRange = this.calculateKeyboardRange();

        if (keyboardRange.canScroll) {
            // Allow Y scrolling within keyboard bounds
            const totalHeight = totalOctaves * 12 * cellHeight * zoom;
            const maxY = Math.max(0, totalHeight - height);
            this.viewport.y = Math.max(0, Math.min(maxY, newY));
            this.viewport.keyboardScrollY = this.viewport.y;
        } else {
            // All octaves visible - no Y scroll
            this.viewport.y = 0;
            this.viewport.keyboardScrollY = 0;
        }

        // FL Studio: Update visible bar count
        const pixelsPerBar = this.options.cellWidth * 16 * zoom;
        this.world.visibleBars = Math.ceil(width / pixelsPerBar);

        // FL Studio: Auto-adjust grid LOD if needed
        if (this.options.autoGridLOD) {
            const newLOD = this.calculateGridLOD(zoom);
            if (newLOD !== this.gridLOD) {
                this.gridLOD = newLOD;
                console.log(`📊 FL: Grid LOD changed to ${newLOD.label}`);
            }
        }

        this.updateVisibleChunks();
        this.invalidateAll();
    }

    // Dynamic chunk loading system - time-based chunks
    updateVisibleChunks() {
        const chunkSizeBeats = this.options.chunkSize; // Chunk size in beats
        const bufferPixels = this.options.bufferSize;

        // Convert viewport pixels to time (beats)
        const snapConfig = this.snapModes['1/16'] || { pixels: 4 };
        const pixelsPerBeat = (snapConfig.pixels * 4) * this.viewport.zoom; // 16px per 1/16, 4 sixteenths per beat

        const viewportStartTime = this.viewport.x / pixelsPerBeat;
        const viewportEndTime = (this.viewport.x + this.viewport.width) / pixelsPerBeat;
        const bufferTime = bufferPixels / pixelsPerBeat;

        // Calculate visible chunk range in beats
        const startChunkIndex = Math.floor((viewportStartTime - bufferTime) / chunkSizeBeats);
        const endChunkIndex = Math.ceil((viewportEndTime + bufferTime) / chunkSizeBeats);

        const newActiveChunks = new Set();

        // Load visible chunks
        for (let chunkIndex = startChunkIndex; chunkIndex <= endChunkIndex; chunkIndex++) {
            const chunkId = `chunk_${chunkIndex}`;
            newActiveChunks.add(chunkId);

            if (!this.world.chunks.has(chunkId)) {
                this.loadTimeChunk(chunkIndex);
            }
        }

        // Unload distant chunks to save memory
        this.world.chunks.forEach((chunk, chunkId) => {
            if (!newActiveChunks.has(chunkId)) {
                this.unloadChunk(chunkId);
            }
        });

        this.world.activeChunks = newActiveChunks;
    }

    // Load time-based chunk data (notes in specific time range)
    loadTimeChunk(chunkIndex) {
        const chunkId = `chunk_${chunkIndex}`;
        const chunkSizeBeats = this.options.chunkSize;

        const startTime = Math.max(0, chunkIndex * chunkSizeBeats); // Don't go below 0
        const endTime = (chunkIndex + 1) * chunkSizeBeats;

        // Load notes in this time range
        const notes = this.getNotesInRange(startTime, endTime);

        const chunk = {
            startTime,
            endTime,
            notes,
            loaded: true
        };

        this.world.chunks.set(chunkId, chunk);
    }

    // Legacy method for backwards compatibility
    loadChunk(chunkIndex) {
        this.loadTimeChunk(chunkIndex);
    }

    // Unload distant chunk
    unloadChunk(chunkId) {
        this.world.chunks.delete(chunkId);
    }

    // Get notes in specific time range (connect to your data store)
    getNotesInRange(startTime, endTime) {
        // This will connect to your notes store
        // For now, return empty array
        return [];
    }

    // === DRAG & DROP METHODS ===

    // Find note at world position with resize edge detection
    getNoteAtPosition(worldX, worldY, checkResizeEdge = false) {
        const { cellWidth, cellHeight } = this.options;
        const resizeEdgeWidth = 8; // 8 pixels from right edge for resize detection

        // Check all active chunks for notes
        for (let chunkId of this.world.activeChunks) {
            const chunk = this.world.chunks.get(chunkId);
            if (!chunk || !chunk.loaded) continue;

            for (let note of chunk.notes) {
                // Convert time to world X (time * cellWidth / 0.25 because 0.25 = 16th note)
                const noteX = (note.time * cellWidth) / 0.25;
                const noteY = note.pitch * cellHeight;
                const noteW = ((note.duration || 0.25) * cellWidth) / 0.25;
                const noteH = cellHeight;

                // Check if world position is inside note bounds
                if (worldX >= noteX && worldX <= noteX + noteW &&
                    worldY >= noteY && worldY <= noteY + noteH) {

                    // If checking resize edge, return additional info
                    if (checkResizeEdge) {
                        const distanceFromRightEdge = (noteX + noteW) - worldX;
                        const isOnResizeEdge = distanceFromRightEdge <= resizeEdgeWidth / this.viewport.zoom;

                        return {
                            note,
                            isOnResizeEdge,
                            noteRect: { x: noteX, y: noteY, width: noteW, height: noteH }
                        };
                    }

                    return note;
                }
            }
        }
        return checkResizeEdge ? null : null;
    }

    // Start dragging a note
    startNoteDrag(note, worldPos, mouseEvent, allowVertical = false) {
        this.dragDrop.isDragging = true;
        this.dragDrop.draggedNote = note;
        this.dragDrop.dragStartPos = { ...worldPos };
        this.dragDrop.dragCurrentPos = { ...worldPos };
        this.dragDrop.allowVertical = allowVertical; // Store vertical drag permission

            // CONSISTENT: Calculate drag offset from note origin
        // time is in beats, convert to pixels (1 beat = cellWidth * 4 pixels)
        const pixelsPerBeat = this.options.cellWidth * 4;
        const noteX = note.time * pixelsPerBeat * this.viewport.zoom;
        const noteY = note.pitch * this.options.cellHeight * this.viewport.zoom;
        this.dragDrop.dragOffset = {
            x: worldPos.worldX - noteX,
            y: worldPos.worldY - noteY
        };

        // If note is not selected, select only this note
        if (!this.dragDrop.selectedNotes.has(note.id)) {
            this.dragDrop.selectedNotes.clear();
            this.dragDrop.selectedNotes.add(note.id);
        }

        this.container.style.cursor = 'grabbing';
        console.log(`🎵 Started dragging note: ${note.id} (vertical: ${allowVertical})`);
    }

    // Start resizing a note
    startNoteResize(note, worldPos) {
        this.dragDrop.isResizing = true;
        this.dragDrop.resizeNote = note;
        this.dragDrop.dragStartPos = { ...worldPos };
        this.dragDrop.resizeStartWidth = note.duration || 0.25;

        this.container.style.cursor = 'ew-resize';
        console.log(`📏 Started resizing note: ${note.id}`);
    }

    // Update note drag position with snap-aware positioning
    updateNoteDrag(screenX, screenY) {
        if (!this.dragDrop.isDragging) return;

        const worldPos = this.screenToWorld(screenX, screenY);
        this.dragDrop.dragCurrentPos = worldPos;

        // Snap to current grid mode
        const { cellHeight } = this.options;
        const snapConfig = this.snapModes[this.snapMode] || this.snapModes['1/16'];

        // Snap X to current snap mode
        const adjustedX = worldPos.worldX - this.dragDrop.dragOffset.x;
        const snappedX = Math.round(adjustedX / snapConfig.pixels) * snapConfig.pixels;

        // Snap Y to semitone
        const adjustedY = worldPos.worldY - this.dragDrop.dragOffset.y;
        const snappedY = Math.round(adjustedY / cellHeight) * cellHeight;

        // Store snapped positions for visual feedback
        this.dragDrop.snappedPos = {
            x: Math.max(0, snappedX), // Don't allow negative time
            y: snappedY
        };

        // Update visual feedback
        this.invalidateLayer('selection');
    }

    // Update note resize
    updateNoteResize(screenX, screenY) {
        if (!this.dragDrop.isResizing) return;

        const worldPos = this.screenToWorld(screenX, screenY);
        const { cellWidth } = this.options;
        const snapConfig = this.snapModes[this.snapMode] || this.snapModes['1/16'];

        // Calculate new width based on mouse position
        const noteStartX = (this.dragDrop.resizeNote.time * cellWidth) / 0.25;
        const newWidth = Math.max(snapConfig.pixels, worldPos.worldX - noteStartX);

        // Snap new width to grid
        const snappedWidth = Math.round(newWidth / snapConfig.pixels) * snapConfig.pixels;

        // Store snapped width for visual feedback
        this.dragDrop.newWidth = snappedWidth;

        // Update visual feedback
        this.invalidateLayer('selection');
    }

    // Finish note drag with CORRECT positioning
    finishNoteDrag() {
        if (!this.dragDrop.isDragging) return;

        const { cellHeight, cellWidth } = this.options;
        const originalNote = this.dragDrop.draggedNote;

        // Get final mouse position
        const finalPos = this.dragDrop.dragCurrentPos;

        // CORRECT: Convert world position to beats
        // World position is already adjusted for viewport
        const pixelsPerBeat = cellWidth * 4; // No zoom here, worldX already accounts for it
        const newTime = Math.max(0, (finalPos.worldX - this.dragDrop.dragOffset.x) / pixelsPerBeat);

        // Snap to grid
        const snapFractions = {
            '1/64': 0.0625,
            '1/32': 0.125,
            '1/16': 0.25,
            '1/8': 0.5,
            '1/4': 1,
            '1': 4
        };
        const snapSize = snapFractions[this.snapMode] || 0.25;
        const snappedTime = Math.round(newTime / snapSize) * snapSize;

        // Only change pitch if vertical dragging is allowed
        let newPitch = originalNote.pitch;
        if (this.dragDrop.allowVertical) {
            // CORRECT: Convert world Y to grid pitch
            const gridPitch = (finalPos.worldY - this.dragDrop.dragOffset.y) / cellHeight;
            newPitch = Math.max(0, Math.min(119, Math.round(gridPitch))); // Clamp to 10 octaves
        }

        console.log('🎯 Drag finished:', {
            originalTime: originalNote.time,
            newTime: snappedTime,
            originalPitch: originalNote.pitch,
            newPitch: newPitch
        });

        // Call external callback for note update
        if (this.onNoteDrag) {
            this.onNoteDrag(originalNote, {
                time: snappedTime,
                pitch: newPitch,
                verticalChanged: this.dragDrop.allowVertical
            });
        }

        // Reset drag state
        this.dragDrop.isDragging = false;
        this.dragDrop.draggedNote = null;
        this.dragDrop.allowVertical = false;
        this.dragDrop.snappedPos = null;
        this.dragDrop.selectedNotes.clear();
        this.container.style.cursor = 'default';

        // Clear selection layer and force full re-render to remove ghosts
        this.invalidateLayer('selection');
        this.invalidateAll(); // Force complete re-render

        console.log('✅ Finished dragging note to:', { time: snappedTime, pitch: newPitch, snap: this.snapMode });
    }

    // Finish note resize with snap-aware sizing
    finishNoteResize() {
        if (!this.dragDrop.isResizing) return;

        const originalNote = this.dragDrop.resizeNote;
        const snapConfig = this.snapModes[this.snapMode] || this.snapModes['1/16'];
        const newWidthPixels = this.dragDrop.newWidth || snapConfig.pixels;

        // Convert width pixels to duration in beats
        const snapFractions = {
            '1/1': 4,      // Whole note = 4 beats
            '1/2': 2,      // Half note = 2 beats
            '1/4': 1,      // Quarter note = 1 beat
            '1/8': 0.5,    // 8th note = 0.5 beats
            '1/16': 0.25,  // 16th note = 0.25 beats
            '1/32': 0.125  // 32nd note = 0.125 beats
        };
        const beatValue = snapFractions[this.snapMode] || 0.25;
        const newDuration = Math.max(beatValue, (newWidthPixels / snapConfig.pixels) * beatValue);

        // Call external callback for note update
        if (this.onNoteResize) {
            this.onNoteResize(originalNote, { duration: newDuration });
        }

        // Reset resize state
        this.dragDrop.isResizing = false;
        this.dragDrop.resizeNote = null;
        this.dragDrop.newWidth = null;
        this.container.style.cursor = 'default';

        console.log('✅ Finished resizing note to duration:', newDuration, 'beats');
    }

    // Toggle note selection
    toggleNoteSelection(note) {
        if (this.dragDrop.selectedNotes.has(note.id)) {
            this.dragDrop.selectedNotes.delete(note.id);
        } else {
            this.dragDrop.selectedNotes.add(note.id);
        }
        this.invalidateLayer('selection');
    }

    // Set mouse mode
    setMouseMode(mode) {
        this.mouseMode = mode;
        this.dragDrop.selectedNotes.clear();
        this.invalidateLayer('selection');
        console.log('🖱️ Mouse mode changed to:', mode);
    }

    // Update cursor based on current mode and hovered element
    updateCursor(noteHit) {
        switch (this.mouseMode) {
            case 'select':
                if (noteHit && noteHit.isOnResizeEdge) {
                    this.container.style.cursor = 'ew-resize';
                } else if (noteHit && noteHit.note) {
                    this.container.style.cursor = 'pointer';
                } else {
                    this.container.style.cursor = 'default';
                }
                break;
            case 'write':
                this.container.style.cursor = (noteHit && noteHit.note) ? 'not-allowed' : 'crosshair';
                break;
            case 'delete':
                this.container.style.cursor = (noteHit && noteHit.note) ? 'pointer' : 'default';
                break;
            case 'slice':
                this.container.style.cursor = (noteHit && noteHit.note) ? 'text' : 'default';
                break;
            default:
                this.container.style.cursor = 'default';
        }
    }

    // Handle mouse up for different modes
    handleMouseUpForMode(e, hasMoved) {
        if (hasMoved) return; // Only handle clicks, not drags

        const rect = this.container.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        const clickedNote = this.getNoteAtPosition(worldPos.worldX, worldPos.worldY);

        switch (this.mouseMode) {
            case 'write':
                if (!clickedNote && this.onEmptySpaceClick) {
                    console.log('✏️ Creating note at:', worldPos);
                    this.onEmptySpaceClick(worldPos.worldX, worldPos.worldY);
                }
                break;

            case 'select':
                // Handle selection clicks that weren't handled in mousedown
                break;

            default:
                // Other modes handled in mousedown
                break;
        }
    }

    // Main render loop
    startRenderLoop() {
        const render = (timestamp) => {
            this.updatePerformanceMetrics(timestamp);
            this.renderFrame();
            this.animationId = requestAnimationFrame(render);
        };

        this.animationId = requestAnimationFrame(render);
    }

    // FL Studio optimized render frame
    renderFrame() {
        if (!this.isInitialized) return;

        const startTime = performance.now();

        // FL Studio trick: Only clear & render what changed
        const changedLayers = [];

        Object.entries(this.layers).forEach(([name, layer]) => {
            if (layer.needsUpdate) {
                layer.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
                changedLayers.push(name);
                layer.needsUpdate = false;
            }
        });

        // Skip render if nothing changed (unless dragging)
        if (changedLayers.length === 0 && !this.dragDrop.isDragging) {
            return;
        }

        // Render only changed layers (FL Studio optimization)
        if (changedLayers.includes('background')) this.renderBackground();
        if (changedLayers.includes('notes')) this.renderNotes();
        if (changedLayers.includes('playhead')) this.renderPlayhead();
        if (changedLayers.includes('selection')) this.renderSelection();
        if (changedLayers.includes('ui')) this.renderUI();

        // Always render selection during drag for feedback
        if (this.dragDrop.isDragging && !changedLayers.includes('selection')) {
            this.renderSelection();
        }

        this.performance.renderTime = performance.now() - startTime;
    }

    // Set snap mode for grid rendering
    setSnapMode(mode) {
        if (this.snapModes[mode]) {
            this.snapMode = mode;
            this.invalidateLayer('background');
            console.log(`📐 Grid snap mode changed to: ${mode}`);
        }
    }

    // FL Studio: Calculate grid level of detail based on zoom
    calculateGridLOD(zoom) {
        for (let level of this.gridLevels) {
            if (zoom >= level.zoom[0] && zoom < level.zoom[1]) {
                return level;
            }
        }
        return this.gridLevels[4]; // Default to beat grid
    }

    // FL Studio: Calculate visible range for keyboard
    calculateKeyboardRange() {
        const { y, height, zoom } = this.viewport;
        const { cellHeight, totalOctaves } = this.options;

        const totalHeight = totalOctaves * 12 * cellHeight * zoom;
        const viewportHeight = height;

        // Check if all octaves fit in viewport
        if (totalHeight <= viewportHeight) {
            // All octaves visible - no scroll needed
            return {
                canScroll: false,
                visibleOctaves: totalOctaves,
                startOctave: 0,
                endOctave: totalOctaves
            };
        } else {
            // Need scrolling
            const visibleOctaves = Math.floor(viewportHeight / (12 * cellHeight * zoom));
            const startNote = Math.floor(y / (cellHeight * zoom));
            const startOctave = Math.floor(startNote / 12);

            return {
                canScroll: true,
                visibleOctaves: visibleOctaves,
                startOctave: startOctave,
                endOctave: Math.min(startOctave + visibleOctaves, totalOctaves)
            };
        }
    }

    // FL Studio: Auto-adjust zoom to fit keyboard
    fitKeyboardToView() {
        const { height } = this.viewport;
        const { cellHeight, totalOctaves } = this.options;

        const totalKeyboardHeight = totalOctaves * 12 * cellHeight;
        const requiredZoom = height / totalKeyboardHeight;

        // Clamp to min zoom
        this.viewport.zoom = Math.max(this.options.minZoom, requiredZoom);
        this.gridLOD = this.calculateGridLOD(this.viewport.zoom);

        console.log(`🎹 FL: Keyboard fitted to view, zoom: ${this.viewport.zoom.toFixed(3)}`);
    }

    // FL Studio dynamic grid rendering
    renderBackground() {
        const ctx = this.layers.background.ctx;
        const { cellHeight } = this.options;
        const { x, y, width, height, zoom } = this.viewport;

        // Update visible bar count
        const pixelsPerBeat = this.options.cellWidth * 4 * zoom;
        const pixelsPerBar = pixelsPerBeat * 4;
        this.world.visibleBars = Math.floor(width / pixelsPerBar);

        ctx.clearRect(0, 0, width, height);

        // FL Studio ULTRA OPTIMIZATION: Adaptive grid rendering (no LOD needed)
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;

        // Calculate optimal line spacing based on zoom
        const minLineDistance = 8; // FL Studio: minimum 8px between lines
        const basePixelsPerBeat = this.options.cellWidth * 4; // 48px per beat at zoom=1
        const currentPixelsPerBeat = basePixelsPerBeat * zoom;

        // FL Studio adaptive intervals (bars shown as: 1, 53, 70, 86...)
        let interval, labelEvery, showSubdivisions;

        if (currentPixelsPerBeat < minLineDistance) {
            // Ultra zoom out: only major bars every 16-32 beats
            interval = Math.ceil(minLineDistance / currentPixelsPerBeat) * 16;
            labelEvery = interval;
            showSubdivisions = false;
        } else if (currentPixelsPerBeat < minLineDistance * 2) {
            // Major bars every 4-8 beats
            interval = Math.ceil(minLineDistance / currentPixelsPerBeat) * 4;
            labelEvery = interval;
            showSubdivisions = false;
        } else if (currentPixelsPerBeat < minLineDistance * 4) {
            // Bars every 1-2 beats
            interval = Math.max(1, Math.ceil(minLineDistance / currentPixelsPerBeat));
            labelEvery = interval * 4; // Label every 4th bar
            showSubdivisions = false;
        } else {
            // Normal zoom: beats + subdivisions
            interval = 0.25; // Quarter note subdivisions
            labelEvery = 4; // Label every bar
            showSubdivisions = currentPixelsPerBeat > minLineDistance * 8;
        }

        // Calculate visible range in beats
        const startBeat = Math.floor((x / zoom) / basePixelsPerBeat / interval) * interval;
        const endBeat = Math.ceil(((x + width) / zoom) / basePixelsPerBeat / interval) * interval;

        // FL Studio: Render only visible lines (max ~30-50 lines total)
        const maxLines = Math.min(50, Math.ceil(width / minLineDistance));
        const step = Math.max(interval, (endBeat - startBeat) / maxLines);

        for (let beat = startBeat; beat <= endBeat; beat += step) {
            const lineX = (beat * basePixelsPerBeat * zoom) - x;

            if (lineX >= -1 && lineX <= width + 1) {
                // Major line every labelEvery
                const isMajor = (beat % labelEvery) === 0;

                ctx.strokeStyle = isMajor ? '#555555' : '#333333';
                ctx.lineWidth = isMajor ? 1.5 : 0.8;

                ctx.beginPath();
                ctx.moveTo(Math.round(lineX), 0);
                ctx.lineTo(Math.round(lineX), height);
                ctx.stroke();

                // FL Studio bar numbers (1, 53, 70, 86 pattern)
                if (isMajor && beat > 0 && currentPixelsPerBeat > minLineDistance * 2) {
                    const barNumber = Math.round(beat / 4) + 1;
                    ctx.fillStyle = '#888888';
                    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
                    ctx.fillText(`${barNumber}`, lineX + 3, 14);
                }

                // Subdivisions only when zoomed enough
                if (showSubdivisions && interval >= 1) {
                    for (let sub = 0.25; sub < 1; sub += 0.25) {
                        const subLineX = ((beat + sub) * basePixelsPerBeat * zoom) - x;
                        if (subLineX >= 0 && subLineX <= width) {
                            ctx.strokeStyle = '#2a2a2a';
                            ctx.lineWidth = 0.5;
                            ctx.beginPath();
                            ctx.moveTo(Math.round(subLineX), 0);
                            ctx.lineTo(Math.round(subLineX), height);
                            ctx.stroke();
                        }
                    }
                }
            }
        }

        // Draw horizontal lines (pitch grid) - always semitones
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 0.5;

        const scaledCellHeight = cellHeight * zoom;
        const startRow = Math.floor(y / scaledCellHeight);
        const endRow = Math.ceil((y + height) / scaledCellHeight);

        for (let row = startRow; row <= endRow; row++) {
            const lineY = row * scaledCellHeight - y;
            if (lineY >= 0 && lineY <= height) {
                // Emphasize octave lines (every 12 semitones)
                const isOctave = row % 12 === 0;
                ctx.strokeStyle = isOctave ? '#444444' : '#2a2a2a';
                ctx.lineWidth = isOctave ? 1 : 0.5;

                ctx.beginPath();
                ctx.moveTo(0, lineY);
                ctx.lineTo(width, lineY);
                ctx.stroke();
            }
        }
    }

    // Get note color based on velocity (0-127)
    getNoteColor(velocity = 100) {
        // Normalize velocity to 0-1 range
        const normalizedVelocity = Math.max(0, Math.min(127, velocity)) / 127;

        // Color scheme: Dark to bright green based on velocity
        const baseHue = 120; // Green hue
        const saturation = 70 + (normalizedVelocity * 30); // 70-100% saturation
        const lightness = 35 + (normalizedVelocity * 25);  // 35-60% lightness

        return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
    }

    // Render notes from visible chunks with velocity-based colors
    renderNotes() {
        // Skip note rendering in hybrid mode - HTML handles notes
        if (this.options.hybridMode && !this.options.renderNotesToCanvas) {
            return;
        }

        const ctx = this.layers.notes.ctx;
        const { cellWidth, cellHeight } = this.options;
        const { zoom } = this.viewport;

        let totalNotes = 0;
        let renderedNotes = 0;

        // Render notes from all active chunks
        this.world.activeChunks.forEach(chunkId => {
            const chunk = this.world.chunks.get(chunkId);
            if (!chunk || !chunk.loaded) {
                return;
            }

            totalNotes += chunk.notes.length;

            chunk.notes.forEach(note => {
                // CONSISTENT: time is in beats, convert to pixels
                // 1 beat = cellWidth * 4 pixels (at zoom=1)
                const pixelsPerBeat = cellWidth * 4;
                const x = (note.time * pixelsPerBeat * zoom) - this.viewport.x;
                const y = (note.pitch * cellHeight * zoom) - this.viewport.y;
                const w = ((note.duration || 0.25) * pixelsPerBeat) * zoom;
                const h = cellHeight * zoom - 1;

                // Only render if visible
                if (x + w >= 0 && x <= this.viewport.width &&
                    y + h >= 0 && y <= this.viewport.height) {

                    // Set color based on velocity
                    const velocity = note.velocity || 100;
                    ctx.fillStyle = this.getNoteColor(velocity);

                    // Draw main note body
                    ctx.fillRect(x, y, w, h);

                    // Draw subtle border for better definition
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x, y, w, h);

                    // Draw velocity indicator (small bar at left edge)
                    const velocityHeight = (velocity / 127) * h;
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + (velocity / 127) * 0.3})`;
                    ctx.fillRect(x, y + h - velocityHeight, 2, velocityHeight);

                    renderedNotes++;
                    // console.log(`🎨 Rendered note at (${x.toFixed(1)}, ${y.toFixed(1)}) size ${w.toFixed(1)}x${h.toFixed(1)}, velocity: ${velocity}`);
                }
            });
        });

        // console.log(`🎨 renderNotes: ${totalNotes} total, ${renderedNotes} rendered, ${this.world.activeChunks.size} active chunks`);
    }

    // Playhead controls
    play() {
        if (!this.playhead.isPlaying) {
            this.playhead.isPlaying = true;
            this.playhead.startTime = performance.now();
            console.log('▶️ Playback started at position:', this.playhead.position);
        }
    }

    pause() {
        if (this.playhead.isPlaying) {
            this.playhead.isPlaying = false;
            console.log('⏸️ Playback paused at position:', this.playhead.position);
        }
    }

    stop() {
        this.playhead.isPlaying = false;
        this.playhead.position = 0;
        console.log('⏹️ Playback stopped');
    }

    setPlayheadPosition(position) {
        this.playhead.position = Math.max(0, position);
        this.playhead.startTime = performance.now();
        this.invalidateLayer('playhead');
    }

    // Render playhead - the vertical line showing current play position
    renderPlayhead() {
        const ctx = this.layers.playhead.ctx;
        const { zoom } = this.viewport;

        // Clear playhead layer
        ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);

        // Update playhead position if playing
        if (this.playhead.isPlaying) {
            const currentTime = performance.now();
            const elapsedSeconds = (currentTime - this.playhead.startTime) / 1000;
            const elapsedBeats = (elapsedSeconds * this.playhead.bpm) / 60;
            this.playhead.position += elapsedBeats * 0.016; // Rough frame compensation
            this.playhead.startTime = currentTime;
        }

        // Convert playhead position (beats) to screen X coordinate
        const snapConfig = this.snapModes['1/16'] || { pixels: 4 };
        const playheadX = (this.playhead.position / 0.25) * snapConfig.pixels * zoom - this.viewport.x;

        // Only draw if playhead is visible
        if (playheadX >= 0 && playheadX <= this.viewport.width) {
            // Draw playhead line
            ctx.strokeStyle = '#FF6B6B';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);

            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, this.viewport.height);
            ctx.stroke();

            // Draw playhead triangle at top
            ctx.fillStyle = '#FF6B6B';
            ctx.beginPath();
            ctx.moveTo(playheadX - 6, 0);
            ctx.lineTo(playheadX + 6, 0);
            ctx.lineTo(playheadX, 12);
            ctx.closePath();
            ctx.fill();

            // Draw time display
            const timeText = `${this.playhead.position.toFixed(2)}`;
            ctx.fillStyle = '#FF6B6B';
            ctx.font = '10px Arial';
            ctx.fillText(timeText, playheadX + 8, 10);
        }
    }

    // Render selection
    renderSelection() {
        const ctx = this.layers.selection.ctx;
        const { cellWidth, cellHeight } = this.options;
        const { zoom } = this.viewport;

        // Clear selection layer
        ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);

        // Render selected notes
        this.world.activeChunks.forEach(chunkId => {
            const chunk = this.world.chunks.get(chunkId);
            if (!chunk || !chunk.loaded) return;

            chunk.notes.forEach(note => {
                // Check if note is selected
                if (!this.dragDrop.selectedNotes.has(note.id)) return;

                // Convert time to world coordinates
                let noteX = (note.time * cellWidth) / 0.25; // time in beats * pixels per 16th
                let noteY = note.pitch * cellHeight;

                // If this note is being dragged, use drag position
                if (this.dragDrop.isDragging && this.dragDrop.draggedNote?.id === note.id) {
                    const worldPos = this.dragDrop.dragCurrentPos;
                    noteX = worldPos.worldX - this.dragDrop.dragOffset.x;
                    noteY = worldPos.worldY - this.dragDrop.dragOffset.y;

                    // Snap to grid for visual feedback
                    noteX = Math.round(noteX / cellWidth) * cellWidth;
                    noteY = Math.round(noteY / cellHeight) * cellHeight;
                }

                const x = (noteX * zoom) - this.viewport.x;
                const y = (noteY * zoom) - this.viewport.y;
                const w = ((note.duration || 0.25) * cellWidth / 0.25) * zoom;
                const h = cellHeight * zoom - 1;

                // Only render if visible
                if (x + w >= 0 && x <= this.viewport.width &&
                    y + h >= 0 && y <= this.viewport.height) {

                    // Selection highlight
                    ctx.strokeStyle = '#FFD700';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
                    ctx.setLineDash([]);

                    // Drag ghost effect
                    if (this.dragDrop.isDragging && this.dragDrop.draggedNote?.id === note.id) {
                        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
                        ctx.fillRect(x, y, w, h);
                    }

                    // Resize ghost effect
                    if (this.dragDrop.isResizing && this.dragDrop.resizeNote?.id === note.id && this.dragDrop.newWidth) {
                        const newW = this.dragDrop.newWidth * zoom;

                        // Draw resize preview
                        ctx.strokeStyle = '#FFD700';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([3, 3]);
                        ctx.strokeRect(x, y, newW, h);
                        ctx.setLineDash([]);

                        // Draw resize handle
                        ctx.fillStyle = '#FFD700';
                        ctx.fillRect(x + newW - 2, y, 4, h);
                    }
                }
            });
        });
    }

    // Render UI elements
    renderUI() {
        // Implementation for rulers, labels, etc.
    }

    // Performance tracking
    updatePerformanceMetrics(timestamp) {
        this.performance.frameCount++;

        if (timestamp - this.performance.lastFrame >= 1000) {
            this.performance.fps = this.performance.frameCount;
            this.performance.frameCount = 0;
            this.performance.lastFrame = timestamp;
        }
    }

    // FL Studio: Mark layer for re-render (don't clear immediately)
    invalidateLayer(layerName) {
        if (this.layers[layerName]) {
            this.layers[layerName].needsUpdate = true;
        }
    }

    // Force redraw all layers
    invalidateAll() {
        // Clear all layers - they will be redrawn on next frame
        Object.keys(this.layers).forEach(layerName => {
            this.invalidateLayer(layerName);
        });
    }

    // FL Studio: Force immediate render (bypass RAF)
    forceImmediateRender() {
        console.log('⚡ FL Studio: Force immediate render');

        // Clear all chunks to force reload
        this.world.chunks.clear();

        // Update visible chunks immediately
        this.updateVisibleChunks();

        // Invalidate all layers
        this.invalidateAll();

        // Force render frame immediately (bypass RAF)
        this.renderFrame();

        console.log('⚡ FL Studio: Immediate render complete');
    }

    // Handle container resize
    handleResize() {
        const { width, height } = this.container.getBoundingClientRect();
        this.viewport.width = width;
        this.viewport.height = height;

        // Resize all canvas layers
        Object.values(this.layers).forEach(layer => {
            layer.canvas.width = width * window.devicePixelRatio;
            layer.canvas.height = height * window.devicePixelRatio;
            layer.canvas.style.width = `${width}px`;
            layer.canvas.style.height = `${height}px`;
            layer.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        });

        this.invalidateAll();
    }

    // Add note at position
    addNote(worldX, worldY, duration = 0.25) {
        // Convert world coordinates to time/pitch
        const time = worldX / this.options.cellWidth;
        const pitch = worldY / this.options.cellHeight;

        return { time, pitch, duration, id: Date.now() };
    }

    // Screen to world coordinates
    screenToWorld(screenX, screenY) {
        const worldX = (screenX + this.viewport.x) / this.viewport.zoom;
        const worldY = (screenY + this.viewport.y) / this.viewport.zoom;
        return { worldX, worldY };
    }

    // World to screen coordinates
    worldToScreen(worldX, worldY) {
        const screenX = (worldX * this.viewport.zoom) - this.viewport.x;
        const screenY = (worldY * this.viewport.zoom) - this.viewport.y;
        return { screenX, screenY };
    }

    // Clean up
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        // Remove canvas elements
        Object.values(this.layers).forEach(layer => {
            if (layer.canvas && layer.canvas.parentNode) {
                layer.canvas.parentNode.removeChild(layer.canvas);
            }
        });

        console.log('🗑️ Infinite Grid Engine destroyed');
    }

    // Get performance stats
    getPerformanceStats() {
        return {
            fps: this.performance.fps,
            renderTime: this.performance.renderTime,
            activeChunks: this.world.activeChunks.size,
            totalChunks: this.world.chunks.size,
            viewportPosition: { ...this.viewport },
            memoryUsage: this.world.chunks.size * 8 // Rough estimate in KB
        };
    }
}