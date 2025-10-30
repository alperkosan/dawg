/**
 * Piano Roll Interaction Manager - Professional UX System
 * 
 * Bu dosya, piano roll için kapsamlı etkileşim hiyerarşisini yönetir.
 * Emsal DAW'ların (FL Studio, Ableton Live, Logic Pro) etkileşim kalitesini hedefler.
 */

// ✅ Browser-compatible EventEmitter
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }

    off(event, listener) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(l => l !== listener);
    }

    emit(event, ...args) {
        if (!this.events[event]) return;
        this.events[event].forEach(listener => listener(...args));
    }

    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
    }
}

// ✅ INTERACTION HIERARCHY CONSTANTS
export const INTERACTION_MODES = {
    // Primary modes
    SELECT: 'select',
    PAINT: 'paint',
    ERASE: 'erase',
    SLICE: 'slice',
    SLIDE: 'slide', // New: Slide notes horizontally
    
    // Secondary modes (contextual)
    RESIZE: 'resize',
    MOVE: 'move',
    COPY: 'copy',
    PASTE: 'paste',
    
    // Special modes
    QUANTIZE: 'quantize',
    HUMANIZE: 'humanize',
    VELOCITY: 'velocity',
    DURATION: 'duration'
};

export const CURSOR_STATES = {
    // Primary cursors
    DEFAULT: 'default',
    SELECT: 'select',
    PAINT: 'paint',
    ERASE: 'erase',
    SLICE: 'slice',
    SLIDE: 'slide',
    
    // Resize cursors
    RESIZE_LEFT: 'resize-left',
    RESIZE_RIGHT: 'resize-right',
    RESIZE_BOTH: 'resize-both',
    
    // Move cursors
    MOVE: 'move',
    GRAB: 'grab',
    GRABBING: 'grabbing',
    
    // Special cursors
    COPY: 'copy',
    PASTE: 'paste',
    NOT_ALLOWED: 'not-allowed',
    CROSSHAIR: 'crosshair',
    
    // Context cursors
    CONTEXT_MENU: 'context-menu',
    MAGNIFY: 'magnify',
    HAND: 'hand'
};

export const VISUAL_FEEDBACK = {
    // Note states
    NOTE_DEFAULT: 'note-default',
    NOTE_HOVER: 'note-hover',
    NOTE_SELECTED: 'note-selected',
    NOTE_PREVIEW: 'note-preview',
    NOTE_GHOST: 'note-ghost',
    NOTE_DISABLED: 'note-disabled',
    
    // Interaction states
    PAINT_PREVIEW: 'paint-preview',
    SLICE_PREVIEW: 'slice-preview',
    SELECTION_AREA: 'selection-area',
    RESIZE_HANDLE: 'resize-handle',
    
    // Animation states
    NOTE_ADDED: 'note-added',
    NOTE_DELETED: 'note-deleted',
    NOTE_MODIFIED: 'note-modified',
    NOTE_MOVED: 'note-moved',
    NOTE_RESIZED: 'note-resized'
};

export const INTERACTION_PRIORITIES = {
    // Highest priority (immediate response)
    CRITICAL: 100,
    
    // High priority (fast response)
    HIGH: 80,
    
    // Medium priority (smooth response)
    MEDIUM: 60,
    
    // Low priority (background processing)
    LOW: 40,
    
    // Background priority (deferred)
    BACKGROUND: 20
};

/**
 * Piano Roll Interaction Manager
 * 
 * Bu sınıf, piano roll'daki tüm etkileşimleri merkezi olarak yönetir.
 * Professional DAW'ların etkileşim kalitesini hedefler.
 */
export class PianoRollInteractionManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            // Performance settings
            debounceMs: 16, // 60fps
            throttleMs: 8,  // 120fps for critical interactions
            
            // Visual feedback settings
            animationDuration: 200,
            hoverDelay: 100,
            selectionDelay: 50,
            
            // Interaction settings
            doubleClickThreshold: 300,
            dragThreshold: 3, // pixels
            resizeHandleSize: 8,
            snapTolerance: 0.1,
            
            // Cursor settings
            cursorTransition: 'all 0.1s ease',
            cursorSize: '20px',
            
            ...options
        };
        
        // State management
        this.state = {
            activeMode: INTERACTION_MODES.SELECT,
            activeTool: null,
            cursorState: CURSOR_STATES.DEFAULT,
            isInteracting: false,
            lastInteraction: null,
            interactionHistory: [],
            
            // Mouse state
            mousePosition: { x: 0, y: 0 },
            mouseDown: false,
            mouseButton: null,
            mouseModifiers: { ctrl: false, shift: false, alt: false },
            
            // Selection state
            selectedNotes: new Set(),
            hoveredNote: null,
            selectionArea: null,
            
            // Drag state
            dragState: null,
            dragStart: null,
            dragCurrent: null,
            
            // Visual feedback state
            previewNotes: [],
            ghostNotes: [],
            highlightNotes: [],
            animationQueue: []
        };
        
        // Performance optimization
        this.performance = {
            frameRate: 60,
            lastFrameTime: 0,
            frameCount: 0,
            averageFrameTime: 16.67,
            droppedFrames: 0
        };
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize the interaction manager
     */
    initialize() {
        this.setupEventListeners();
        this.setupPerformanceMonitoring();
        this.setupVisualFeedback();
        this.setupCursorSystem();
        
        console.log('🎹 Piano Roll Interaction Manager initialized');
    }
    
    /**
     * Setup event listeners for interaction handling
     */
    setupEventListeners() {
        // Mouse events
        this.on('mousedown', this.handleMouseDown.bind(this));
        this.on('mousemove', this.handleMouseMove.bind(this));
        this.on('mouseup', this.handleMouseUp.bind(this));
        this.on('wheel', this.handleWheel.bind(this));
        
        // Keyboard events
        this.on('keydown', this.handleKeyDown.bind(this));
        this.on('keyup', this.handleKeyUp.bind(this));
        
        // Touch events (for mobile support)
        this.on('touchstart', this.handleTouchStart.bind(this));
        this.on('touchmove', this.handleTouchMove.bind(this));
        this.on('touchend', this.handleTouchEnd.bind(this));
        
        // Context menu
        this.on('contextmenu', this.handleContextMenu.bind(this));
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        const monitor = () => {
            const now = performance.now();
            const deltaTime = now - this.performance.lastFrameTime;
            
            this.performance.frameCount++;
            this.performance.averageFrameTime = 
                (this.performance.averageFrameTime * 0.9) + (deltaTime * 0.1);
            
            // Check for dropped frames
            if (deltaTime > 20) { // More than 20ms = dropped frame
                this.performance.droppedFrames++;
            }
            
            this.performance.lastFrameTime = now;
            
            // Emit performance update
            this.emit('performanceUpdate', {
                frameRate: Math.round(1000 / this.performance.averageFrameTime),
                averageFrameTime: this.performance.averageFrameTime,
                droppedFrames: this.performance.droppedFrames
            });
        };
        
        // Monitor every frame
        const monitorLoop = () => {
            monitor();
            requestAnimationFrame(monitorLoop);
        };
        
        requestAnimationFrame(monitorLoop);
    }
    
    /**
     * Setup visual feedback system
     */
    setupVisualFeedback() {
        // Create visual feedback layer
        this.visualFeedback = {
            container: null,
            layers: {
                notes: null,
                preview: null,
                selection: null,
                animation: null
            }
        };
        
        // Setup animation queue processor
        this.animationProcessor = {
            queue: [],
            processing: false,
            
            add: (animation) => {
                this.animationProcessor.queue.push(animation);
                this.processAnimations();
            },
            
            process: () => {
                if (this.animationProcessor.processing) return;
                
                this.animationProcessor.processing = true;
                
                const processNext = () => {
                    const animation = this.animationProcessor.queue.shift();
                    if (animation) {
                        this.executeAnimation(animation);
                        requestAnimationFrame(processNext);
                    } else {
                        this.animationProcessor.processing = false;
                    }
                };
                
                processNext();
            }
        };
    }
    
    /**
     * Setup cursor system
     */
    setupCursorSystem() {
        this.cursorSystem = {
            current: CURSOR_STATES.DEFAULT,
            previous: null,
            transition: this.config.cursorTransition,
            
            set: (cursor) => {
                if (cursor !== this.cursorSystem.current) {
                    this.cursorSystem.previous = this.cursorSystem.current;
                    this.cursorSystem.current = cursor;
                    
                    this.emit('cursorChange', {
                        current: cursor,
                        previous: this.cursorSystem.previous
                    });
                }
            },
            
            reset: () => {
                this.cursorSystem.set(CURSOR_STATES.DEFAULT);
            },
            
            get: () => this.cursorSystem.current
        };
    }
    
    /**
     * Handle mouse down events
     */
    handleMouseDown(event) {
        const coords = this.getCoordinatesFromEvent(event);
        const note = this.findNoteAtPosition(coords);
        
        // Update mouse state
        this.state.mouseDown = true;
        this.state.mouseButton = event.button;
        this.state.mousePosition = coords;
        this.state.mouseModifiers = {
            ctrl: event.ctrlKey || event.metaKey,
            shift: event.shiftKey,
            alt: event.altKey
        };
        
        // Determine interaction mode
        const mode = this.determineInteractionMode(event, note);
        this.setInteractionMode(mode);
        
        // Handle based on mode
        switch (mode) {
            case INTERACTION_MODES.SELECT:
                this.handleSelectMode(event, coords, note);
                break;
            case INTERACTION_MODES.PAINT:
                this.handlePaintMode(event, coords, note);
                break;
            case INTERACTION_MODES.ERASE:
                this.handleEraseMode(event, coords, note);
                break;
            case INTERACTION_MODES.SLICE:
                this.handleSliceMode(event, coords, note);
                break;
            case INTERACTION_MODES.SLIDE:
                this.handleSlideMode(event, coords, note);
                break;
        }
        
        this.emit('interactionStart', {
            mode,
            coords,
            note,
            modifiers: this.state.mouseModifiers
        });
    }
    
    /**
     * Handle mouse move events
     */
    handleMouseMove(event) {
        const coords = this.getCoordinatesFromEvent(event);
        const note = this.findNoteAtPosition(coords);
        
        // Update mouse state
        this.state.mousePosition = coords;
        this.state.hoveredNote = note;
        
        // Update cursor based on hover state
        this.updateCursor(note, coords);
        
        // Handle continuous interactions
        if (this.state.mouseDown) {
            this.handleContinuousInteraction(event, coords, note);
        }
        
        // Emit hover events
        this.emit('hover', {
            coords,
            note,
            modifiers: this.state.mouseModifiers
        });
    }
    
    /**
     * Handle mouse up events
     */
    handleMouseUp(event) {
        const coords = this.getCoordinatesFromEvent(event);
        
        // Update mouse state
        this.state.mouseDown = false;
        this.state.mouseButton = null;
        
        // Finalize current interaction
        this.finalizeInteraction(event, coords);
        
        // Reset cursor
        this.cursorSystem.reset();
        
        this.emit('interactionEnd', {
            coords,
            duration: Date.now() - (this.state.lastInteraction?.timestamp || 0)
        });
    }
    
    /**
     * Handle wheel events for velocity/duration control
     */
    handleWheel(event) {
        const coords = this.getCoordinatesFromEvent(event);
        const note = this.findNoteAtPosition(coords);
        
        // Prevent default scrolling
        event.preventDefault();
        
        // Determine wheel action
        const action = this.determineWheelAction(event);
        
        switch (action) {
            case 'velocity':
                this.handleVelocityWheel(event, note);
                break;
            case 'duration':
                this.handleDurationWheel(event, note);
                break;
            case 'zoom':
                this.handleZoomWheel(event);
                break;
        }
    }
    
    /**
     * Handle keyboard events
     */
    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        const modifiers = {
            ctrl: event.ctrlKey || event.metaKey,
            shift: event.shiftKey,
            alt: event.altKey
        };
        
        // Handle shortcuts
        this.handleShortcuts(key, modifiers, event);
        
        // Handle keyboard piano mode
        if (this.state.keyboardPianoMode) {
            this.handleKeyboardPiano(key, event);
        }
    }
    
    /**
     * Determine interaction mode based on context
     */
    determineInteractionMode(event, note) {
        const { ctrl, shift, alt } = this.state.mouseModifiers;
        const button = event.button;
        
        // Right click always shows context menu
        if (button === 2) {
            return INTERACTION_MODES.SELECT; // Will trigger context menu
        }
        
        // Shift + click = paint mode
        if (shift && button === 0) {
            return INTERACTION_MODES.PAINT;
        }
        
        // Alt + click = erase mode
        if (alt && button === 0) {
            return INTERACTION_MODES.ERASE;
        }
        
        // Ctrl + click = slice mode
        if (ctrl && button === 0) {
            return INTERACTION_MODES.SLICE;
        }
        
        // Default to select mode
        return INTERACTION_MODES.SELECT;
    }
    
    /**
     * Update cursor based on current state
     */
    updateCursor(note, coords) {
        let cursor = CURSOR_STATES.DEFAULT;
        
        if (this.state.mouseDown) {
            // During interaction
            switch (this.state.activeMode) {
                case INTERACTION_MODES.PAINT:
                    cursor = CURSOR_STATES.PAINT;
                    break;
                case INTERACTION_MODES.ERASE:
                    cursor = CURSOR_STATES.ERASE;
                    break;
                case INTERACTION_MODES.SLICE:
                    cursor = CURSOR_STATES.SLICE;
                    break;
                case INTERACTION_MODES.SLIDE:
                    cursor = CURSOR_STATES.SLIDE;
                    break;
                default:
                    cursor = CURSOR_STATES.GRABBING;
            }
        } else if (note) {
            // Hovering over note
            const resizeHandle = this.getResizeHandle(coords, note);
            if (resizeHandle) {
                cursor = resizeHandle === 'left' ? CURSOR_STATES.RESIZE_LEFT : CURSOR_STATES.RESIZE_RIGHT;
            } else {
                cursor = CURSOR_STATES.MOVE;
            }
        } else {
            // Default cursor based on active tool
            switch (this.state.activeMode) {
                case INTERACTION_MODES.PAINT:
                    cursor = CURSOR_STATES.PAINT;
                    break;
                case INTERACTION_MODES.ERASE:
                    cursor = CURSOR_STATES.ERASE;
                    break;
                case INTERACTION_MODES.SLICE:
                    cursor = CURSOR_STATES.SLICE;
                    break;
                default:
                    cursor = CURSOR_STATES.SELECT;
            }
        }
        
        this.cursorSystem.set(cursor);
    }
    
    /**
     * Execute animation with professional timing
     */
    executeAnimation(animation) {
        const { type, target, duration, easing, onComplete } = animation;
        
        // Use requestAnimationFrame for smooth animations
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Apply easing function
            const easedProgress = this.applyEasing(progress, easing);
            
            // Update target
            this.updateAnimationTarget(target, type, easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (onComplete) onComplete();
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    /**
     * Apply easing function to animation progress
     */
    applyEasing(progress, easing) {
        switch (easing) {
            case 'ease-in':
                return progress * progress;
            case 'ease-out':
                return 1 - Math.pow(1 - progress, 2);
            case 'ease-in-out':
                return progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            case 'bounce':
                return progress < 0.5 
                    ? 4 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            default:
                return progress;
        }
    }
    
    /**
     * Get coordinates from mouse event
     */
    getCoordinatesFromEvent(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            time: this.pixelToTime(event.clientX - rect.left),
            pitch: this.pixelToPitch(event.clientY - rect.top)
        };
    }
    
    /**
     * Find note at position with zoom-aware tolerance
     */
    findNoteAtPosition(coords) {
        const { time, pitch } = coords;
        const notes = this.getNotes();
        
        // Zoom-aware tolerance
        const zoomFactor = this.getZoomFactor();
        const tolerance = this.config.snapTolerance / Math.max(1, zoomFactor);
        
        return notes.find(note => {
            const noteEnd = note.startTime + note.length;
            const timeOverlap = time >= (note.startTime - tolerance) && 
                              time <= (noteEnd + tolerance);
            const pitchMatch = Math.abs(pitch - note.pitch) < 0.5;
            
            return timeOverlap && pitchMatch;
        });
    }
    
    /**
     * Get resize handle for note
     */
    getResizeHandle(coords, note) {
        const { x } = coords;
        const noteX = this.timeToPixel(note.startTime);
        const noteWidth = this.timeToPixel(note.length);
        const handleSize = this.config.resizeHandleSize;
        
        // Left handle
        if (x >= noteX && x <= noteX + handleSize) {
            return 'left';
        }
        
        // Right handle
        if (x >= noteX + noteWidth - handleSize && x <= noteX + noteWidth) {
            return 'right';
        }
        
        return null;
    }
    
    /**
     * Set interaction mode
     */
    setInteractionMode(mode) {
        if (this.state.activeMode !== mode) {
            this.state.activeMode = mode;
            this.emit('modeChange', { mode });
        }
    }
    
    /**
     * Get current interaction state
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.emit('configUpdate', this.config);
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        this.removeAllListeners();
        console.log('🎹 Piano Roll Interaction Manager destroyed');
    }
}

export default PianoRollInteractionManager;
