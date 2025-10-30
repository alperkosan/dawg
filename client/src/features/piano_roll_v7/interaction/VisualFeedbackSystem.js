/**
 * Visual Feedback System - Professional Piano Roll UX
 * 
 * Bu sistem, piano roll'daki tüm görsel geri bildirimleri yönetir.
 * Emsal DAW'ların görsel kalitesini hedefler.
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

// ✅ VISUAL FEEDBACK CONSTANTS
export const FEEDBACK_TYPES = {
    // Note states
    NOTE_DEFAULT: 'note-default',
    NOTE_HOVER: 'note-hover',
    NOTE_SELECTED: 'note-selected',
    NOTE_PREVIEW: 'note-preview',
    NOTE_GHOST: 'note-ghost',
    NOTE_DISABLED: 'note-disabled',
    NOTE_LOCKED: 'note-locked',
    
    // Interaction states
    PAINT_PREVIEW: 'paint-preview',
    SLICE_PREVIEW: 'slice-preview',
    SELECTION_AREA: 'selection-area',
    RESIZE_HANDLE: 'resize-handle',
    MOVE_PREVIEW: 'move-preview',
    
    // Animation states
    NOTE_ADDED: 'note-added',
    NOTE_DELETED: 'note-deleted',
    NOTE_MODIFIED: 'note-modified',
    NOTE_MOVED: 'note-moved',
    NOTE_RESIZED: 'note-resized',
    NOTE_COPIED: 'note-copied',
    NOTE_PASTED: 'note-pasted',
    
    // Special effects
    VELOCITY_INDICATOR: 'velocity-indicator',
    DURATION_INDICATOR: 'duration-indicator',
    PITCH_INDICATOR: 'pitch-indicator',
    GRID_SNAP: 'grid-snap',
    QUANTIZE_PREVIEW: 'quantize-preview'
};

export const ANIMATION_TYPES = {
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
    
    // Modification animations
    PULSE: 'pulse',
    GLOW: 'glow',
    SHAKE: 'shake',
    ROTATE: 'rotate',
    
    // Special animations
    TYPEWRITER: 'typewriter',
    REVEAL: 'reveal',
    MORPH: 'morph'
};

export const EASING_FUNCTIONS = {
    LINEAR: 'linear',
    EASE_IN: 'ease-in',
    EASE_OUT: 'ease-out',
    EASE_IN_OUT: 'ease-in-out',
    EASE_IN_CUBIC: 'ease-in-cubic',
    EASE_OUT_CUBIC: 'ease-out-cubic',
    EASE_IN_OUT_CUBIC: 'ease-in-out-cubic',
    EASE_IN_QUART: 'ease-in-quart',
    EASE_OUT_QUART: 'ease-out-quart',
    EASE_IN_OUT_QUART: 'ease-in-out-quart',
    EASE_IN_BACK: 'ease-in-back',
    EASE_OUT_BACK: 'ease-out-back',
    EASE_IN_OUT_BACK: 'ease-in-out-back',
    EASE_IN_ELASTIC: 'ease-in-elastic',
    EASE_OUT_ELASTIC: 'ease-out-elastic',
    EASE_IN_OUT_ELASTIC: 'ease-in-out-elastic',
    BOUNCE: 'bounce',
    ELASTIC: 'elastic'
};

/**
 * Visual Feedback System
 * 
 * Bu sınıf, piano roll'daki tüm görsel geri bildirimleri yönetir.
 * Professional DAW'ların görsel kalitesini hedefler.
 */
export class VisualFeedbackSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            // Animation settings
            defaultDuration: 200,
            fastDuration: 100,
            slowDuration: 400,
            ultraFastDuration: 50,
            
            // Visual settings
            opacity: {
                default: 1.0,
                hover: 0.8,
                selected: 0.9,
                preview: 0.6,
                ghost: 0.4,
                disabled: 0.3
            },
            
            // Color settings
            colors: {
                primary: '#3b82f6',
                secondary: '#8b5cf6',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444',
                info: '#06b6d4',
                
                // Note colors
                note: {
                    default: '#3b82f6',
                    hover: '#2563eb',
                    selected: '#1d4ed8',
                    preview: '#60a5fa',
                    ghost: '#93c5fd'
                },
                
                // Velocity colors
                velocity: {
                    low: '#ef4444',    // Red
                    medium: '#f59e0b', // Orange
                    high: '#10b981'    // Green
                }
            },
            
            // Size settings
            sizes: {
                note: {
                    minHeight: 12,
                    maxHeight: 24,
                    defaultHeight: 18
                },
                handle: {
                    width: 8,
                    height: 20
                },
                indicator: {
                    size: 4,
                    offset: 2
                }
            },
            
            // Performance settings
            maxAnimations: 50,
            animationQueueSize: 100,
            frameRate: 60,
            
            ...options
        };
        
        // State management
        this.state = {
            activeAnimations: new Map(),
            animationQueue: [],
            visualLayers: new Map(),
            feedbackElements: new Map(),
            isProcessing: false
        };
        
        // Performance monitoring
        this.performance = {
            frameCount: 0,
            lastFrameTime: 0,
            averageFrameTime: 16.67,
            droppedFrames: 0
        };
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize the visual feedback system
     */
    initialize() {
        this.setupAnimationEngine();
        this.setupVisualLayers();
        this.setupPerformanceMonitoring();
        
        console.log('🎨 Visual Feedback System initialized');
    }
    
    /**
     * Setup animation engine
     */
    setupAnimationEngine() {
        this.animationEngine = {
            // Animation queue
            queue: [],
            processing: false,
            
            // Add animation to queue
            add: (animation) => {
                if (this.state.animationQueue.length >= this.config.animationQueueSize) {
                    // Remove oldest animation if queue is full
                    this.state.animationQueue.shift();
                }
                
                this.state.animationQueue.push(animation);
                this.processAnimations();
            },
            
            // Process animation queue
            process: () => {
                if (this.state.isProcessing) return;
                
                this.state.isProcessing = true;
                this.processAnimationFrame();
            },
            
            // Process single animation frame
            processFrame: () => {
                const now = performance.now();
                const deltaTime = now - this.performance.lastFrameTime;
                
                // Update performance metrics
                this.performance.frameCount++;
                this.performance.averageFrameTime = 
                    (this.performance.averageFrameTime * 0.9) + (deltaTime * 0.1);
                
                // Check for dropped frames
                if (deltaTime > 20) {
                    this.performance.droppedFrames++;
                }
                
                this.performance.lastFrameTime = now;
                
                // Process active animations
                this.updateActiveAnimations(now);
                
                // Process animation queue
                this.processAnimationQueue();
                
                // Continue processing
                if (this.state.animationQueue.length > 0 || this.state.activeAnimations.size > 0) {
                    requestAnimationFrame(() => this.processFrame());
                } else {
                    this.state.isProcessing = false;
                }
            }
        };
    }
    
    /**
     * Setup visual layers
     */
    setupVisualLayers() {
        this.visualLayers = {
            // Main note layer
            notes: {
                element: null,
                zIndex: 10,
                opacity: 1.0
            },
            
            // Preview layer
            preview: {
                element: null,
                zIndex: 20,
                opacity: 0.6
            },
            
            // Selection layer
            selection: {
                element: null,
                zIndex: 30,
                opacity: 0.8
            },
            
            // Animation layer
            animation: {
                element: null,
                zIndex: 40,
                opacity: 1.0
            },
            
            // Overlay layer
            overlay: {
                element: null,
                zIndex: 50,
                opacity: 1.0
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
            const deltaTime = now - this.performance.lastFrameTime;
            
            this.performance.frameCount++;
            this.performance.averageFrameTime = 
                (this.performance.averageFrameTime * 0.9) + (deltaTime * 0.1);
            
            // Check for dropped frames
            if (deltaTime > 20) {
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
        
        // Start monitoring
        const monitorLoop = () => {
            monitor();
            requestAnimationFrame(monitorLoop);
        };
        
        requestAnimationFrame(monitorLoop);
    }
    
    /**
     * Show note feedback
     */
    showNoteFeedback(noteId, type, options = {}) {
        const feedback = {
            id: noteId,
            type,
            timestamp: Date.now(),
            duration: options.duration || this.config.defaultDuration,
            easing: options.easing || EASING_FUNCTIONS.EASE_OUT,
            onComplete: options.onComplete,
            onUpdate: options.onUpdate,
            properties: options.properties || {}
        };
        
        // Add to animation queue
        this.animationEngine.add(feedback);
        
        // Emit feedback event
        this.emit('feedbackStart', { noteId, type, options });
    }
    
    /**
     * Show selection feedback
     */
    showSelectionFeedback(selection, type = FEEDBACK_TYPES.SELECTION_AREA) {
        const feedback = {
            id: `selection_${Date.now()}`,
            type,
            selection,
            timestamp: Date.now(),
            duration: this.config.fastDuration,
            easing: EASING_FUNCTIONS.EASE_OUT
        };
        
        this.animationEngine.add(feedback);
        this.emit('selectionFeedback', { selection, type });
    }
    
    /**
     * Show preview feedback
     */
    showPreviewFeedback(preview, type = FEEDBACK_TYPES.PAINT_PREVIEW) {
        const feedback = {
            id: `preview_${Date.now()}`,
            type,
            preview,
            timestamp: Date.now(),
            duration: this.config.ultraFastDuration,
            easing: EASING_FUNCTIONS.LINEAR
        };
        
        this.animationEngine.add(feedback);
        this.emit('previewFeedback', { preview, type });
    }
    
    /**
     * Show animation
     */
    showAnimation(noteId, animationType, options = {}) {
        const animation = {
            id: noteId,
            type: animationType,
            timestamp: Date.now(),
            duration: options.duration || this.config.defaultDuration,
            easing: options.easing || EASING_FUNCTIONS.EASE_OUT,
            onComplete: options.onComplete,
            onUpdate: options.onUpdate,
            properties: options.properties || {}
        };
        
        this.animationEngine.add(animation);
        this.emit('animationStart', { noteId, animationType, options });
    }
    
    /**
     * Update active animations
     */
    updateActiveAnimations(currentTime) {
        const completedAnimations = [];
        
        this.state.activeAnimations.forEach((animation, id) => {
            const elapsed = currentTime - animation.startTime;
            const progress = Math.min(elapsed / animation.duration, 1);
            
            // Apply easing
            const easedProgress = this.applyEasing(progress, animation.easing);
            
            // Update animation
            this.updateAnimation(animation, easedProgress);
            
            // Check if completed
            if (progress >= 1) {
                completedAnimations.push(id);
                
                // Call completion callback
                if (animation.onComplete) {
                    animation.onComplete();
                }
                
                // Emit completion event
                this.emit('animationComplete', { id, type: animation.type });
            }
        });
        
        // Remove completed animations
        completedAnimations.forEach(id => {
            this.state.activeAnimations.delete(id);
        });
    }
    
    /**
     * Process animation queue
     */
    processAnimationQueue() {
        if (this.state.animationQueue.length === 0) return;
        
        const animation = this.state.animationQueue.shift();
        
        // Check if we can add more animations
        if (this.state.activeAnimations.size >= this.config.maxAnimations) {
            // Queue is full, skip this animation
            console.warn('Animation queue full, skipping animation:', animation.type);
            return;
        }
        
        // Add to active animations
        animation.startTime = performance.now();
        this.state.activeAnimations.set(animation.id, animation);
        
        // Emit animation start
        this.emit('animationStart', { 
            id: animation.id, 
            type: animation.type 
        });
    }
    
    /**
     * Update animation
     */
    updateAnimation(animation, progress) {
        const { id, type, properties } = animation;
        
        // Update animation properties
        switch (type) {
            case ANIMATION_TYPES.FADE_IN:
                this.updateOpacity(id, progress);
                break;
            case ANIMATION_TYPES.FADE_OUT:
                this.updateOpacity(id, 1 - progress);
                break;
            case ANIMATION_TYPES.SCALE_IN:
                this.updateScale(id, progress);
                break;
            case ANIMATION_TYPES.SCALE_OUT:
                this.updateScale(id, 1 - progress);
                break;
            case ANIMATION_TYPES.SLIDE_IN:
                this.updatePosition(id, progress, properties.direction);
                break;
            case ANIMATION_TYPES.SLIDE_OUT:
                this.updatePosition(id, 1 - progress, properties.direction);
                break;
            case ANIMATION_TYPES.PULSE:
                this.updatePulse(id, progress);
                break;
            case ANIMATION_TYPES.GLOW:
                this.updateGlow(id, progress);
                break;
            case ANIMATION_TYPES.SHAKE:
                this.updateShake(id, progress);
                break;
        }
        
        // Call update callback
        if (animation.onUpdate) {
            animation.onUpdate(progress);
        }
    }
    
    /**
     * Apply easing function
     */
    applyEasing(progress, easing) {
        switch (easing) {
            case EASING_FUNCTIONS.LINEAR:
                return progress;
            case EASING_FUNCTIONS.EASE_IN:
                return progress * progress;
            case EASING_FUNCTIONS.EASE_OUT:
                return 1 - Math.pow(1 - progress, 2);
            case EASING_FUNCTIONS.EASE_IN_OUT:
                return progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            case EASING_FUNCTIONS.EASE_IN_CUBIC:
                return progress * progress * progress;
            case EASING_FUNCTIONS.EASE_OUT_CUBIC:
                return 1 - Math.pow(1 - progress, 3);
            case EASING_FUNCTIONS.EASE_IN_OUT_CUBIC:
                return progress < 0.5 
                    ? 4 * progress * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            case EASING_FUNCTIONS.BOUNCE:
                return this.bounceEasing(progress);
            case EASING_FUNCTIONS.ELASTIC:
                return this.elasticEasing(progress);
            default:
                return progress;
        }
    }
    
    /**
     * Bounce easing function
     */
    bounceEasing(progress) {
        if (progress < 1 / 2.75) {
            return 7.5625 * progress * progress;
        } else if (progress < 2 / 2.75) {
            return 7.5625 * (progress -= 1.5 / 2.75) * progress + 0.75;
        } else if (progress < 2.5 / 2.75) {
            return 7.5625 * (progress -= 2.25 / 2.75) * progress + 0.9375;
        } else {
            return 7.5625 * (progress -= 2.625 / 2.75) * progress + 0.984375;
        }
    }
    
    /**
     * Elastic easing function
     */
    elasticEasing(progress) {
        if (progress === 0) return 0;
        if (progress === 1) return 1;
        
        const p = 0.3;
        const s = p / 4;
        
        return Math.pow(2, -10 * progress) * Math.sin((progress - s) * (2 * Math.PI) / p) + 1;
    }
    
    /**
     * Update opacity
     */
    updateOpacity(id, opacity) {
        const element = this.getElement(id);
        if (element) {
            element.style.opacity = opacity;
        }
    }
    
    /**
     * Update scale
     */
    updateScale(id, scale) {
        const element = this.getElement(id);
        if (element) {
            element.style.transform = `scale(${scale})`;
        }
    }
    
    /**
     * Update position
     */
    updatePosition(id, progress, direction = 'right') {
        const element = this.getElement(id);
        if (element) {
            const offset = (1 - progress) * 20;
            let transform = '';
            
            switch (direction) {
                case 'right':
                    transform = `translateX(${offset}px)`;
                    break;
                case 'left':
                    transform = `translateX(${-offset}px)`;
                    break;
                case 'up':
                    transform = `translateY(${-offset}px)`;
                    break;
                case 'down':
                    transform = `translateY(${offset}px)`;
                    break;
            }
            
            element.style.transform = transform;
        }
    }
    
    /**
     * Update pulse effect
     */
    updatePulse(id, progress) {
        const element = this.getElement(id);
        if (element) {
            const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
            element.style.transform = `scale(${scale})`;
        }
    }
    
    /**
     * Update glow effect
     */
    updateGlow(id, progress) {
        const element = this.getElement(id);
        if (element) {
            const intensity = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
            element.style.boxShadow = `0 0 ${intensity * 10}px rgba(59, 130, 246, ${intensity})`;
        }
    }
    
    /**
     * Update shake effect
     */
    updateShake(id, progress) {
        const element = this.getElement(id);
        if (element) {
            const intensity = (1 - progress) * 5;
            const shakeX = (Math.random() - 0.5) * intensity;
            const shakeY = (Math.random() - 0.5) * intensity;
            element.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
        }
    }
    
    /**
     * Get element by ID
     */
    getElement(id) {
        return document.getElementById(id) || this.state.feedbackElements.get(id);
    }
    
    /**
     * Clear all feedback
     */
    clearAllFeedback() {
        this.state.activeAnimations.clear();
        this.state.animationQueue = [];
        this.state.feedbackElements.clear();
        
        this.emit('feedbackClear');
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return { ...this.performance };
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
        this.clearAllFeedback();
        this.removeAllListeners();
        console.log('🎨 Visual Feedback System destroyed');
    }
}

export default VisualFeedbackSystem;
