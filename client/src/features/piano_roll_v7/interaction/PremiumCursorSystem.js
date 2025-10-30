/**
 * Premium Cursor System - Advanced Piano Roll UX
 * 
 * Bu sistem, piano roll için premium cursor tasarımı ve toplu resize özelliği sağlar.
 * Emsal DAW'ların en gelişmiş cursor özelliklerini hedefler.
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

// ✅ PREMIUM CURSOR TYPES
export const PREMIUM_CURSOR_TYPES = {
    // Basic cursors with premium styling
    SELECT_PREMIUM: 'select-premium',
    PAINT_PREMIUM: 'paint-premium',
    ERASE_PREMIUM: 'erase-premium',
    SLICE_PREMIUM: 'slice-premium',
    SLIDE_PREMIUM: 'slide-premium',
    
    // Resize cursors with multi-directional support
    RESIZE_LEFT_PREMIUM: 'resize-left-premium',
    RESIZE_RIGHT_PREMIUM: 'resize-right-premium',
    RESIZE_UP_PREMIUM: 'resize-up-premium',
    RESIZE_DOWN_PREMIUM: 'resize-down-premium',
    RESIZE_UP_LEFT_PREMIUM: 'resize-up-left-premium',
    RESIZE_UP_RIGHT_PREMIUM: 'resize-up-right-premium',
    RESIZE_DOWN_LEFT_PREMIUM: 'resize-down-left-premium',
    RESIZE_DOWN_RIGHT_PREMIUM: 'resize-down-right-premium',
    RESIZE_BOTH_PREMIUM: 'resize-both-premium',
    
    // Multi-note cursors
    MULTI_SELECT_PREMIUM: 'multi-select-premium',
    MULTI_RESIZE_PREMIUM: 'multi-resize-premium',
    MULTI_MOVE_PREMIUM: 'multi-move-premium',
    MULTI_ROTATE_PREMIUM: 'multi-rotate-premium',
    
    // Special cursors
    MAGNETIC_PREMIUM: 'magnetic-premium',
    SNAP_PREMIUM: 'snap-premium',
    GRID_PREMIUM: 'grid-premium',
    
    // Tool change cursors
    TOOL_CHANGED_PREMIUM: 'tool-changed-premium',
    RULER_PREMIUM: 'ruler-premium',
    
    // Tool cursors
    PENCIL_PREMIUM: 'pencil-premium',
    BRUSH_PREMIUM: 'brush-premium',
    ERASER_PREMIUM: 'eraser-premium',
    EYEDROPPER_PREMIUM: 'eyedropper-premium',
    MAGNIFIER_PREMIUM: 'magnifier-premium',
    
    // Advanced cursors
    WARP_PREMIUM: 'warp-premium',
    BEND_PREMIUM: 'bend-premium',
    VELOCITY_PREMIUM: 'velocity-premium',
    DURATION_PREMIUM: 'duration-premium',
    PITCH_PREMIUM: 'pitch-premium'
};

// ✅ CURSOR STATES
export const CURSOR_STATES = {
    IDLE: 'idle',
    HOVER: 'hover',
    ACTIVE: 'active',
    PRESSING: 'pressing',
    DRAGGING: 'dragging',
    RESIZING: 'resizing',
    ROTATING: 'rotating',
    MULTI_SELECTING: 'multi-selecting',
    MULTI_RESIZING: 'multi-resizing',
    MULTI_MOVING: 'multi-moving',
    MULTI_ROTATING: 'multi-rotating',
    DISABLED: 'disabled',
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR: 'error'
};

// ✅ CURSOR ANIMATIONS
export const CURSOR_ANIMATIONS = {
    // Entrance animations
    FADE_IN: 'fade-in',
    SLIDE_IN: 'slide-in',
    SCALE_IN: 'scale-in',
    BOUNCE_IN: 'bounce-in',
    ELASTIC_IN: 'elastic-in',
    BACK_IN: 'back-in',
    
    // Exit animations
    FADE_OUT: 'fade-out',
    SLIDE_OUT: 'slide-out',
    SCALE_OUT: 'scale-out',
    BOUNCE_OUT: 'bounce-out',
    ELASTIC_OUT: 'elastic-out',
    BACK_OUT: 'back-out',
    
    // State animations
    PULSE: 'pulse',
    GLOW: 'glow',
    SHAKE: 'shake',
    ROTATE: 'rotate',
    WIGGLE: 'wiggle',
    BOUNCE: 'bounce',
    
    // Special animations
    TYPEWRITER: 'typewriter',
    REVEAL: 'reveal',
    MORPH: 'morph',
    PARTICLE: 'particle',
    WAVE: 'wave',
    SPIRAL: 'spiral'
};

// ✅ RESIZE MODES
export const RESIZE_MODES = {
    SINGLE: 'single',
    MULTI: 'multi',
    PROPORTIONAL: 'proportional',
    ASPECT_RATIO: 'aspect-ratio',
    GRID_SNAP: 'grid-snap',
    MAGNETIC: 'magnetic'
};

// ✅ RESIZE HANDLES
export const RESIZE_HANDLES = {
    NONE: 'none',
    LEFT: 'left',
    RIGHT: 'right',
    TOP: 'top',
    BOTTOM: 'bottom',
    TOP_LEFT: 'top-left',
    TOP_RIGHT: 'top-right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM_RIGHT: 'bottom-right',
    ALL: 'all'
};

/**
 * Premium Cursor System
 * 
 * Bu sınıf, piano roll için premium cursor tasarımı ve toplu resize özelliği sağlar.
 * Emsal DAW'ların en gelişmiş cursor özelliklerini hedefler.
 */
export class PremiumCursorSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            // Cursor settings
            defaultCursor: PREMIUM_CURSOR_TYPES.SELECT_PREMIUM,
            fallbackCursor: 'default',
            customCursors: new Map(),
            
            // Premium styling
            premium: {
                enabled: true,
                glowEffect: true,
                shadowEffect: true,
                particleEffect: false,
                smoothTransitions: true,
                highDPI: true,
                retina: true
            },
            
            // Animation settings
            animation: {
                duration: 200,
                transitionDuration: 150,
                hoverDelay: 50,
                pressDelay: 100,
                releaseDelay: 50,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                spring: {
                    tension: 300,
                    friction: 30
                }
            },
            
            // Visual settings
            visual: {
                size: 24,
                scale: 1.0,
                opacity: 1.0,
                color: '#3b82f6',
                glowColor: '#60a5fa',
                shadowColor: 'rgba(0, 0, 0, 0.3)',
                borderColor: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropBlur: 4,
                borderRadius: 8
            },
            
            // Resize settings
            resize: {
                enabled: true,
                multiResize: true,
                proportionalResize: true,
                aspectRatioLock: false,
                gridSnap: true,
                magneticSnap: true,
                snapThreshold: 8,
                minSize: 4,
                maxSize: 1000,
                handleSize: 12,
                handleColor: '#3b82f6',
                handleGlow: true,
                handleAnimation: true
            },
            
            // Performance settings
            performance: {
                debounceMs: 16,
                throttleMs: 8,
                maxCursors: 20,
                maxAnimations: 100,
                frameRate: 60,
                enableGPU: true,
                enableWebGL: false
            },
            
            // Accessibility settings
            accessibility: {
                highContrast: false,
                reducedMotion: false,
                largeCursors: false,
                keyboardNavigation: true,
                screenReader: true,
                focusVisible: true
            },
            
            ...options
        };
        
        // State management
        this.state = {
            // Current cursor
            current: PREMIUM_CURSOR_TYPES.SELECT_PREMIUM,
            previous: null,
            state: CURSOR_STATES.IDLE,
            
            // Cursor history
            history: [],
            maxHistory: 100,
            
            // Active cursors
            active: new Map(),
            queue: [],
            
            // Animation state
            isAnimating: false,
            animationQueue: [],
            animationId: null,
            
            // Resize state
            resizeState: {
                isResizing: false,
                mode: RESIZE_MODES.SINGLE,
                handles: new Set(),
                startPosition: null,
                currentPosition: null,
                originalSizes: new Map(),
                constraints: null,
                snapPoints: [],
                magneticPoints: []
            },
            
            // Multi-note state
            multiNoteState: {
                isActive: false,
                selectedNotes: new Set(),
                groupBounds: null,
                transformOrigin: null,
                transformMatrix: [1, 0, 0, 1, 0, 0]
            },
            
            // Performance state
            lastUpdate: 0,
            frameCount: 0,
            averageFrameTime: 16.67,
            droppedFrames: 0
        };
        
        // Cursor definitions
        this.cursors = new Map();
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize the premium cursor system
     */
    initialize() {
        this.setupPremiumCursors();
        this.setupResizeSystem();
        this.setupMultiNoteSystem();
        this.setupAnimationSystem();
        this.setupPerformanceMonitoring();
        this.setupAccessibility();
        
        console.log('🎯 Premium Cursor System initialized');
    }
    
    /**
     * Setup premium cursors
     */
    setupPremiumCursors() {
        // Premium Select Cursor
        this.cursors.set(PREMIUM_CURSOR_TYPES.SELECT_PREMIUM, {
            type: PREMIUM_CURSOR_TYPES.SELECT_PREMIUM,
            name: 'Premium Select',
            css: 'pointer',
            svg: createPremiumSelectCursorSVG(),
            priority: 80,
            states: [CURSOR_STATES.IDLE, CURSOR_STATES.HOVER, CURSOR_STATES.ACTIVE, CURSOR_STATES.PRESSING, CURSOR_STATES.DRAGGING, CURSOR_STATES.SELECTING, CURSOR_STATES.MULTI_SELECTING],
            animations: [CURSOR_ANIMATIONS.FADE_IN, CURSOR_ANIMATIONS.PULSE],
            glow: true,
            shadow: true,
            particle: false
        });
        
        // Premium Paint Cursor
        this.cursors.set(PREMIUM_CURSOR_TYPES.PAINT_PREMIUM, {
            type: PREMIUM_CURSOR_TYPES.PAINT_PREMIUM,
            name: 'Premium Paint',
            css: 'crosshair',
            svg: createPremiumPaintCursorSVG(),
            priority: 90,
            states: [CURSOR_STATES.IDLE, CURSOR_STATES.HOVER, CURSOR_STATES.ACTIVE, CURSOR_STATES.PRESSING, CURSOR_STATES.DRAGGING, CURSOR_STATES.SELECTING],
            animations: [CURSOR_ANIMATIONS.SCALE_IN, CURSOR_ANIMATIONS.GLOW],
            glow: true,
            shadow: true,
            particle: true
        });
        
        // Premium Erase Cursor
        this.cursors.set(PREMIUM_CURSOR_TYPES.ERASE_PREMIUM, {
            type: PREMIUM_CURSOR_TYPES.ERASE_PREMIUM,
            name: 'Premium Erase',
            css: 'not-allowed',
            svg: createPremiumEraseCursorSVG(),
            priority: 90,
            states: [CURSOR_STATES.IDLE, CURSOR_STATES.HOVER, CURSOR_STATES.ACTIVE, CURSOR_STATES.PRESSING, CURSOR_STATES.DRAGGING, CURSOR_STATES.SELECTING],
            animations: [CURSOR_ANIMATIONS.BOUNCE_IN, CURSOR_ANIMATIONS.SHAKE],
            glow: true,
            shadow: true,
            particle: false
        });
        
        // Premium Resize Cursors
        this.setupPremiumResizeCursors();
        
        // Premium Multi-Note Cursors
        this.setupPremiumMultiNoteCursors();
        
        // Premium Special Cursors
        this.setupPremiumSpecialCursors();
    }
    
    /**
     * Setup premium resize cursors
     */
    setupPremiumResizeCursors() {
        const resizeCursors = [
            { type: PREMIUM_CURSOR_TYPES.RESIZE_LEFT_PREMIUM, name: 'Resize Left', direction: 'left' },
            { type: PREMIUM_CURSOR_TYPES.RESIZE_RIGHT_PREMIUM, name: 'Resize Right', direction: 'right' },
            { type: PREMIUM_CURSOR_TYPES.RESIZE_UP_PREMIUM, name: 'Resize Up', direction: 'up' },
            { type: PREMIUM_CURSOR_TYPES.RESIZE_DOWN_PREMIUM, name: 'Resize Down', direction: 'down' },
            { type: PREMIUM_CURSOR_TYPES.RESIZE_UP_LEFT_PREMIUM, name: 'Resize Up-Left', direction: 'up-left' },
            { type: PREMIUM_CURSOR_TYPES.RESIZE_UP_RIGHT_PREMIUM, name: 'Resize Up-Right', direction: 'up-right' },
            { type: PREMIUM_CURSOR_TYPES.RESIZE_DOWN_LEFT_PREMIUM, name: 'Resize Down-Left', direction: 'down-left' },
            { type: PREMIUM_CURSOR_TYPES.RESIZE_DOWN_RIGHT_PREMIUM, name: 'Resize Down-Right', direction: 'down-right' },
            { type: PREMIUM_CURSOR_TYPES.RESIZE_BOTH_PREMIUM, name: 'Resize Both', direction: 'both' }
        ];
        
        resizeCursors.forEach(({ type, name, direction }) => {
            this.cursors.set(type, {
                type,
                name,
                css: this.getResizeCursorCSS(direction),
                svg: createPremiumResizeCursorSVG(direction),
                priority: 95,
                states: [CURSOR_STATES.IDLE, CURSOR_STATES.HOVER, CURSOR_STATES.ACTIVE, CURSOR_STATES.PRESSING, CURSOR_STATES.RESIZING, CURSOR_STATES.DRAGGING],
                animations: [CURSOR_ANIMATIONS.SCALE_IN, CURSOR_ANIMATIONS.PULSE],
                glow: true,
                shadow: true,
                particle: false,
                resize: {
                    direction,
                    handles: this.getResizeHandles(direction)
                }
            });
        });
    }
    
    /**
     * Setup premium multi-note cursors
     */
    setupPremiumMultiNoteCursors() {
        const multiNoteCursors = [
            { type: PREMIUM_CURSOR_TYPES.MULTI_SELECT_PREMIUM, name: 'Multi Select', operation: 'select' },
            { type: PREMIUM_CURSOR_TYPES.MULTI_RESIZE_PREMIUM, name: 'Multi Resize', operation: 'resize' },
            { type: PREMIUM_CURSOR_TYPES.MULTI_MOVE_PREMIUM, name: 'Multi Move', operation: 'move' },
            { type: PREMIUM_CURSOR_TYPES.MULTI_ROTATE_PREMIUM, name: 'Multi Rotate', operation: 'rotate' }
        ];
        
        multiNoteCursors.forEach(({ type, name, operation }) => {
            this.cursors.set(type, {
                type,
                name,
                css: 'grab',
                svg: createPremiumMultiNoteCursorSVG(operation),
                priority: 85,
                states: [CURSOR_STATES.MULTI_SELECTING, CURSOR_STATES.MULTI_RESIZING, CURSOR_STATES.MULTI_MOVING, CURSOR_STATES.MULTI_ROTATING],
                animations: [CURSOR_ANIMATIONS.ELASTIC_IN, CURSOR_ANIMATIONS.GLOW],
                glow: true,
                shadow: true,
                particle: true,
                multiNote: {
                    operation,
                    handles: this.getMultiNoteHandles(operation)
                }
            });
        });
    }
    
    /**
     * Setup premium special cursors
     */
    setupPremiumSpecialCursors() {
        const specialCursors = [
            { type: PREMIUM_CURSOR_TYPES.MAGNETIC_PREMIUM, name: 'Magnetic', effect: 'magnetic' },
            { type: PREMIUM_CURSOR_TYPES.SNAP_PREMIUM, name: 'Snap', effect: 'snap' },
            { type: PREMIUM_CURSOR_TYPES.GRID_PREMIUM, name: 'Grid', effect: 'grid' },
            { type: PREMIUM_CURSOR_TYPES.RULER_PREMIUM, name: 'Ruler', effect: 'ruler' },
            { type: PREMIUM_CURSOR_TYPES.PENCIL_PREMIUM, name: 'Pencil', effect: 'pencil' },
            { type: PREMIUM_CURSOR_TYPES.BRUSH_PREMIUM, name: 'Brush', effect: 'brush' },
            { type: PREMIUM_CURSOR_TYPES.ERASER_PREMIUM, name: 'Eraser', effect: 'eraser' },
            { type: PREMIUM_CURSOR_TYPES.EYEDROPPER_PREMIUM, name: 'Eyedropper', effect: 'eyedropper' },
            { type: PREMIUM_CURSOR_TYPES.MAGNIFIER_PREMIUM, name: 'Magnifier', effect: 'magnifier' },
            { type: PREMIUM_CURSOR_TYPES.WARP_PREMIUM, name: 'Warp', effect: 'warp' },
            { type: PREMIUM_CURSOR_TYPES.BEND_PREMIUM, name: 'Bend', effect: 'bend' },
            { type: PREMIUM_CURSOR_TYPES.VELOCITY_PREMIUM, name: 'Velocity', effect: 'velocity' },
            { type: PREMIUM_CURSOR_TYPES.DURATION_PREMIUM, name: 'Duration', effect: 'duration' },
            { type: PREMIUM_CURSOR_TYPES.PITCH_PREMIUM, name: 'Pitch', effect: 'pitch' }
        ];
        
        specialCursors.forEach(({ type, name, effect }) => {
            this.cursors.set(type, {
                type,
                name,
                css: this.getSpecialCursorCSS(effect),
                svg: createPremiumSpecialCursorSVG(effect),
                priority: 70,
                states: [CURSOR_STATES.IDLE, CURSOR_STATES.ACTIVE],
                animations: [CURSOR_ANIMATIONS.FADE_IN, CURSOR_ANIMATIONS.PULSE],
                glow: true,
                shadow: true,
                particle: effect === 'magnetic' || effect === 'warp',
                special: {
                    effect,
                    properties: this.getSpecialCursorProperties(effect)
                }
            });
        });
        
        // Tool change cursor
        this.cursors.set(PREMIUM_CURSOR_TYPES.TOOL_CHANGED_PREMIUM, {
            type: PREMIUM_CURSOR_TYPES.TOOL_CHANGED_PREMIUM,
            name: 'Tool Changed',
            css: 'pointer',
            svg: createPremiumSelectCursorSVG(), // Use select cursor as fallback
            priority: 60,
            states: [CURSOR_STATES.IDLE, CURSOR_STATES.HOVER, CURSOR_STATES.ACTIVE],
            animations: [CURSOR_ANIMATIONS.FADE_IN, CURSOR_ANIMATIONS.PULSE],
            glow: true,
            shadow: false,
            particle: false
        });
    }
    
    /**
     * Setup resize system
     */
    setupResizeSystem() {
        this.resizeSystem = {
            // Start resize operation
            start: (notes, handle, position, options = {}) => {
                this.state.resizeState.isResizing = true;
                this.state.resizeState.mode = options.mode || RESIZE_MODES.SINGLE;
                this.state.resizeState.handles.add(handle);
                this.state.resizeState.startPosition = position;
                this.state.resizeState.currentPosition = position;
                
                // Store original sizes
                notes.forEach(note => {
                    this.state.resizeState.originalSizes.set(note.id, {
                        startTime: note.startTime,
                        length: note.length,
                        pitch: note.pitch
                    });
                });
                
                // Set constraints
                this.state.resizeState.constraints = this.calculateResizeConstraints(notes, handle);
                
                // Set snap points
                this.state.resizeState.snapPoints = this.calculateSnapPoints(notes);
                
                // Set magnetic points
                this.state.resizeState.magneticPoints = this.calculateMagneticPoints(notes);
                
                this.emit('resizeStart', { notes, handle, position, options });
            },
            
            // Update resize operation
            update: (position, options = {}) => {
                if (!this.state.resizeState.isResizing) return;
                
                this.state.resizeState.currentPosition = position;
                
                // Calculate new sizes
                const newSizes = this.calculateNewSizes(position, options);
                
                // Apply constraints
                const constrainedSizes = this.applyResizeConstraints(newSizes);
                
                // Apply snap
                const snappedSizes = this.applySnap(constrainedSizes);
                
                // Apply magnetic
                const magneticSizes = this.applyMagnetic(snappedSizes);
                
                this.emit('resizeUpdate', { position, sizes: magneticSizes, options });
            },
            
            // End resize operation
            end: (position, options = {}) => {
                if (!this.state.resizeState.isResizing) return;
                
                const finalSizes = this.calculateNewSizes(position, options);
                const constrainedSizes = this.applyResizeConstraints(finalSizes);
                const snappedSizes = this.applySnap(constrainedSizes);
                const magneticSizes = this.applyMagnetic(snappedSizes);
                
                this.state.resizeState.isResizing = false;
                this.state.resizeState.handles.clear();
                this.state.resizeState.originalSizes.clear();
                this.state.resizeState.constraints = null;
                this.state.resizeState.snapPoints = [];
                this.state.resizeState.magneticPoints = [];
                
                this.emit('resizeEnd', { position, sizes: magneticSizes, options });
            },
            
            // Cancel resize operation
            cancel: () => {
                this.state.resizeState.isResizing = false;
                this.state.resizeState.handles.clear();
                this.state.resizeState.originalSizes.clear();
                this.state.resizeState.constraints = null;
                this.state.resizeState.snapPoints = [];
                this.state.resizeState.magneticPoints = [];
                
                this.emit('resizeCancel');
            }
        };
    }
    
    /**
     * Setup multi-note system
     */
    setupMultiNoteSystem() {
        this.multiNoteSystem = {
            // Start multi-note operation
            start: (notes, operation, position, options = {}) => {
                this.state.multiNoteState.isActive = true;
                this.state.multiNoteState.selectedNotes = new Set(notes.map(n => n.id));
                this.state.multiNoteState.groupBounds = this.calculateGroupBounds(notes);
                this.state.multiNoteState.transformOrigin = this.calculateTransformOrigin(notes);
                this.state.multiNoteState.transformMatrix = [1, 0, 0, 1, 0, 0];
                
                this.emit('multiNoteStart', { notes, operation, position, options });
            },
            
            // Update multi-note operation
            update: (position, options = {}) => {
                if (!this.state.multiNoteState.isActive) return;
                
                const transform = this.calculateTransform(position, options);
                this.state.multiNoteState.transformMatrix = transform.matrix;
                
                this.emit('multiNoteUpdate', { position, transform, options });
            },
            
            // End multi-note operation
            end: (position, options = {}) => {
                if (!this.state.multiNoteState.isActive) return;
                
                const transform = this.calculateTransform(position, options);
                
                this.state.multiNoteState.isActive = false;
                this.state.multiNoteState.selectedNotes.clear();
                this.state.multiNoteState.groupBounds = null;
                this.state.multiNoteState.transformOrigin = null;
                this.state.multiNoteState.transformMatrix = [1, 0, 0, 1, 0, 0];
                
                this.emit('multiNoteEnd', { position, transform, options });
            },
            
            // Cancel multi-note operation
            cancel: () => {
                this.state.multiNoteState.isActive = false;
                this.state.multiNoteState.selectedNotes.clear();
                this.state.multiNoteState.groupBounds = null;
                this.state.multiNoteState.transformOrigin = null;
                this.state.multiNoteState.transformMatrix = [1, 0, 0, 1, 0, 0];
                
                this.emit('multiNoteCancel');
            }
        };
    }
    
    /**
     * Setup animation system
     */
    setupAnimationSystem() {
        this.animationSystem = {
            // Animation queue
            queue: [],
            processing: false,
            
            // Add animation
            add: (animation) => {
                this.animationSystem.queue.push(animation);
                this.processAnimations();
            },
            
            // Process animations
            process: () => {
                if (this.animationSystem.processing) return;
                
                this.animationSystem.processing = true;
                this.processAnimationFrame();
            },
            
            // Process single frame
            processFrame: () => {
                const now = performance.now();
                const deltaTime = now - this.state.lastUpdate;
                
                // Update performance metrics
                this.state.frameCount++;
                this.state.averageFrameTime = 
                    (this.state.averageFrameTime * 0.9) + (deltaTime * 0.1);
                
                this.state.lastUpdate = now;
                
                // Process animation queue
                this.processAnimationQueue();
                
                // Continue processing
                if (this.animationSystem.queue.length > 0) {
                    this.state.animationId = requestAnimationFrame(() => this.processFrame());
                } else {
                    this.animationSystem.processing = false;
                }
            }
        };
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor frame rate
        const monitor = () => {
            const now = performance.now();
            const deltaTime = now - this.state.lastUpdate;
            
            this.state.frameCount++;
            this.state.averageFrameTime = 
                (this.state.averageFrameTime * 0.9) + (deltaTime * 0.1);
            
            // Check for dropped frames
            if (deltaTime > 20) {
                this.state.droppedFrames++;
            }
            
            this.state.lastUpdate = now;
            
            // Emit performance update
            this.emit('performanceUpdate', {
                frameRate: Math.round(1000 / this.state.averageFrameTime),
                averageFrameTime: this.state.averageFrameTime,
                droppedFrames: this.state.droppedFrames
            });
        };
        
        // Start monitoring
        const monitorLoop = () => {
            monitor();
            requestAnimationFrame(monitorLoop);
        };
        
        requestAnimationFrame(monitorLoop);
    }
    
    /**
     * Setup accessibility features
     */
    setupAccessibility() {
        // Check for reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.config.accessibility.reducedMotion = true;
        }
        
        // Check for high contrast preference
        if (window.matchMedia('(prefers-contrast: high)').matches) {
            this.config.accessibility.highContrast = true;
        }
        
        // Check for large cursor preference
        if (window.matchMedia('(prefers-large-cursors: large)').matches) {
            this.config.accessibility.largeCursors = true;
        }
        
        // Listen for preference changes
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            this.config.accessibility.reducedMotion = e.matches;
        });
        
        window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
            this.config.accessibility.highContrast = e.matches;
        });
        
        window.matchMedia('(prefers-large-cursors: large)').addEventListener('change', (e) => {
            this.config.accessibility.largeCursors = e.matches;
        });
    }
    
    /**
     * Set premium cursor
     */
    setCursor(type, state = CURSOR_STATES.IDLE, options = {}) {
        // Validate cursor type
        if (!type || type === 'undefined') {
            console.warn('⚠️ Invalid cursor type:', type);
            return;
        }
        
        // ✅ Validate and fix state - ensure it's a string, not a number
        if (typeof state === 'number' || !state) {
            state = CURSOR_STATES.IDLE; // Use default if number or invalid
        }
        
        const cursor = this.cursors.get(type);
        if (!cursor) {
            console.warn(`Premium cursor type not found: ${type}`);
            // Use fallback cursor
            const fallbackCursor = this.cursors.get(PREMIUM_CURSOR_TYPES.SELECT_PREMIUM);
            if (fallbackCursor) {
                this.state.current = PREMIUM_CURSOR_TYPES.SELECT_PREMIUM;
                this.applyCursor(fallbackCursor);
            }
            return;
        }
        
        // Check if cursor supports the state
        if (!cursor.states.includes(state)) {
            console.warn(`Cursor ${type} does not support state: ${state} (available states: ${cursor.states.join(', ')})`);
            // Use default state instead of adding unknown state
            state = CURSOR_STATES.IDLE;
        }
        
        // Update state
        this.state.previous = this.state.current;
        this.state.current = type;
        this.state.state = state;
        
        // Add to history
        this.addToHistory(type, state);
        
        // Apply premium cursor
        this.applyPremiumCursor(cursor, state, options);
        
        // Emit change event
        this.emit('cursorChange', {
            type,
            state,
            previous: this.state.previous,
            options
        });
    }
    
    /**
     * Apply premium cursor to DOM
     */
    applyPremiumCursor(cursor, state, options) {
        const element = options.element || document.body;
        
        // Remove previous cursor classes
        element.classList.remove(...Object.values(PREMIUM_CURSOR_TYPES));
        element.classList.remove(...Object.values(CURSOR_STATES));
        
        // Add new cursor classes
        element.classList.add(cursor.type);
        element.classList.add(state);
        
        // Apply CSS cursor
        if (cursor.css) {
            element.style.cursor = cursor.css;
        }
        
        // Apply premium cursor
        if (cursor.svg) {
            this.applyPremiumCursorElement(element, cursor, state, options);
        }
        
        // Apply animations
        if (options.animation) {
            this.animatePremiumCursor(cursor, state, options.animation);
        }
    }
    
    /**
     * Apply premium cursor element
     */
    applyPremiumCursorElement(element, cursor, state, options) {
        // Create premium cursor element
        const cursorElement = document.createElement('div');
        cursorElement.className = `premium-cursor ${cursor.type} ${state}`;
        cursorElement.innerHTML = cursor.svg;
        
        // Apply premium styles
        this.applyPremiumStyles(cursorElement, cursor, state, options);
        
        // Add to DOM
        element.appendChild(cursorElement);
        
        // Remove after animation
        setTimeout(() => {
            if (cursorElement.parentNode) {
                cursorElement.parentNode.removeChild(cursorElement);
            }
        }, this.config.animation.duration);
    }
    
    /**
     * Apply premium styles
     */
    applyPremiumStyles(element, cursor, state, options) {
        const { visual, premium } = this.config;
        
        // Base styles
        element.style.position = 'fixed';
        element.style.pointerEvents = 'none';
        element.style.zIndex = '9999';
        element.style.transform = `scale(${visual.scale})`;
        element.style.opacity = visual.opacity;
        element.style.color = visual.color;
        element.style.borderRadius = `${visual.borderRadius}px`;
        
        // Premium effects
        if (premium.glowEffect) {
            element.style.filter = `drop-shadow(0 0 8px ${visual.glowColor})`;
        }
        
        if (premium.shadowEffect) {
            element.style.boxShadow = `0 4px 12px ${visual.shadowColor}`;
        }
        
        if (premium.backdropBlur) {
            element.style.backdropFilter = `blur(${visual.backdropBlur}px)`;
        }
        
        // State-specific styles
        switch (state) {
            case CURSOR_STATES.HOVER:
                element.style.transform += ' scale(1.1)';
                element.style.opacity = '0.9';
                break;
            case CURSOR_STATES.ACTIVE:
                element.style.transform += ' scale(1.2)';
                element.style.opacity = '1.0';
                break;
            case CURSOR_STATES.PRESSING:
                element.style.transform += ' scale(0.95)';
                element.style.opacity = '0.8';
                break;
            case CURSOR_STATES.DRAGGING:
                element.style.transform += ' scale(1.15)';
                element.style.opacity = '0.9';
                break;
            case CURSOR_STATES.RESIZING:
                element.style.transform += ' scale(1.1)';
                element.style.opacity = '0.8';
                break;
        }
        
        // Animation styles
        if (options.animation) {
            element.style.transition = `all ${this.config.animation.duration}ms ${this.config.animation.easing}`;
        }
    }
    
    /**
     * Animate premium cursor
     */
    animatePremiumCursor(cursor, state, animation) {
        const animationData = {
            cursor,
            state,
            animation,
            startTime: performance.now(),
            duration: this.config.animation.duration
        };
        
        this.animationSystem.add(animationData);
    }
    
    /**
     * Start multi-note resize
     */
    startMultiNoteResize(notes, handle, position, options = {}) {
        if (!this.config.resize.multiResize) {
            console.warn('Multi-note resize is disabled');
            return;
        }
        
        this.resizeSystem.start(notes, handle, position, {
            ...options,
            mode: RESIZE_MODES.MULTI
        });
        
        // Set multi-resize cursor
        this.setCursor(PREMIUM_CURSOR_TYPES.MULTI_RESIZE_PREMIUM, CURSOR_STATES.MULTI_RESIZING);
    }
    
    /**
     * Update multi-note resize
     */
    updateMultiNoteResize(position, options = {}) {
        this.resizeSystem.update(position, options);
    }
    
    /**
     * End multi-note resize
     */
    endMultiNoteResize(position, options = {}) {
        this.resizeSystem.end(position, options);
        
        // Reset cursor
        this.setCursor(PREMIUM_CURSOR_TYPES.SELECT_PREMIUM, CURSOR_STATES.IDLE);
    }
    
    /**
     * Calculate resize constraints
     */
    calculateResizeConstraints(notes, handle) {
        const constraints = {
            minWidth: this.config.resize.minSize,
            maxWidth: this.config.resize.maxSize,
            minHeight: this.config.resize.minSize,
            maxHeight: this.config.resize.maxSize,
            aspectRatio: null,
            snapPoints: []
        };
        
        // Calculate group bounds
        const groupBounds = this.calculateGroupBounds(notes);
        
        // Set constraints based on handle
        switch (handle) {
            case RESIZE_HANDLES.LEFT:
            case RESIZE_HANDLES.RIGHT:
                constraints.minWidth = Math.max(constraints.minWidth, groupBounds.width * 0.1);
                constraints.maxWidth = Math.min(constraints.maxWidth, groupBounds.width * 10);
                break;
            case RESIZE_HANDLES.TOP:
            case RESIZE_HANDLES.BOTTOM:
                constraints.minHeight = Math.max(constraints.minHeight, groupBounds.height * 0.1);
                constraints.maxHeight = Math.min(constraints.maxHeight, groupBounds.height * 10);
                break;
            case RESIZE_HANDLES.ALL:
                constraints.minWidth = Math.max(constraints.minWidth, groupBounds.width * 0.1);
                constraints.maxWidth = Math.min(constraints.maxWidth, groupBounds.width * 10);
                constraints.minHeight = Math.max(constraints.minHeight, groupBounds.height * 0.1);
                constraints.maxHeight = Math.min(constraints.maxHeight, groupBounds.height * 10);
                break;
        }
        
        return constraints;
    }
    
    /**
     * Calculate snap points
     */
    calculateSnapPoints(notes) {
        if (!this.config.resize.gridSnap) return [];
        
        const snapPoints = [];
        const gridSize = 1; // 1 step grid
        
        // Calculate group bounds
        const groupBounds = this.calculateGroupBounds(notes);
        
        // Add grid snap points
        for (let x = 0; x < groupBounds.width + 20; x += gridSize) {
            snapPoints.push({ x: groupBounds.x + x, y: groupBounds.y, type: 'vertical' });
            snapPoints.push({ x: groupBounds.x + x, y: groupBounds.y + groupBounds.height, type: 'vertical' });
        }
        
        for (let y = 0; y < groupBounds.height + 20; y += gridSize) {
            snapPoints.push({ x: groupBounds.x, y: groupBounds.y + y, type: 'horizontal' });
            snapPoints.push({ x: groupBounds.x + groupBounds.width, y: groupBounds.y + y, type: 'horizontal' });
        }
        
        return snapPoints;
    }
    
    /**
     * Calculate magnetic points
     */
    calculateMagneticPoints(notes) {
        if (!this.config.resize.magneticSnap) return [];
        
        const magneticPoints = [];
        const threshold = this.config.resize.snapThreshold;
        
        // Add magnetic points for other notes
        notes.forEach(note => {
            magneticPoints.push({
                x: note.startTime,
                y: note.pitch,
                type: 'note',
                strength: 0.8
            });
            magneticPoints.push({
                x: note.startTime + note.length,
                y: note.pitch,
                type: 'note',
                strength: 0.8
            });
        });
        
        return magneticPoints;
    }
    
    /**
     * Calculate new sizes
     */
    calculateNewSizes(position, options) {
        const { resizeState } = this.state;
        const newSizes = new Map();
        
        resizeState.originalSizes.forEach((original, noteId) => {
            const deltaX = position.x - resizeState.startPosition.x;
            const deltaY = position.y - resizeState.startPosition.y;
            
            let newSize = { ...original };
            
            // Apply resize based on handles
            resizeState.handles.forEach(handle => {
                switch (handle) {
                    case RESIZE_HANDLES.LEFT:
                        newSize.startTime = original.startTime + deltaX;
                        newSize.length = original.length - deltaX;
                        break;
                    case RESIZE_HANDLES.RIGHT:
                        newSize.length = original.length + deltaX;
                        break;
                    case RESIZE_HANDLES.TOP:
                        newSize.pitch = original.pitch + deltaY;
                        break;
                    case RESIZE_HANDLES.BOTTOM:
                        newSize.pitch = original.pitch + deltaY;
                        break;
                    case RESIZE_HANDLES.ALL:
                        newSize.startTime = original.startTime + deltaX;
                        newSize.length = original.length + deltaX;
                        newSize.pitch = original.pitch + deltaY;
                        break;
                }
            });
            
            newSizes.set(noteId, newSize);
        });
        
        return newSizes;
    }
    
    /**
     * Apply resize constraints
     */
    applyResizeConstraints(sizes) {
        const { constraints } = this.state.resizeState;
        if (!constraints) return sizes;
        
        const constrainedSizes = new Map();
        
        sizes.forEach((size, noteId) => {
            let constrainedSize = { ...size };
            
            // Apply width constraints
            if (size.length < constraints.minWidth) {
                constrainedSize.length = constraints.minWidth;
            } else if (size.length > constraints.maxWidth) {
                constrainedSize.length = constraints.maxWidth;
            }
            
            // Apply height constraints
            if (size.pitch < constraints.minHeight) {
                constrainedSize.pitch = constraints.minHeight;
            } else if (size.pitch > constraints.maxHeight) {
                constrainedSize.pitch = constraints.maxHeight;
            }
            
            constrainedSizes.set(noteId, constrainedSize);
        });
        
        return constrainedSizes;
    }
    
    /**
     * Apply snap
     */
    applySnap(sizes) {
        const { snapPoints } = this.state.resizeState;
        if (!snapPoints.length) return sizes;
        
        const snappedSizes = new Map();
        const threshold = this.config.resize.snapThreshold;
        
        sizes.forEach((size, noteId) => {
            let snappedSize = { ...size };
            
            // Find closest snap points
            const closestSnapX = this.findClosestSnapPoint(size.startTime, snapPoints.filter(p => p.type === 'vertical'));
            const closestSnapY = this.findClosestSnapPoint(size.pitch, snapPoints.filter(p => p.type === 'horizontal'));
            
            // Apply snap if within threshold
            if (closestSnapX && Math.abs(size.startTime - closestSnapX.x) < threshold) {
                snappedSize.startTime = closestSnapX.x;
            }
            
            if (closestSnapY && Math.abs(size.pitch - closestSnapY.y) < threshold) {
                snappedSize.pitch = closestSnapY.y;
            }
            
            snappedSizes.set(noteId, snappedSize);
        });
        
        return snappedSizes;
    }
    
    /**
     * Apply magnetic
     */
    applyMagnetic(sizes) {
        const { magneticPoints } = this.state.resizeState;
        if (!magneticPoints.length) return sizes;
        
        const magneticSizes = new Map();
        const threshold = this.config.resize.snapThreshold;
        
        sizes.forEach((size, noteId) => {
            let magneticSize = { ...size };
            
            // Find closest magnetic points
            const closestMagneticX = this.findClosestMagneticPoint(size.startTime, magneticPoints, 'x');
            const closestMagneticY = this.findClosestMagneticPoint(size.pitch, magneticPoints, 'y');
            
            // Apply magnetic if within threshold
            if (closestMagneticX && Math.abs(size.startTime - closestMagneticX.x) < threshold) {
                const strength = closestMagneticX.strength || 0.5;
                magneticSize.startTime = size.startTime + (closestMagneticX.x - size.startTime) * strength;
            }
            
            if (closestMagneticY && Math.abs(size.pitch - closestMagneticY.y) < threshold) {
                const strength = closestMagneticY.strength || 0.5;
                magneticSize.pitch = size.pitch + (closestMagneticY.y - size.pitch) * strength;
            }
            
            magneticSizes.set(noteId, magneticSize);
        });
        
        return magneticSizes;
    }
    
    /**
     * Find closest snap point
     */
    findClosestSnapPoint(value, points) {
        if (!points.length) return null;
        
        let closest = null;
        let minDistance = Infinity;
        
        points.forEach(point => {
            const distance = Math.abs(value - point.x);
            if (distance < minDistance) {
                minDistance = distance;
                closest = point;
            }
        });
        
        return closest;
    }
    
    /**
     * Find closest magnetic point
     */
    findClosestMagneticPoint(value, points, axis) {
        if (!points.length) return null;
        
        let closest = null;
        let minDistance = Infinity;
        
        points.forEach(point => {
            const distance = Math.abs(value - point[axis]);
            if (distance < minDistance) {
                minDistance = distance;
                closest = point;
            }
        });
        
        return closest;
    }
    
    /**
     * Calculate group bounds
     */
    calculateGroupBounds(notes) {
        if (!notes.length) return { x: 0, y: 0, width: 0, height: 0 };
        
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        notes.forEach(note => {
            minX = Math.min(minX, note.startTime);
            maxX = Math.max(maxX, note.startTime + note.length);
            minY = Math.min(minY, note.pitch);
            maxY = Math.max(maxY, note.pitch);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    /**
     * Calculate transform origin
     */
    calculateTransformOrigin(notes) {
        const bounds = this.calculateGroupBounds(notes);
        return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2
        };
    }
    
    /**
     * Calculate transform
     */
    calculateTransform(position, options) {
        const { multiNoteState } = this.state;
        const { transformOrigin } = multiNoteState;
        
        if (!transformOrigin) return { matrix: [1, 0, 0, 1, 0, 0] };
        
        const deltaX = position.x - transformOrigin.x;
        const deltaY = position.y - transformOrigin.y;
        
        return {
            matrix: [1, 0, 0, 1, deltaX, deltaY],
            translation: { x: deltaX, y: deltaY },
            rotation: 0,
            scale: { x: 1, y: 1 }
        };
    }
    
    /**
     * Get resize cursor CSS
     */
    getResizeCursorCSS(direction) {
        const cssMap = {
            'left': 'w-resize',
            'right': 'e-resize',
            'up': 'n-resize',
            'down': 's-resize',
            'up-left': 'nw-resize',
            'up-right': 'ne-resize',
            'down-left': 'sw-resize',
            'down-right': 'se-resize',
            'both': 'nw-resize'
        };
        
        return cssMap[direction] || 'default';
    }
    
    /**
     * Get resize handles
     */
    getResizeHandles(direction) {
        const handleMap = {
            'left': [RESIZE_HANDLES.LEFT],
            'right': [RESIZE_HANDLES.RIGHT],
            'up': [RESIZE_HANDLES.TOP],
            'down': [RESIZE_HANDLES.BOTTOM],
            'up-left': [RESIZE_HANDLES.TOP_LEFT],
            'up-right': [RESIZE_HANDLES.TOP_RIGHT],
            'down-left': [RESIZE_HANDLES.BOTTOM_LEFT],
            'down-right': [RESIZE_HANDLES.BOTTOM_RIGHT],
            'both': [RESIZE_HANDLES.ALL]
        };
        
        return handleMap[direction] || [];
    }
    
    /**
     * Get multi-note handles
     */
    getMultiNoteHandles(operation) {
        const handleMap = {
            'select': [RESIZE_HANDLES.ALL],
            'resize': [RESIZE_HANDLES.LEFT, RESIZE_HANDLES.RIGHT, RESIZE_HANDLES.TOP, RESIZE_HANDLES.BOTTOM, RESIZE_HANDLES.ALL],
            'move': [RESIZE_HANDLES.ALL],
            'rotate': [RESIZE_HANDLES.ALL]
        };
        
        return handleMap[operation] || [];
    }
    
    /**
     * Get special cursor CSS
     */
    getSpecialCursorCSS(effect) {
        const cssMap = {
            'magnetic': 'crosshair',
            'snap': 'crosshair',
            'grid': 'crosshair',
            'ruler': 'crosshair',
            'pencil': 'crosshair',
            'brush': 'crosshair',
            'eraser': 'not-allowed',
            'eyedropper': 'crosshair',
            'magnifier': 'zoom-in',
            'warp': 'grab',
            'bend': 'grab',
            'velocity': 'ns-resize',
            'duration': 'ew-resize',
            'pitch': 'ns-resize'
        };
        
        return cssMap[effect] || 'default';
    }
    
    /**
     * Get special cursor properties
     */
    getSpecialCursorProperties(effect) {
        const propertiesMap = {
            'magnetic': { strength: 0.8, range: 20 },
            'snap': { strength: 1.0, range: 10 },
            'grid': { size: 1, visible: true },
            'ruler': { units: 'steps', visible: true },
            'pencil': { size: 1, pressure: 1.0 },
            'brush': { size: 2, pressure: 0.8 },
            'eraser': { size: 3, pressure: 1.0 },
            'eyedropper': { sampleSize: 1, alpha: true },
            'magnifier': { zoom: 2.0, visible: true },
            'warp': { strength: 0.5, range: 50 },
            'bend': { strength: 0.3, range: 30 },
            'velocity': { min: 1, max: 127, default: 100 },
            'duration': { min: 0.25, max: 16, default: 1 },
            'pitch': { min: 0, max: 127, default: 60 }
        };
        
        return propertiesMap[effect] || {};
    }
    
    /**
     * Add to history
     */
    addToHistory(type, state) {
        this.state.history.push({
            type,
            state,
            timestamp: Date.now()
        });
        
        // Keep only last N entries
        if (this.state.history.length > this.state.maxHistory) {
            this.state.history.shift();
        }
    }
    
    /**
     * Process animation queue
     */
    processAnimationQueue() {
        if (this.state.animationQueue.length === 0) return;
        
        const animation = this.state.animationQueue.shift();
        this.executeAnimation(animation);
    }
    
    /**
     * Execute animation
     */
    executeAnimation(animation) {
        const { cursor, state, animation: animationType, startTime, duration } = animation;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Apply animation
            this.applyAnimation(cursor, state, animationType, progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    /**
     * Apply animation
     */
    applyAnimation(cursor, state, animationType, progress) {
        // Animation logic based on type
        switch (animationType) {
            case CURSOR_ANIMATIONS.FADE_IN:
                this.applyFadeIn(cursor, progress);
                break;
            case CURSOR_ANIMATIONS.FADE_OUT:
                this.applyFadeOut(cursor, progress);
                break;
            case CURSOR_ANIMATIONS.SCALE_IN:
                this.applyScaleIn(cursor, progress);
                break;
            case CURSOR_ANIMATIONS.SCALE_OUT:
                this.applyScaleOut(cursor, progress);
                break;
            case CURSOR_ANIMATIONS.PULSE:
                this.applyPulse(cursor, progress);
                break;
            case CURSOR_ANIMATIONS.GLOW:
                this.applyGlow(cursor, progress);
                break;
            case CURSOR_ANIMATIONS.SHAKE:
                this.applyShake(cursor, progress);
                break;
            case CURSOR_ANIMATIONS.BOUNCE:
                this.applyBounce(cursor, progress);
                break;
            case CURSOR_ANIMATIONS.ELASTIC:
                this.applyElastic(cursor, progress);
                break;
        }
    }
    
    /**
     * Apply fade in animation
     */
    applyFadeIn(cursor, progress) {
        // Fade in logic
    }
    
    /**
     * Apply fade out animation
     */
    applyFadeOut(cursor, progress) {
        // Fade out logic
    }
    
    /**
     * Apply scale in animation
     */
    applyScaleIn(cursor, progress) {
        // Scale in logic
    }
    
    /**
     * Apply scale out animation
     */
    applyScaleOut(cursor, progress) {
        // Scale out logic
    }
    
    /**
     * Apply pulse animation
     */
    applyPulse(cursor, progress) {
        // Pulse logic
    }
    
    /**
     * Apply glow animation
     */
    applyGlow(cursor, progress) {
        // Glow logic
    }
    
    /**
     * Apply shake animation
     */
    applyShake(cursor, progress) {
        // Shake logic
    }
    
    /**
     * Apply bounce animation
     */
    applyBounce(cursor, progress) {
        // Bounce logic
    }
    
    /**
     * Apply elastic animation
     */
    applyElastic(cursor, progress) {
        // Elastic logic
    }
    
    /**
     * Reset cursor to default
     */
    reset() {
        this.setCursor(PREMIUM_CURSOR_TYPES.SELECT_PREMIUM, CURSOR_STATES.IDLE);
    }
    
    /**
     * Get current cursor
     */
    getCurrent() {
        return {
            type: this.state.current,
            state: this.state.state,
            previous: this.state.previous
        };
    }
    
    /**
     * Get cursor history
     */
    getHistory() {
        return [...this.state.history];
    }
    
    /**
     * Add custom cursor
     */
    addCustomCursor(type, definition) {
        this.cursors.set(type, definition);
        this.emit('customCursorAdded', { type, definition });
    }
    
    /**
     * Remove custom cursor
     */
    removeCustomCursor(type) {
        this.cursors.delete(type);
        this.emit('customCursorRemoved', { type });
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            frameRate: Math.round(1000 / this.state.averageFrameTime),
            averageFrameTime: this.state.averageFrameTime,
            frameCount: this.state.frameCount,
            droppedFrames: this.state.droppedFrames
        };
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
        this.state.active.clear();
        this.state.queue = [];
        this.state.animationQueue = [];
        
        if (this.state.animationId) {
            cancelAnimationFrame(this.state.animationId);
        }
        
        console.log('🎯 Premium Cursor System destroyed');
    }
}

// ✅ PREMIUM CURSOR SVG CREATORS
export const createPremiumSelectCursorSVG = () => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="selectGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <path d="M12 2L14 8H20L15 12L17 18L12 14L7 18L9 12L4 8H10L12 2Z" 
        fill="url(#selectGradient)" 
        filter="url(#glow)"
        stroke="#ffffff" 
        stroke-width="1"/>
  <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
</svg>
`;

export const createPremiumPaintCursorSVG = () => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="paintGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#5b21b6;stop-opacity:1" />
    </linearGradient>
    <filter id="paintGlow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <path d="M12 2C12.5523 2 13 2.44772 13 3V21C13 21.5523 12.5523 22 12 22C11.4477 22 11 21.5523 11 21V3C11 2.44772 11.4477 2 12 2Z" 
        fill="url(#paintGradient)" 
        filter="url(#paintGlow)"/>
  <path d="M2 12C2 11.4477 2.44772 11 3 11H21C21.5523 11 22 11.4477 22 12C22 12.5523 21.5523 13 21 13H3C2.44772 13 2 12.5523 2 12Z" 
        fill="url(#paintGradient)" 
        filter="url(#paintGlow)"/>
  <circle cx="12" cy="12" r="3" fill="#ffffff" opacity="0.9"/>
  <circle cx="12" cy="12" r="1" fill="#8b5cf6"/>
</svg>
`;

export const createPremiumEraseCursorSVG = () => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="eraseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ef4444;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#dc2626;stop-opacity:1" />
    </linearGradient>
    <filter id="eraseGlow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <circle cx="12" cy="12" r="10" 
          fill="none" 
          stroke="url(#eraseGradient)" 
          stroke-width="2" 
          filter="url(#eraseGlow)"/>
  <path d="M6 6L18 18M18 6L6 18" 
        stroke="url(#eraseGradient)" 
        stroke-width="3" 
        stroke-linecap="round"
        filter="url(#eraseGlow)"/>
  <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
</svg>
`;

export const createPremiumResizeCursorSVG = (direction) => {
  const svgMap = {
    'left': `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="resizeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M2 12L22 12M12 2L12 22" stroke="url(#resizeGradient)" stroke-width="2"/>
        <path d="M8 8L12 12L8 16" fill="url(#resizeGradient)"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>
    `,
    'right': `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="resizeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M2 12L22 12M12 2L12 22" stroke="url(#resizeGradient)" stroke-width="2"/>
        <path d="M16 8L12 12L16 16" fill="url(#resizeGradient)"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>
    `,
    'both': `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="resizeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M2 12L22 12M12 2L12 22" stroke="url(#resizeGradient)" stroke-width="2"/>
        <path d="M8 8L12 12L8 16M16 8L12 12L16 16" fill="url(#resizeGradient)"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>
    `
  };
  
  return svgMap[direction] || svgMap['both'];
};

export const createPremiumMultiNoteCursorSVG = (operation) => {
  const svgMap = {
    'select': `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="multiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="16" height="16" rx="2" fill="url(#multiGradient)" opacity="0.3"/>
        <path d="M8 8L16 8M8 12L16 12M8 16L16 16" stroke="url(#multiGradient)" stroke-width="2"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>
    `,
    'resize': `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="multiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="16" height="16" rx="2" fill="url(#multiGradient)" opacity="0.3"/>
        <path d="M2 12L22 12M12 2L12 22" stroke="url(#multiGradient)" stroke-width="2"/>
        <path d="M8 8L12 12L8 16M16 8L12 12L16 16" fill="url(#multiGradient)"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>
    `,
    'move': `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="multiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="16" height="16" rx="2" fill="url(#multiGradient)" opacity="0.3"/>
        <path d="M8 8L16 8M8 12L16 12M8 16L16 16" stroke="url(#multiGradient)" stroke-width="2"/>
        <path d="M12 2L12 22M2 12L22 12" stroke="url(#multiGradient)" stroke-width="2"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>
    `,
    'rotate': `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="multiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#06b6d4;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0891b2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="16" height="16" rx="2" fill="url(#multiGradient)" opacity="0.3"/>
        <path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2Z" 
              fill="none" 
              stroke="url(#multiGradient)" 
              stroke-width="2"/>
        <path d="M12 6L12 12L16 16" stroke="url(#multiGradient)" stroke-width="2"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>
    `
  };
  
  return svgMap[operation] || svgMap['select'];
};

export const createPremiumSpecialCursorSVG = (effect) => {
  const svgMap = {
    'magnetic': `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="specialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="8" fill="url(#specialGradient)" opacity="0.3"/>
        <path d="M12 2C12.5523 2 13 2.44772 13 3V21C13 21.5523 12.5523 22 12 22C11.4477 22 11 21.5523 11 21V3C11 2.44772 11.4477 2 12 2Z" 
              fill="url(#specialGradient)"/>
        <path d="M2 12C2 11.4477 2.44772 11 3 11H21C21.5523 11 22 11.4477 22 12C22 12.5523 21.5523 13 21 13H3C2.44772 13 2 12.5523 2 12Z" 
              fill="url(#specialGradient)"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>
    `,
    'velocity': `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="specialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M2 12L22 12" stroke="url(#specialGradient)" stroke-width="2"/>
        <path d="M8 6L12 12L8 18" fill="url(#specialGradient)"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>
    `,
    'duration': `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="specialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M12 2L12 22" stroke="url(#specialGradient)" stroke-width="2"/>
        <path d="M6 8L12 12L6 16" fill="url(#specialGradient)"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff" opacity="0.8"/>
      </svg>
    `
  };
  
  return svgMap[effect] || svgMap['magnetic'];
};

export default PremiumCursorSystem;
