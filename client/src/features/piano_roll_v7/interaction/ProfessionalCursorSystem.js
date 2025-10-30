/**
 * Professional Cursor System - Advanced Piano Roll UX
 * 
 * Bu sistem, piano roll için profesyonel cursor yönetimi sağlar.
 * Emsal DAW'ların cursor kalitesini hedefler.
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

// ✅ CURSOR SYSTEM CONSTANTS
export const CURSOR_TYPES = {
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
    RESIZE_UP: 'resize-up',
    RESIZE_DOWN: 'resize-down',
    RESIZE_UP_LEFT: 'resize-up-left',
    RESIZE_UP_RIGHT: 'resize-up-right',
    RESIZE_DOWN_LEFT: 'resize-down-left',
    RESIZE_DOWN_RIGHT: 'resize-down-right',
    
    // Move cursors
    MOVE: 'move',
    GRAB: 'grab',
    GRABBING: 'grabbing',
    DRAG: 'drag',
    DRAGGING: 'dragging',
    
    // Special cursors
    COPY: 'copy',
    PASTE: 'paste',
    NOT_ALLOWED: 'not-allowed',
    CROSSHAIR: 'crosshair',
    MAGNIFY: 'magnify',
    HAND: 'hand',
    HELP: 'help',
    
    // Context cursors
    CONTEXT_MENU: 'context-menu',
    MENU: 'menu',
    POINTER: 'pointer',
    
    // Custom cursors
    CUSTOM: 'custom'
};

export const CURSOR_STATES = {
    // Basic states
    IDLE: 'idle',
    HOVER: 'hover',
    ACTIVE: 'active',
    DISABLED: 'disabled',
    
    // Interaction states
    PRESSING: 'pressing',
    DRAGGING: 'dragging',
    RESIZING: 'resizing',
    SELECTING: 'selecting',
    
    // Multi-note states
    MULTI_SELECTING: 'multi-selecting',
    MULTI_RESIZING: 'multi-resizing',
    MULTI_MOVING: 'multi-moving',
    MULTI_ROTATING: 'multi-rotating',
    
    // Special states
    LOADING: 'loading',
    WAITING: 'waiting',
    ERROR: 'error',
    SUCCESS: 'success'
};

export const CURSOR_ANIMATIONS = {
    // Entrance animations
    FADE_IN: 'fade-in',
    SLIDE_IN: 'slide-in',
    SCALE_IN: 'scale-in',
    BOUNCE_IN: 'bounce-in',
    
    // Exit animations
    FADE_OUT: 'fade-out',
    SLIDE_OUT: 'slide-out',
    SCALE_OUT: 'scale-out',
    BOUNCE_OUT: 'bounce-out',
    
    // State animations
    PULSE: 'pulse',
    GLOW: 'glow',
    SHAKE: 'shake',
    ROTATE: 'rotate',
    
    // Special animations
    TYPEWRITER: 'typewriter',
    REVEAL: 'reveal',
    MORPH: 'morph'
};

export const CURSOR_PRIORITIES = {
    // Highest priority
    CRITICAL: 100,
    
    // High priority
    HIGH: 80,
    
    // Medium priority
    MEDIUM: 60,
    
    // Low priority
    LOW: 40,
    
    // Background priority
    BACKGROUND: 20
};

/**
 * Professional Cursor System
 * 
 * Bu sınıf, piano roll için profesyonel cursor yönetimi sağlar.
 * Emsal DAW'ların cursor kalitesini hedefler.
 */
export class ProfessionalCursorSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            // Cursor settings
            defaultCursor: CURSOR_TYPES.DEFAULT,
            fallbackCursor: CURSOR_TYPES.DEFAULT,
            customCursors: new Map(),
            
            // Animation settings
            animationDuration: 150,
            transitionDuration: 100,
            hoverDelay: 50,
            
            // Visual settings
            cursorSize: 20,
            cursorScale: 1.0,
            cursorOpacity: 1.0,
            cursorColor: '#3b82f6',
            cursorShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            
            // Performance settings
            debounceMs: 16,
            throttleMs: 8,
            maxCursors: 10,
            
            // Accessibility settings
            highContrast: false,
            reducedMotion: false,
            largeCursors: false,
            
            ...options
        };
        
        // State management
        this.state = {
            // Current cursor
            current: CURSOR_TYPES.DEFAULT,
            previous: null,
            state: CURSOR_STATES.IDLE,
            
            // Cursor history
            history: [],
            maxHistory: 50,
            
            // Active cursors
            active: new Map(),
            queue: [],
            
            // Animation state
            isAnimating: false,
            animationQueue: [],
            
            // Performance state
            lastUpdate: 0,
            frameCount: 0,
            averageFrameTime: 16.67
        };
        
        // Cursor definitions
        this.cursors = new Map();
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize the cursor system
     */
    initialize() {
        this.setupDefaultCursors();
        this.setupCustomCursors();
        this.setupAnimationSystem();
        this.setupPerformanceMonitoring();
        this.setupAccessibility();
        
        console.log('🎯 Professional Cursor System initialized');
    }
    
    /**
     * Setup default cursors
     */
    setupDefaultCursors() {
        // Default cursors
        this.cursors.set(CURSOR_TYPES.DEFAULT, {
            type: CURSOR_TYPES.DEFAULT,
            css: 'default',
            svg: null,
            priority: CURSOR_PRIORITIES.LOW,
            states: [CURSOR_STATES.IDLE]
        });
        
        this.cursors.set(CURSOR_TYPES.SELECT, {
            type: CURSOR_TYPES.SELECT,
            css: 'pointer',
            svg: createSelectCursorSVG(),
            priority: CURSOR_PRIORITIES.MEDIUM,
            states: [CURSOR_STATES.IDLE, CURSOR_STATES.HOVER]
        });
        
        this.cursors.set(CURSOR_TYPES.PAINT, {
            type: CURSOR_TYPES.PAINT,
            css: 'crosshair',
            svg: createPaintCursorSVG(),
            priority: CURSOR_PRIORITIES.HIGH,
            states: [CURSOR_STATES.IDLE, CURSOR_STATES.ACTIVE]
        });
        
        this.cursors.set(CURSOR_TYPES.ERASE, {
            type: CURSOR_TYPES.ERASE,
            css: 'not-allowed',
            svg: createEraseCursorSVG(),
            priority: CURSOR_PRIORITIES.HIGH,
            states: [CURSOR_STATES.IDLE, CURSOR_STATES.ACTIVE]
        });
        
        this.cursors.set(CURSOR_TYPES.SLICE, {
            type: CURSOR_TYPES.SLICE,
            css: 'col-resize',
            svg: createSliceCursorSVG(),
            priority: CURSOR_PRIORITIES.HIGH,
            states: [CURSOR_STATES.IDLE, CURSOR_STATES.ACTIVE]
        });
        
        this.cursors.set(CURSOR_TYPES.SLIDE, {
            type: CURSOR_TYPES.SLIDE,
            css: 'grab',
            svg: createSlideCursorSVG(),
            priority: CURSOR_PRIORITIES.HIGH,
            states: [CURSOR_STATES.IDLE, CURSOR_STATES.ACTIVE]
        });
        
        // Resize cursors
        this.cursors.set(CURSOR_TYPES.RESIZE_LEFT, {
            type: CURSOR_TYPES.RESIZE_LEFT,
            css: 'w-resize',
            svg: createResizeLeftCursorSVG(),
            priority: CURSOR_PRIORITIES.HIGH,
            states: [CURSOR_STATES.HOVER, CURSOR_STATES.RESIZING]
        });
        
        this.cursors.set(CURSOR_TYPES.RESIZE_RIGHT, {
            type: CURSOR_TYPES.RESIZE_RIGHT,
            css: 'e-resize',
            svg: createResizeRightCursorSVG(),
            priority: CURSOR_PRIORITIES.HIGH,
            states: [CURSOR_STATES.HOVER, CURSOR_STATES.RESIZING]
        });
        
        this.cursors.set(CURSOR_TYPES.RESIZE_BOTH, {
            type: CURSOR_TYPES.RESIZE_BOTH,
            css: 'nw-resize',
            svg: createResizeBothCursorSVG(),
            priority: CURSOR_PRIORITIES.HIGH,
            states: [CURSOR_STATES.HOVER, CURSOR_STATES.RESIZING]
        });
        
        // Move cursors
        this.cursors.set(CURSOR_TYPES.MOVE, {
            type: CURSOR_TYPES.MOVE,
            css: 'move',
            svg: createMoveCursorSVG(),
            priority: CURSOR_PRIORITIES.MEDIUM,
            states: [CURSOR_STATES.HOVER, CURSOR_STATES.DRAGGING]
        });
        
        this.cursors.set(CURSOR_TYPES.GRAB, {
            type: CURSOR_TYPES.GRAB,
            css: 'grab',
            svg: createGrabCursorSVG(),
            priority: CURSOR_PRIORITIES.MEDIUM,
            states: [CURSOR_STATES.HOVER]
        });
        
        this.cursors.set(CURSOR_TYPES.GRABBING, {
            type: CURSOR_TYPES.GRABBING,
            css: 'grabbing',
            svg: createGrabbingCursorSVG(),
            priority: CURSOR_PRIORITIES.HIGH,
            states: [CURSOR_STATES.DRAGGING]
        });
        
        // Special cursors
        this.cursors.set(CURSOR_TYPES.COPY, {
            type: CURSOR_TYPES.COPY,
            css: 'copy',
            svg: createCopyCursorSVG(),
            priority: CURSOR_PRIORITIES.MEDIUM,
            states: [CURSOR_STATES.ACTIVE]
        });
        
        this.cursors.set(CURSOR_TYPES.PASTE, {
            type: CURSOR_TYPES.PASTE,
            css: 'copy',
            svg: createPasteCursorSVG(),
            priority: CURSOR_PRIORITIES.MEDIUM,
            states: [CURSOR_STATES.ACTIVE]
        });
        
        this.cursors.set(CURSOR_TYPES.NOT_ALLOWED, {
            type: CURSOR_TYPES.NOT_ALLOWED,
            css: 'not-allowed',
            svg: createNotAllowedCursorSVG(),
            priority: CURSOR_PRIORITIES.HIGH,
            states: [CURSOR_STATES.DISABLED, CURSOR_STATES.ERROR]
        });
        
        this.cursors.set(CURSOR_TYPES.CROSSHAIR, {
            type: CURSOR_TYPES.CROSSHAIR,
            css: 'crosshair',
            svg: createCrosshairCursorSVG(),
            priority: CURSOR_PRIORITIES.MEDIUM,
            states: [CURSOR_STATES.ACTIVE]
        });
        
        this.cursors.set(CURSOR_TYPES.MAGNIFY, {
            type: CURSOR_TYPES.MAGNIFY,
            css: 'zoom-in',
            svg: createMagnifyCursorSVG(),
            priority: CURSOR_PRIORITIES.MEDIUM,
            states: [CURSOR_STATES.ACTIVE]
        });
        
        this.cursors.set(CURSOR_TYPES.HAND, {
            type: CURSOR_TYPES.HAND,
            css: 'grab',
            svg: createHandCursorSVG(),
            priority: CURSOR_PRIORITIES.MEDIUM,
            states: [CURSOR_STATES.ACTIVE]
        });
        
        this.cursors.set(CURSOR_TYPES.HELP, {
            type: CURSOR_TYPES.HELP,
            css: 'help',
            svg: createHelpCursorSVG(),
            priority: CURSOR_PRIORITIES.LOW,
            states: [CURSOR_STATES.IDLE]
        });
        
        this.cursors.set(CURSOR_TYPES.CONTEXT_MENU, {
            type: CURSOR_TYPES.CONTEXT_MENU,
            css: 'context-menu',
            svg: createContextMenuCursorSVG(),
            priority: CURSOR_PRIORITIES.MEDIUM,
            states: [CURSOR_STATES.ACTIVE]
        });
    }
    
    /**
     * Setup custom cursors
     */
    setupCustomCursors() {
        // Custom cursors can be added here
        // Example: this.addCustomCursor('my-cursor', { ... });
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
                    requestAnimationFrame(() => this.processFrame());
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
            
            this.state.lastUpdate = now;
            
            // Emit performance update
            this.emit('performanceUpdate', {
                frameRate: Math.round(1000 / this.state.averageFrameTime),
                averageFrameTime: this.state.averageFrameTime
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
            this.config.reducedMotion = true;
        }
        
        // Check for high contrast preference
        if (window.matchMedia('(prefers-contrast: high)').matches) {
            this.config.highContrast = true;
        }
        
        // Check for large cursor preference
        if (window.matchMedia('(prefers-large-cursors: large)').matches) {
            this.config.largeCursors = true;
        }
        
        // Listen for preference changes
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            this.config.reducedMotion = e.matches;
        });
        
        window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
            this.config.highContrast = e.matches;
        });
        
        window.matchMedia('(prefers-large-cursors: large)').addEventListener('change', (e) => {
            this.config.largeCursors = e.matches;
        });
    }
    
    /**
     * Set cursor
     */
    setCursor(type, state = CURSOR_STATES.IDLE, options = {}) {
        // ✅ Validate and fix state - ensure it's a string, not a number
        if (typeof state === 'number' || !state) {
            state = CURSOR_STATES.IDLE; // Use default if number or invalid
        }
        
        const cursor = this.cursors.get(type);
        if (!cursor) {
            console.warn(`Cursor type not found: ${type}`);
            return;
        }
        
        // Check if cursor supports the state
        if (!cursor.states.includes(state)) {
            console.warn(`Cursor ${type} does not support state: ${state}`);
            // Use default state instead of failing
            state = CURSOR_STATES.IDLE;
        }
        
        // Update state
        this.state.previous = this.state.current;
        this.state.current = type;
        this.state.state = state;
        
        // Add to history
        this.addToHistory(type, state);
        
        // Apply cursor
        this.applyCursor(cursor, state, options);
        
        // Emit change event
        this.emit('cursorChange', {
            type,
            state,
            previous: this.state.previous,
            options
        });
    }
    
    /**
     * Apply cursor to DOM
     */
    applyCursor(cursor, state, options) {
        const element = options.element || document.body;
        
        // Remove previous cursor classes
        element.classList.remove(...Object.values(CURSOR_TYPES));
        element.classList.remove(...Object.values(CURSOR_STATES));
        
        // Add new cursor classes
        element.classList.add(cursor.type);
        element.classList.add(state);
        
        // Apply CSS cursor
        if (cursor.css) {
            element.style.cursor = cursor.css;
        }
        
        // Apply custom cursor
        if (cursor.svg) {
            this.applyCustomCursor(element, cursor.svg, options);
        }
        
        // Apply animations
        if (options.animation) {
            this.animateCursor(cursor, state, options.animation);
        }
    }
    
    /**
     * Apply custom cursor
     */
    applyCustomCursor(element, svg, options) {
        // Create cursor element
        const cursorElement = document.createElement('div');
        cursorElement.className = 'custom-cursor';
        cursorElement.innerHTML = svg;
        
        // Apply styles
        cursorElement.style.position = 'fixed';
        cursorElement.style.pointerEvents = 'none';
        cursorElement.style.zIndex = '9999';
        cursorElement.style.transform = `scale(${this.config.cursorScale})`;
        cursorElement.style.opacity = this.config.cursorOpacity;
        cursorElement.style.color = this.config.cursorColor;
        cursorElement.style.filter = this.config.cursorShadow;
        
        // Add to DOM
        element.appendChild(cursorElement);
        
        // Remove after animation
        setTimeout(() => {
            if (cursorElement.parentNode) {
                cursorElement.parentNode.removeChild(cursorElement);
            }
        }, this.config.animationDuration);
    }
    
    /**
     * Animate cursor
     */
    animateCursor(cursor, state, animation) {
        const animationData = {
            cursor,
            state,
            animation,
            startTime: performance.now(),
            duration: this.config.animationDuration
        };
        
        this.animationSystem.add(animationData);
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
     * Reset cursor to default
     */
    reset() {
        this.setCursor(CURSOR_TYPES.DEFAULT, CURSOR_STATES.IDLE);
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
            frameCount: this.state.frameCount
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
        console.log('🎯 Professional Cursor System destroyed');
    }
}

// ✅ CURSOR SVG CREATORS
export const createSelectCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M10 2L12 8H18L13 12L15 18L10 14L5 18L7 12L2 8H8L10 2Z"/>
</svg>
`;

export const createPaintCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M10 2C10.5523 2 11 2.44772 11 3V17C11 17.5523 10.5523 18 10 18C9.44772 18 9 17.5523 9 17V3C9 2.44772 9.44772 2 10 2Z"/>
  <path d="M2 10C2 9.44772 2.44772 9 3 9H17C17.5523 9 18 9.44772 18 10C18 10.5523 17.5523 11 17 11H3C2.44772 11 2 10.5523 2 10Z"/>
</svg>
`;

export const createEraseCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M10 2L18 10L10 18L2 10L10 2Z" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" stroke-width="2"/>
</svg>
`;

export const createSliceCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M10 2L10 18M2 10L18 10" stroke="currentColor" stroke-width="2"/>
  <path d="M8 6L12 10L8 14" fill="currentColor"/>
</svg>
`;

export const createSlideCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M10 2L18 10L10 18L2 10L10 2Z" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M6 10L14 10M10 6L10 14" stroke="currentColor" stroke-width="1"/>
</svg>
`;

export const createResizeLeftCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M2 10L18 10M10 2L10 18" stroke="currentColor" stroke-width="2"/>
  <path d="M6 6L10 10L6 14" fill="currentColor"/>
</svg>
`;

export const createResizeRightCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M2 10L18 10M10 2L10 18" stroke="currentColor" stroke-width="2"/>
  <path d="M14 6L10 10L14 14" fill="currentColor"/>
</svg>
`;

export const createResizeBothCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M2 10L18 10M10 2L10 18" stroke="currentColor" stroke-width="2"/>
  <path d="M6 6L10 10L6 14M14 6L10 10L14 14" fill="currentColor"/>
</svg>
`;

export const createMoveCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M10 2L12 8H18L13 12L15 18L10 14L5 18L7 12L2 8H8L10 2Z" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" stroke-width="1"/>
</svg>
`;

export const createGrabCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M10 2L12 8H18L13 12L15 18L10 14L5 18L7 12L2 8H8L10 2Z" fill="currentColor"/>
</svg>
`;

export const createGrabbingCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M10 2L12 8H18L13 12L15 18L10 14L5 18L7 12L2 8H8L10 2Z" fill="currentColor"/>
  <path d="M6 6L14 14M14 6L6 14" stroke="white" stroke-width="1"/>
</svg>
`;

export const createCopyCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/>
  <rect x="10" y="10" width="8" height="8" fill="currentColor"/>
</svg>
`;

export const createPasteCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <rect x="2" y="2" width="8" height="8" fill="currentColor"/>
  <rect x="10" y="10" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>
`;

export const createNotAllowedCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M6 6L14 14" stroke="currentColor" stroke-width="2"/>
</svg>
`;

export const createCrosshairCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M10 2L10 18M2 10L18 10" stroke="currentColor" stroke-width="2"/>
  <circle cx="10" cy="10" r="2" fill="currentColor"/>
</svg>
`;

export const createMagnifyCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M14 14L18 18" stroke="currentColor" stroke-width="2"/>
</svg>
`;

export const createHandCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <path d="M10 2L12 8H18L13 12L15 18L10 14L5 18L7 12L2 8H8L10 2Z" fill="currentColor"/>
</svg>
`;

export const createHelpCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M10 6C10.5523 6 11 6.44772 11 7C11 7.55228 10.5523 8 10 8C9.44772 8 9 7.55228 9 7C9 6.44772 9.44772 6 10 6Z"/>
  <path d="M10 10V14" stroke="currentColor" stroke-width="2"/>
</svg>
`;

export const createContextMenuCursorSVG = () => `
<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
  <circle cx="10" cy="6" r="1" fill="currentColor"/>
  <circle cx="10" cy="10" r="1" fill="currentColor"/>
  <circle cx="10" cy="14" r="1" fill="currentColor"/>
</svg>
`;

export default ProfessionalCursorSystem;
