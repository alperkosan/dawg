/**
 * Piano Roll Interaction System - Main Export
 * 
 * Bu dosya, piano roll etkileşim sisteminin ana export dosyasıdır.
 * Tüm etkileşim bileşenlerini merkezi olarak yönetir.
 */

// ✅ MAIN INTERACTION COMPONENTS
export { PianoRollInteractionManager } from './PianoRollInteractionManager';
export { VisualFeedbackSystem } from './VisualFeedbackSystem';
export { SmartNoteCreation } from './SmartNoteCreation';
export { ProfessionalCursorSystem } from './ProfessionalCursorSystem';
export { MultiNoteOperations } from './MultiNoteOperations';
export { PremiumCursorSystem } from './PremiumCursorSystem';
export { BatchResizeSystem } from './BatchResizeSystem';
export { CursorIntegrationFix } from './CursorIntegrationFix';
export { PianoRollCursorManager } from './PianoRollCursorManager';

// ✅ CONSTANTS
export { INTERACTION_MODES, VISUAL_FEEDBACK } from './PianoRollInteractionManager';
export { FEEDBACK_TYPES, ANIMATION_TYPES, EASING_FUNCTIONS } from './VisualFeedbackSystem';
export { NOTE_CREATION_MODES, CONTEXT_TYPES, INTELLIGENCE_LEVELS } from './SmartNoteCreation';
export { CURSOR_TYPES, CURSOR_STATES, CURSOR_ANIMATIONS, CURSOR_PRIORITIES } from './ProfessionalCursorSystem';
export { OPERATION_TYPES, OPERATION_MODES, OPERATION_PRIORITIES, OPERATION_STATES } from './MultiNoteOperations';
export { PREMIUM_CURSOR_TYPES, CURSOR_STATES as PREMIUM_CURSOR_STATES, CURSOR_ANIMATIONS as PREMIUM_CURSOR_ANIMATIONS, RESIZE_MODES, RESIZE_HANDLES } from './PremiumCursorSystem';
export { RESIZE_MODES as BATCH_RESIZE_MODES, RESIZE_HANDLES as BATCH_RESIZE_HANDLES, RESIZE_CONSTRAINTS, RESIZE_ALGORITHMS } from './BatchResizeSystem';
export { CURSOR_INTEGRATION_MODES, CURSOR_PRIORITY_LEVELS } from './CursorIntegrationFix';
export { CURSOR_MANAGER_MODES, CURSOR_SOURCES } from './PianoRollCursorManager';

// ✅ CURSOR SVG CREATORS
export {
    createSelectCursorSVG,
    createPaintCursorSVG,
    createEraseCursorSVG,
    createSliceCursorSVG,
    createSlideCursorSVG,
    createResizeLeftCursorSVG,
    createResizeRightCursorSVG,
    createResizeBothCursorSVG,
    createMoveCursorSVG,
    createGrabCursorSVG,
    createGrabbingCursorSVG,
    createCopyCursorSVG,
    createPasteCursorSVG,
    createNotAllowedCursorSVG,
    createCrosshairCursorSVG,
    createMagnifyCursorSVG,
    createHandCursorSVG,
    createHelpCursorSVG,
    createContextMenuCursorSVG
} from './ProfessionalCursorSystem';

// ✅ PREMIUM CURSOR SVG CREATORS
export {
    createPremiumSelectCursorSVG,
    createPremiumPaintCursorSVG,
    createPremiumEraseCursorSVG,
    createPremiumResizeCursorSVG,
    createPremiumMultiNoteCursorSVG,
    createPremiumSpecialCursorSVG
} from './PremiumCursorSystem';

// ✅ INTERACTION SYSTEM FACTORY
export class PianoRollInteractionSystem {
    constructor(options = {}) {
        this.options = options;
        this.components = {};
        this.isInitialized = false;
    }
    
    /**
     * Initialize the interaction system
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('Piano Roll Interaction System already initialized');
            return;
        }
        
        try {
            // Initialize components
            this.components.interactionManager = new PianoRollInteractionManager(this.options.interaction);
            this.components.visualFeedback = new VisualFeedbackSystem(this.options.visualFeedback);
            this.components.smartNoteCreation = new SmartNoteCreation(this.options.smartNoteCreation);
            this.components.cursorSystem = new ProfessionalCursorSystem(this.options.cursor);
            this.components.multiNoteOperations = new MultiNoteOperations(this.options.multiNoteOperations);
            this.components.premiumCursorSystem = new PremiumCursorSystem(this.options.premiumCursor);
            this.components.batchResizeSystem = new BatchResizeSystem(this.options.batchResize);
            this.components.cursorIntegrationFix = new CursorIntegrationFix(this.options.cursorIntegration);
            this.components.cursorManager = new PianoRollCursorManager(this.options.cursorManager);
            
            // Setup component communication
            this.setupComponentCommunication();
            
            this.isInitialized = true;
            console.log('🎹 Piano Roll Interaction System initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Piano Roll Interaction System:', error);
            throw error;
        }
    }
    
    /**
     * Setup component communication
     */
    setupComponentCommunication() {
        const { interactionManager, visualFeedback, smartNoteCreation, cursorSystem, multiNoteOperations, premiumCursorSystem, batchResizeSystem, cursorIntegrationFix, cursorManager } = this.components;
        
        // Interaction Manager → Visual Feedback
        interactionManager.on('interactionStart', (data) => {
            visualFeedback.showNoteFeedback(data.note?.id, 'interaction-start', {
                duration: 200,
                easing: 'ease-out'
            });
        });
        
        interactionManager.on('interactionEnd', (data) => {
            visualFeedback.showNoteFeedback(data.note?.id, 'interaction-end', {
                duration: 150,
                easing: 'ease-in'
            });
        });
        
        // Interaction Manager → Cursor System
        interactionManager.on('cursorChange', (data) => {
            cursorSystem.setCursor(data.cursor, data.state, data.options);
        });
        
        // Smart Note Creation → Visual Feedback
        smartNoteCreation.on('noteCreated', (data) => {
            visualFeedback.showNoteFeedback(data.note.id, 'note-added', {
                duration: 300,
                easing: 'bounce-out'
            });
        });
        
        // Multi-Note Operations → Visual Feedback
        multiNoteOperations.on('operationComplete', (data) => {
            if (data.operation.result?.modifiedNotes) {
                data.operation.result.modifiedNotes.forEach(note => {
                    visualFeedback.showNoteFeedback(note.id, 'note-modified', {
                        duration: 200,
                        easing: 'ease-out'
                    });
                });
            }
        });
        
        // Performance monitoring
        const components = [interactionManager, visualFeedback, smartNoteCreation, cursorSystem, multiNoteOperations];
        
        components.forEach(component => {
            component.on('performanceUpdate', (metrics) => {
                this.emit('performanceUpdate', {
                    component: component.constructor.name,
                    metrics
                });
            });
        });
    }
    
    /**
     * Get component by name
     */
    getComponent(name) {
        return this.components[name];
    }
    
    /**
     * Get all components
     */
    getComponents() {
        return { ...this.components };
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        Object.keys(this.components).forEach(componentName => {
            const component = this.components[componentName];
            if (component.updateConfig) {
                component.updateConfig(newConfig[componentName]);
            }
        });
    }
    
    /**
     * Get system state
     */
    getState() {
        const state = {};
        
        Object.keys(this.components).forEach(componentName => {
            const component = this.components[componentName];
            if (component.getState) {
                state[componentName] = component.getState();
            }
        });
        
        return state;
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        const metrics = {};
        
        Object.keys(this.components).forEach(componentName => {
            const component = this.components[componentName];
            if (component.getPerformanceMetrics) {
                metrics[componentName] = component.getPerformanceMetrics();
            }
        });
        
        return metrics;
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        Object.keys(this.components).forEach(componentName => {
            const component = this.components[componentName];
            if (component.destroy) {
                component.destroy();
            }
        });
        
        this.components = {};
        this.isInitialized = false;
        
        console.log('🎹 Piano Roll Interaction System destroyed');
    }
}

// ✅ DEFAULT CONFIGURATION
export const DEFAULT_CONFIG = {
    interaction: {
        debounceMs: 16,
        throttleMs: 8,
        doubleClickThreshold: 300,
        dragThreshold: 3,
        resizeHandleSize: 8,
        snapTolerance: 0.05
    },
    
    visualFeedback: {
        defaultDuration: 200,
        fastDuration: 100,
        slowDuration: 400,
        ultraFastDuration: 50,
        maxAnimations: 50,
        animationQueueSize: 100,
        frameRate: 60
    },
    
    smartNoteCreation: {
        intelligenceLevel: 'intermediate',
        contextAwareness: true,
        patternRecognition: true,
        musicalIntelligence: true,
        durationMemory: true,
        velocityLayering: true,
        pitchContext: true,
        timingContext: true
    },
    
    cursor: {
        defaultCursor: 'default',
        fallbackCursor: 'default',
        animationDuration: 150,
        transitionDuration: 100,
        hoverDelay: 50,
        cursorSize: 20,
        cursorScale: 1.0,
        cursorOpacity: 1.0,
        debounceMs: 16,
        throttleMs: 8,
        maxCursors: 10
    },
    
    multiNoteOperations: {
        maxNotes: 1000,
        maxOperations: 100,
        operationTimeout: 5000,
        batchSize: 50,
        debounceMs: 16,
        throttleMs: 8,
        quantizeValues: [0.25, 0.5, 1, 2, 4, 8, 16],
        quantizeStrength: 1.0,
        quantizeSwing: 0.0,
        humanizeAmount: 0.1,
        humanizeTiming: true,
        humanizeVelocity: true,
        humanizePitch: false,
        velocityMin: 1,
        velocityMax: 127,
        velocityDefault: 100,
        durationMin: 0.25,
        durationMax: 16,
        durationDefault: 1,
        pitchMin: 0,
        pitchMax: 127,
        pitchDefault: 60
    },
    
    premiumCursor: {
        enabled: true,
        glowEffect: true,
        shadowEffect: true,
        particleEffect: false,
        smoothTransitions: true,
        highDPI: true,
        retina: true,
        animation: {
            duration: 200,
            transitionDuration: 150,
            hoverDelay: 50,
            pressDelay: 100,
            releaseDelay: 50,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        },
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
        }
    },
    
    batchResize: {
        enabled: true,
        multiResize: true,
        proportionalResize: true,
        aspectRatioLock: false,
        gridSnap: true,
        magneticSnap: true,
        smartResize: true,
        musicalResize: true,
        constraints: {
            minWidth: 0.25,
            maxWidth: 1000,
            minHeight: 0.25,
            maxHeight: 1000,
            aspectRatio: null,
            snapThreshold: 8,
            magneticThreshold: 12
        },
        grid: {
            enabled: true,
            size: 1,
            subdivisions: 4,
            snapToGrid: true,
            snapToSubdivisions: true
        },
        magnetic: {
            enabled: true,
            strength: 0.8,
            range: 20,
            points: [],
            autoDetect: true
        },
        smart: {
            enabled: true,
            algorithm: 'smart',
            preserveRhythm: true,
            preserveHarmony: true,
            preserveVelocity: false,
            preserveDuration: true
        }
    },
    
    cursorIntegration: {
        mode: 'unified',
        pianoRollSelector: '.prv5-canvas-container',
        conflictResolution: {
            enabled: true,
            logConflicts: true,
            autoResolve: true,
            fallbackToCSS: true
        },
        performance: {
            debounceMs: 16,
            throttleMs: 8,
            maxUpdatesPerSecond: 60,
            enableCaching: true
        }
    },
    
    cursorManager: {
        mode: 'automatic',
        preferredSystem: 'premium',
        fallbackSystem: 'css',
        integration: {
            enabled: true,
            autoDetect: true,
            conflictResolution: true,
            performanceOptimization: true
        },
        cursorMapping: {
            'select': 'select-premium',
            'paintBrush': 'paint-premium',
            'eraser': 'erase-premium',
            'slice': 'slice-premium',
            'slide': 'slide-premium',
            'hover': 'select-premium',
            'active': 'select-premium',
            'resizing': 'resize-both-premium',
            'moving': 'move-premium',
            'grabbing': 'grabbing-premium'
        }
    }
};

// ✅ UTILITY FUNCTIONS
export const createInteractionSystem = (options = {}) => {
    const config = { ...DEFAULT_CONFIG, ...options };
    return new PianoRollInteractionSystem(config);
};

export const createDefaultInteractionSystem = () => {
    return new PianoRollInteractionSystem(DEFAULT_CONFIG);
};

// ✅ VERSION INFO
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// ✅ EXPORT DEFAULT
export default PianoRollInteractionSystem;
