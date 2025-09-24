// Infinite Grid Engine - Mühendislik Harikası Canvas Sistemi
// Ultra performanslı, sonsuz scroll, dinamik loading

export class InfiniteGridEngine {
    constructor(options = {}) {
        this.options = {
            cellWidth: 16,        // Step width
            cellHeight: 20,       // Note height
            bufferSize: 50,       // Cells to render beyond viewport
            chunkSize: 1000,      // Notes per chunk for memory management
            maxZoom: 4,           // Maximum zoom level
            minZoom: 0.25,        // Minimum zoom level
            ...options
        };

        // Canvas layers for different elements
        this.layers = {
            background: null,     // Grid background
            notes: null,          // Note rectangles
            playhead: null,       // Playhead overlay
            selection: null,      // Selection overlay
            ui: null             // UI elements (rulers, etc)
        };

        // Viewport tracking
        this.viewport = {
            x: 0, y: 0,          // Top-left position
            width: 1200,         // Viewport width
            height: 800,         // Viewport height
            zoom: 1              // Current zoom level
        };

        // Infinite space management
        this.world = {
            minX: -Infinity,     // No left bound
            maxX: Infinity,      // No right bound
            minY: 0,             // Start at C0
            maxY: 8 * 12 * this.options.cellHeight, // End at B7
            chunks: new Map(),   // Loaded data chunks
            activeChunks: new Set() // Currently visible chunks
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
            dragOffset: { x: 0, y: 0 }
        };

        // Mouse mode system
        this.mouseMode = 'select'; // select, write, delete, slice

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
        console.log('🎨 Infinite Grid Engine initialized');
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

            // Check if clicking on a note
            const clickedNote = this.getNoteAtPosition(worldPos.worldX, worldPos.worldY);

            // Handle different mouse modes
            switch (this.mouseMode) {
                case 'select':
                    if (clickedNote && !e.shiftKey) {
                        // Start note dragging (both horizontal and vertical)
                        this.startNoteDrag(clickedNote, worldPos, e, true); // true = allow vertical drag
                    } else if (clickedNote && e.shiftKey) {
                        // Multi-select notes
                        this.toggleNoteSelection(clickedNote);
                    } else {
                        // Start panning
                        isPanning = true;
                        lastX = e.clientX;
                        lastY = e.clientY;
                        this.container.style.cursor = 'grabbing';
                    }
                    break;

                case 'write':
                    if (!clickedNote) {
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
                    if (clickedNote) {
                        // Delete note
                        if (this.onNoteDelete) {
                            this.onNoteDelete(clickedNote);
                        }
                    }
                    break;

                case 'slice':
                    if (clickedNote) {
                        // Slice note at position
                        if (this.onNoteSlice) {
                            this.onNoteSlice(clickedNote, worldPos.worldX);
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

        // Mouse move - handle dragging or panning
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
            } else if (isPanning) {
                // Handle panning
                const deltaX = e.clientX - lastX;
                const deltaY = e.clientY - lastY;
                this.pan(deltaX, deltaY);
                lastX = e.clientX;
                lastY = e.clientY;
            } else {
                // Update hover cursor based on mode
                const worldPos = this.screenToWorld(screenX, screenY);
                const hoveredNote = this.getNoteAtPosition(worldPos.worldX, worldPos.worldY);
                this.updateCursor(hoveredNote);
            }
        });

        // Mouse up - finish dragging or panning
        this.container.addEventListener('mouseup', (e) => {
            if (this.dragDrop.isDragging) {
                this.finishNoteDrag();
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

    // Zoom to specific point
    zoomToPoint(mouseX, mouseY, zoomFactor) {
        const newZoom = Math.max(this.options.minZoom,
                        Math.min(this.options.maxZoom, this.viewport.zoom * zoomFactor));

        if (newZoom !== this.viewport.zoom) {
            // Calculate world position of mouse
            const worldX = (mouseX + this.viewport.x) / this.viewport.zoom;
            const worldY = (mouseY + this.viewport.y) / this.viewport.zoom;

            // Update zoom
            this.viewport.zoom = newZoom;

            // Recalculate viewport position to keep mouse point fixed
            this.viewport.x = worldX * this.viewport.zoom - mouseX;
            this.viewport.y = worldY * this.viewport.zoom - mouseY;

            this.invalidateAll();
        }
    }

    // Pan the viewport
    pan(deltaX, deltaY) {
        this.viewport.x -= deltaX;
        this.viewport.y -= deltaY;

        // No bounds checking - infinite scroll!
        this.updateVisibleChunks();
        this.invalidateAll();
    }

    // Dynamic chunk loading system
    updateVisibleChunks() {
        const chunkSize = this.options.chunkSize;
        const bufferSize = this.options.bufferSize;

        // Calculate visible chunk range
        const startChunkX = Math.floor((this.viewport.x - bufferSize) / chunkSize);
        const endChunkX = Math.ceil((this.viewport.x + this.viewport.width + bufferSize) / chunkSize);

        const newActiveChunks = new Set();

        // Load visible chunks
        for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
            const chunkId = `chunk_${chunkX}`;
            newActiveChunks.add(chunkId);

            if (!this.world.chunks.has(chunkId)) {
                this.loadChunk(chunkX);
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

    // Load chunk data (notes in specific range)
    loadChunk(chunkX) {
        const chunkId = `chunk_${chunkX}`;
        const startTime = chunkX * this.options.chunkSize;
        const endTime = (chunkX + 1) * this.options.chunkSize;

        // Simulate loading notes in this time range
        const chunk = {
            startTime,
            endTime,
            notes: this.getNotesInRange(startTime, endTime),
            loaded: true
        };

        this.world.chunks.set(chunkId, chunk);
        console.log(`📦 Loaded chunk ${chunkId}: ${chunk.notes.length} notes`);
    }

    // Unload distant chunk
    unloadChunk(chunkId) {
        this.world.chunks.delete(chunkId);
        console.log(`🗑️ Unloaded chunk ${chunkId}`);
    }

    // Get notes in specific time range (connect to your data store)
    getNotesInRange(startTime, endTime) {
        // This will connect to your notes store
        // For now, return empty array
        return [];
    }

    // === DRAG & DROP METHODS ===

    // Find note at world position
    getNoteAtPosition(worldX, worldY) {
        const { cellWidth, cellHeight } = this.options;

        // Check all active chunks for notes
        for (let chunkId of this.world.activeChunks) {
            const chunk = this.world.chunks.get(chunkId);
            if (!chunk || !chunk.loaded) continue;

            for (let note of chunk.notes) {
                const noteX = note.time * cellWidth;
                const noteY = note.pitch * cellHeight;
                const noteW = (note.duration || 0.25) * cellWidth;
                const noteH = cellHeight;

                // Check if world position is inside note bounds
                if (worldX >= noteX && worldX <= noteX + noteW &&
                    worldY >= noteY && worldY <= noteY + noteH) {
                    return note;
                }
            }
        }
        return null;
    }

    // Start dragging a note
    startNoteDrag(note, worldPos, mouseEvent, allowVertical = false) {
        this.dragDrop.isDragging = true;
        this.dragDrop.draggedNote = note;
        this.dragDrop.dragStartPos = { ...worldPos };
        this.dragDrop.dragCurrentPos = { ...worldPos };
        this.dragDrop.allowVertical = allowVertical; // Store vertical drag permission

        // Calculate drag offset from note origin
        const noteX = note.time * this.options.cellWidth;
        const noteY = note.pitch * this.options.cellHeight;
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

    // Update note drag position
    updateNoteDrag(screenX, screenY) {
        if (!this.dragDrop.isDragging) return;

        const worldPos = this.screenToWorld(screenX, screenY);
        this.dragDrop.dragCurrentPos = worldPos;

        // Snap to grid
        const { cellWidth, cellHeight } = this.options;
        const snappedTime = Math.round((worldPos.worldX - this.dragDrop.dragOffset.x) / cellWidth) * (cellWidth / cellWidth);
        const snappedPitch = Math.round((worldPos.worldY - this.dragDrop.dragOffset.y) / cellHeight);

        // Update visual feedback
        this.invalidateLayer('selection');
    }

    // Finish note drag
    finishNoteDrag() {
        if (!this.dragDrop.isDragging) return;

        const { cellWidth, cellHeight } = this.options;
        const worldPos = this.dragDrop.dragCurrentPos;
        const originalNote = this.dragDrop.draggedNote;

        // Calculate new position with grid snapping
        const newTime = Math.max(0, Math.round((worldPos.worldX - this.dragDrop.dragOffset.x) / cellWidth) * 0.25);

        // Only change pitch if vertical dragging is allowed
        let newPitch = originalNote.pitch;
        if (this.dragDrop.allowVertical) {
            newPitch = Math.max(0, Math.round((worldPos.worldY - this.dragDrop.dragOffset.y) / cellHeight));
        }

        // Call external callback for note update
        if (this.onNoteDrag) {
            this.onNoteDrag(originalNote, {
                time: newTime,
                pitch: newPitch,
                verticalChanged: this.dragDrop.allowVertical
            });
        }

        // Reset drag state
        this.dragDrop.isDragging = false;
        this.dragDrop.draggedNote = null;
        this.dragDrop.allowVertical = false;
        this.container.style.cursor = 'default';

        console.log('✅ Finished dragging note to:', { time: newTime, pitch: newPitch, vertical: this.dragDrop.allowVertical });
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
    updateCursor(hoveredNote) {
        switch (this.mouseMode) {
            case 'select':
                this.container.style.cursor = hoveredNote ? 'pointer' : 'default';
                break;
            case 'write':
                this.container.style.cursor = hoveredNote ? 'not-allowed' : 'crosshair';
                break;
            case 'delete':
                this.container.style.cursor = hoveredNote ? 'pointer' : 'default';
                break;
            case 'slice':
                this.container.style.cursor = hoveredNote ? 'text' : 'default';
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

    // Render single frame
    renderFrame() {
        if (!this.isInitialized) return;

        const startTime = performance.now();

        // Clear canvases
        Object.values(this.layers).forEach(layer => {
            layer.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
        });

        // Render layers in order
        this.renderBackground();
        this.renderNotes();
        this.renderPlayhead();
        this.renderSelection();
        this.renderUI();

        this.performance.renderTime = performance.now() - startTime;
    }

    // Render grid background
    renderBackground() {
        const ctx = this.layers.background.ctx;
        const { cellWidth, cellHeight } = this.options;
        const { x, y, width, height, zoom } = this.viewport;

        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 0.5;

        // Draw vertical lines (time grid)
        const scaledCellWidth = cellWidth * zoom;
        const startCol = Math.floor(x / scaledCellWidth);
        const endCol = Math.ceil((x + width) / scaledCellWidth);

        for (let col = startCol; col <= endCol; col++) {
            const lineX = col * scaledCellWidth - x;
            ctx.beginPath();
            ctx.moveTo(lineX, 0);
            ctx.lineTo(lineX, height);
            ctx.stroke();
        }

        // Draw horizontal lines (pitch grid)
        const scaledCellHeight = cellHeight * zoom;
        const startRow = Math.floor(y / scaledCellHeight);
        const endRow = Math.ceil((y + height) / scaledCellHeight);

        for (let row = startRow; row <= endRow; row++) {
            const lineY = row * scaledCellHeight - y;
            ctx.beginPath();
            ctx.moveTo(0, lineY);
            ctx.lineTo(width, lineY);
            ctx.stroke();
        }
    }

    // Render notes from visible chunks
    renderNotes() {
        const ctx = this.layers.notes.ctx;
        const { cellWidth, cellHeight } = this.options;
        const { zoom } = this.viewport;

        ctx.fillStyle = '#4CAF50';

        let totalNotes = 0;
        let renderedNotes = 0;

        // Render notes from all active chunks
        this.world.activeChunks.forEach(chunkId => {
            const chunk = this.world.chunks.get(chunkId);
            if (!chunk || !chunk.loaded) {
                console.log(`🎨 Chunk ${chunkId} not loaded`);
                return;
            }

            console.log(`🎨 Rendering chunk ${chunkId} with ${chunk.notes.length} notes`);
            totalNotes += chunk.notes.length;

            chunk.notes.forEach(note => {
                const x = (note.time * cellWidth * zoom) - this.viewport.x;
                const y = (note.pitch * cellHeight * zoom) - this.viewport.y;
                const w = (note.duration || 0.25) * cellWidth * zoom;
                const h = cellHeight * zoom - 1;

                // Only render if visible
                if (x + w >= 0 && x <= this.viewport.width &&
                    y + h >= 0 && y <= this.viewport.height) {
                    ctx.fillRect(x, y, w, h);
                    renderedNotes++;
                    console.log(`🎨 Rendered note at (${x.toFixed(1)}, ${y.toFixed(1)}) size ${w.toFixed(1)}x${h.toFixed(1)}`);
                }
            });
        });

        console.log(`🎨 renderNotes: ${totalNotes} total, ${renderedNotes} rendered, ${this.world.activeChunks.size} active chunks`);
    }

    // Render playhead
    renderPlayhead() {
        // Implementation for playhead rendering
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

                let noteX = note.time * cellWidth;
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
                const w = (note.duration || 0.25) * cellWidth * zoom;
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

    // Invalidate specific layer for re-rendering
    invalidateLayer(layerName) {
        // Force re-render of specific layer
        if (this.layers[layerName]) {
            const ctx = this.layers[layerName].ctx;
            ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
        }
    }

    // Force redraw all layers
    invalidateAll() {
        // Clear all layers - they will be redrawn on next frame
        Object.keys(this.layers).forEach(layerName => {
            this.invalidateLayer(layerName);
        });
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