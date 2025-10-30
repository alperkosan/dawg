/**
 * Batch Resize System - Advanced Multi-Note Resizing
 * 
 * Bu sistem, piano roll'da toplu resize operasyonları sağlar.
 * Emsal DAW'ların gelişmiş resize özelliklerini hedefler.
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

// ✅ BATCH RESIZE CONSTANTS
export const RESIZE_MODES = {
    // Basic modes
    SINGLE: 'single',
    MULTI: 'multi',
    ALL: 'all',
    
    // Advanced modes
    PROPORTIONAL: 'proportional',
    ASPECT_RATIO: 'aspect-ratio',
    GRID_SNAP: 'grid-snap',
    MAGNETIC: 'magnetic',
    SMART: 'smart'
};

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

export const RESIZE_CONSTRAINTS = {
    NONE: 'none',
    WIDTH: 'width',
    HEIGHT: 'height',
    ASPECT_RATIO: 'aspect-ratio',
    MIN_SIZE: 'min-size',
    MAX_SIZE: 'max-size',
    GRID: 'grid',
    MAGNETIC: 'magnetic'
};

export const RESIZE_ALGORITHMS = {
    // Basic algorithms
    LINEAR: 'linear',
    PROPORTIONAL: 'proportional',
    CENTERED: 'centered',
    
    // Advanced algorithms
    SMART: 'smart',
    MUSICAL: 'musical',
    RHYTHMIC: 'rhythmic',
    HARMONIC: 'harmonic'
};

/**
 * Batch Resize System
 * 
 * Bu sınıf, piano roll'da toplu resize operasyonları sağlar.
 * Emsal DAW'ların gelişmiş resize özelliklerini hedefler.
 */
export class BatchResizeSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            // Resize settings
            resize: {
                enabled: true,
                multiResize: true,
                proportionalResize: true,
                aspectRatioLock: false,
                gridSnap: true,
                magneticSnap: true,
                smartResize: true,
                musicalResize: true
            },
            
            // Constraints
            constraints: {
                minWidth: 0.25,
                maxWidth: 1000,
                minHeight: 0.25,
                maxHeight: 1000,
                aspectRatio: null,
                snapThreshold: 8,
                magneticThreshold: 12
            },
            
            // Grid settings
            grid: {
                enabled: true,
                size: 1,
                subdivisions: 4,
                snapToGrid: true,
                snapToSubdivisions: true
            },
            
            // Magnetic settings
            magnetic: {
                enabled: true,
                strength: 0.8,
                range: 20,
                points: [],
                autoDetect: true
            },
            
            // Smart resize settings
            smart: {
                enabled: true,
                algorithm: RESIZE_ALGORITHMS.SMART,
                preserveRhythm: true,
                preserveHarmony: true,
                preserveVelocity: false,
                preserveDuration: true
            },
            
            // Performance settings
            performance: {
                maxNotes: 1000,
                batchSize: 50,
                debounceMs: 16,
                throttleMs: 8,
                frameRate: 60
            },
            
            ...options
        };
        
        // State management
        this.state = {
            // Resize state
            isResizing: false,
            mode: RESIZE_MODES.SINGLE,
            handles: new Set(),
            startPosition: null,
            currentPosition: null,
            originalSizes: new Map(),
            constraints: null,
            snapPoints: [],
            magneticPoints: [],
            
            // Multi-note state
            selectedNotes: new Set(),
            groupBounds: null,
            transformOrigin: null,
            transformMatrix: [1, 0, 0, 1, 0, 0],
            
            // Batch state
            batchQueue: [],
            isProcessing: false,
            processedCount: 0,
            totalCount: 0,
            
            // Performance state
            lastUpdate: 0,
            frameCount: 0,
            averageFrameTime: 16.67,
            droppedFrames: 0
        };
        
        // Resize algorithms
        this.algorithms = new Map();
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize the batch resize system
     */
    initialize() {
        this.setupResizeAlgorithms();
        this.setupPerformanceMonitoring();
        this.setupEventHandlers();
        
        console.log('🔧 Batch Resize System initialized');
    }
    
    /**
     * Setup resize algorithms
     */
    setupResizeAlgorithms() {
        // Linear resize algorithm
        this.algorithms.set(RESIZE_ALGORITHMS.LINEAR, {
            name: 'Linear',
            description: 'Simple linear resize',
            resize: (notes, delta, handle, options) => {
                return this.linearResize(notes, delta, handle, options);
            }
        });
        
        // Proportional resize algorithm
        this.algorithms.set(RESIZE_ALGORITHMS.PROPORTIONAL, {
            name: 'Proportional',
            description: 'Proportional resize maintaining ratios',
            resize: (notes, delta, handle, options) => {
                return this.proportionalResize(notes, delta, handle, options);
            }
        });
        
        // Centered resize algorithm
        this.algorithms.set(RESIZE_ALGORITHMS.CENTERED, {
            name: 'Centered',
            description: 'Resize from center point',
            resize: (notes, delta, handle, options) => {
                return this.centeredResize(notes, delta, handle, options);
            }
        });
        
        // Smart resize algorithm
        this.algorithms.set(RESIZE_ALGORITHMS.SMART, {
            name: 'Smart',
            description: 'Intelligent resize with musical awareness',
            resize: (notes, delta, handle, options) => {
                return this.smartResize(notes, delta, handle, options);
            }
        });
        
        // Musical resize algorithm
        this.algorithms.set(RESIZE_ALGORITHMS.MUSICAL, {
            name: 'Musical',
            description: 'Musical-aware resize preserving harmony',
            resize: (notes, delta, handle, options) => {
                return this.musicalResize(notes, delta, handle, options);
            }
        });
        
        // Rhythmic resize algorithm
        this.algorithms.set(RESIZE_ALGORITHMS.RHYTHMIC, {
            name: 'Rhythmic',
            description: 'Rhythm-preserving resize',
            resize: (notes, delta, handle, options) => {
                return this.rhythmicResize(notes, delta, handle, options);
            }
        });
        
        // Harmonic resize algorithm
        this.algorithms.set(RESIZE_ALGORITHMS.HARMONIC, {
            name: 'Harmonic',
            description: 'Harmony-preserving resize',
            resize: (notes, delta, handle, options) => {
                return this.harmonicResize(notes, delta, handle, options);
            }
        });
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
     * Setup event handlers
     */
    setupEventHandlers() {
        // Mouse events
        this.on('mousedown', this.handleMouseDown.bind(this));
        this.on('mousemove', this.handleMouseMove.bind(this));
        this.on('mouseup', this.handleMouseUp.bind(this));
        
        // Touch events
        this.on('touchstart', this.handleTouchStart.bind(this));
        this.on('touchmove', this.handleTouchMove.bind(this));
        this.on('touchend', this.handleTouchEnd.bind(this));
        
        // Keyboard events
        this.on('keydown', this.handleKeyDown.bind(this));
        this.on('keyup', this.handleKeyUp.bind(this));
    }
    
    /**
     * Start batch resize
     */
    startBatchResize(notes, handle, position, options = {}) {
        if (!this.config.resize.enabled) {
            console.warn('Batch resize is disabled');
            return;
        }
        
        if (notes.length === 0) {
            console.warn('No notes to resize');
            return;
        }
        
        // Update state
        this.state.isResizing = true;
        this.state.mode = options.mode || RESIZE_MODES.MULTI;
        this.state.handles.add(handle);
        this.state.startPosition = position;
        this.state.currentPosition = position;
        this.state.selectedNotes = new Set(notes.map(n => n.id));
        
        // Store original sizes
        notes.forEach(note => {
            this.state.originalSizes.set(note.id, {
                startTime: note.startTime,
                length: note.length,
                pitch: note.pitch,
                velocity: note.velocity
            });
        });
        
        // Calculate group bounds
        this.state.groupBounds = this.calculateGroupBounds(notes);
        
        // Calculate transform origin
        this.state.transformOrigin = this.calculateTransformOrigin(notes);
        
        // Set constraints
        this.state.constraints = this.calculateResizeConstraints(notes, handle);
        
        // Set snap points
        this.state.snapPoints = this.calculateSnapPoints(notes);
        
        // Set magnetic points
        this.state.magneticPoints = this.calculateMagneticPoints(notes);
        
        // Emit start event
        this.emit('resizeStart', {
            notes,
            handle,
            position,
            options,
            mode: this.state.mode,
            bounds: this.state.groupBounds
        });
    }
    
    /**
     * Update batch resize
     */
    updateBatchResize(position, options = {}) {
        if (!this.state.isResizing) return;
        
        this.state.currentPosition = position;
        
        // Calculate delta
        const delta = this.calculateDelta(position);
        
        // Get resize algorithm
        const algorithm = this.getResizeAlgorithm(options.algorithm);
        
        // Calculate new sizes
        const newSizes = algorithm.resize(
            this.getSelectedNotes(),
            delta,
            Array.from(this.state.handles)[0],
            options
        );
        
        // Apply constraints
        const constrainedSizes = this.applyResizeConstraints(newSizes);
        
        // Apply snap
        const snappedSizes = this.applySnap(constrainedSizes);
        
        // Apply magnetic
        const magneticSizes = this.applyMagnetic(snappedSizes);
        
        // Emit update event
        this.emit('resizeUpdate', {
            position,
            delta,
            sizes: magneticSizes,
            options,
            algorithm: algorithm.name
        });
    }
    
    /**
     * End batch resize
     */
    endBatchResize(position, options = {}) {
        if (!this.state.isResizing) return;
        
        // Calculate final sizes
        const delta = this.calculateDelta(position);
        const algorithm = this.getResizeAlgorithm(options.algorithm);
        const newSizes = algorithm.resize(
            this.getSelectedNotes(),
            delta,
            Array.from(this.state.handles)[0],
            options
        );
        
        const constrainedSizes = this.applyResizeConstraints(newSizes);
        const snappedSizes = this.applySnap(constrainedSizes);
        const magneticSizes = this.applyMagnetic(snappedSizes);
        
        // Reset state
        this.state.isResizing = false;
        this.state.handles.clear();
        this.state.originalSizes.clear();
        this.state.selectedNotes.clear();
        this.state.groupBounds = null;
        this.state.transformOrigin = null;
        this.state.constraints = null;
        this.state.snapPoints = [];
        this.state.magneticPoints = [];
        
        // Emit end event
        this.emit('resizeEnd', {
            position,
            sizes: magneticSizes,
            options,
            algorithm: algorithm.name
        });
    }
    
    /**
     * Cancel batch resize
     */
    cancelBatchResize() {
        if (!this.state.isResizing) return;
        
        // Reset state
        this.state.isResizing = false;
        this.state.handles.clear();
        this.state.originalSizes.clear();
        this.state.selectedNotes.clear();
        this.state.groupBounds = null;
        this.state.transformOrigin = null;
        this.state.constraints = null;
        this.state.snapPoints = [];
        this.state.magneticPoints = [];
        
        // Emit cancel event
        this.emit('resizeCancel');
    }
    
    /**
     * Linear resize algorithm
     */
    linearResize(notes, delta, handle, options) {
        const newSizes = new Map();
        
        notes.forEach(note => {
            const original = this.state.originalSizes.get(note.id);
            if (!original) return;
            
            let newSize = { ...original };
            
            // Apply resize based on handle
            switch (handle) {
                case RESIZE_HANDLES.LEFT:
                    newSize.startTime = original.startTime + delta.x;
                    newSize.length = original.length - delta.x;
                    break;
                case RESIZE_HANDLES.RIGHT:
                    newSize.length = original.length + delta.x;
                    break;
                case RESIZE_HANDLES.TOP:
                    newSize.pitch = original.pitch + delta.y;
                    break;
                case RESIZE_HANDLES.BOTTOM:
                    newSize.pitch = original.pitch + delta.y;
                    break;
                case RESIZE_HANDLES.ALL:
                    newSize.startTime = original.startTime + delta.x;
                    newSize.length = original.length + delta.x;
                    newSize.pitch = original.pitch + delta.y;
                    break;
            }
            
            newSizes.set(note.id, newSize);
        });
        
        return newSizes;
    }
    
    /**
     * Proportional resize algorithm
     */
    proportionalResize(notes, delta, handle, options) {
        const newSizes = new Map();
        
        // Calculate scale factors
        const scaleX = delta.x / this.state.groupBounds.width;
        const scaleY = delta.y / this.state.groupBounds.height;
        
        notes.forEach(note => {
            const original = this.state.originalSizes.get(note.id);
            if (!original) return;
            
            let newSize = { ...original };
            
            // Apply proportional resize
            switch (handle) {
                case RESIZE_HANDLES.LEFT:
                case RESIZE_HANDLES.RIGHT:
                    newSize.startTime = original.startTime + (original.startTime - this.state.groupBounds.x) * scaleX;
                    newSize.length = original.length * (1 + scaleX);
                    break;
                case RESIZE_HANDLES.TOP:
                case RESIZE_HANDLES.BOTTOM:
                    newSize.pitch = original.pitch + (original.pitch - this.state.groupBounds.y) * scaleY;
                    break;
                case RESIZE_HANDLES.ALL:
                    newSize.startTime = original.startTime + (original.startTime - this.state.groupBounds.x) * scaleX;
                    newSize.length = original.length * (1 + scaleX);
                    newSize.pitch = original.pitch + (original.pitch - this.state.groupBounds.y) * scaleY;
                    break;
            }
            
            newSizes.set(note.id, newSize);
        });
        
        return newSizes;
    }
    
    /**
     * Centered resize algorithm
     */
    centeredResize(notes, delta, handle, options) {
        const newSizes = new Map();
        const centerX = this.state.groupBounds.x + this.state.groupBounds.width / 2;
        const centerY = this.state.groupBounds.y + this.state.groupBounds.height / 2;
        
        notes.forEach(note => {
            const original = this.state.originalSizes.get(note.id);
            if (!original) return;
            
            let newSize = { ...original };
            
            // Calculate distance from center
            const distanceFromCenterX = original.startTime - centerX;
            const distanceFromCenterY = original.pitch - centerY;
            
            // Apply centered resize
            switch (handle) {
                case RESIZE_HANDLES.LEFT:
                case RESIZE_HANDLES.RIGHT:
                    newSize.startTime = centerX + distanceFromCenterX * (1 + delta.x / this.state.groupBounds.width);
                    newSize.length = original.length * (1 + delta.x / this.state.groupBounds.width);
                    break;
                case RESIZE_HANDLES.TOP:
                case RESIZE_HANDLES.BOTTOM:
                    newSize.pitch = centerY + distanceFromCenterY * (1 + delta.y / this.state.groupBounds.height);
                    break;
                case RESIZE_HANDLES.ALL:
                    newSize.startTime = centerX + distanceFromCenterX * (1 + delta.x / this.state.groupBounds.width);
                    newSize.length = original.length * (1 + delta.x / this.state.groupBounds.width);
                    newSize.pitch = centerY + distanceFromCenterY * (1 + delta.y / this.state.groupBounds.height);
                    break;
            }
            
            newSizes.set(note.id, newSize);
        });
        
        return newSizes;
    }
    
    /**
     * Smart resize algorithm
     */
    smartResize(notes, delta, handle, options) {
        if (!this.config.smart.enabled) {
            return this.linearResize(notes, delta, handle, options);
        }
        
        const newSizes = new Map();
        
        // Analyze musical context
        const context = this.analyzeMusicalContext(notes);
        
        // Apply smart resize based on context
        if (context.isRhythmic && this.config.smart.preserveRhythm) {
            return this.rhythmicResize(notes, delta, handle, options);
        } else if (context.isHarmonic && this.config.smart.preserveHarmony) {
            return this.harmonicResize(notes, delta, handle, options);
        } else {
            return this.proportionalResize(notes, delta, handle, options);
        }
    }
    
    /**
     * Musical resize algorithm
     */
    musicalResize(notes, delta, handle, options) {
        const newSizes = new Map();
        
        // Analyze musical properties
        const musicalContext = this.analyzeMusicalContext(notes);
        
        notes.forEach(note => {
            const original = this.state.originalSizes.get(note.id);
            if (!original) return;
            
            let newSize = { ...original };
            
            // Apply musical-aware resize
            if (musicalContext.isChord && handle === RESIZE_HANDLES.ALL) {
                // Preserve chord structure
                newSize = this.preserveChordStructure(original, delta, musicalContext);
            } else if (musicalContext.isScale && handle === RESIZE_HANDLES.TOP || handle === RESIZE_HANDLES.BOTTOM) {
                // Preserve scale structure
                newSize = this.preserveScaleStructure(original, delta, musicalContext);
            } else {
                // Default proportional resize
                newSize = this.proportionalResize([note], delta, handle, options).get(note.id);
            }
            
            newSizes.set(note.id, newSize);
        });
        
        return newSizes;
    }
    
    /**
     * Rhythmic resize algorithm
     */
    rhythmicResize(notes, delta, handle, options) {
        const newSizes = new Map();
        
        // Analyze rhythmic patterns
        const rhythmicContext = this.analyzeRhythmicContext(notes);
        
        notes.forEach(note => {
            const original = this.state.originalSizes.get(note.id);
            if (!original) return;
            
            let newSize = { ...original };
            
            // Preserve rhythmic relationships
            if (rhythmicContext.isPattern) {
                newSize = this.preserveRhythmicPattern(original, delta, rhythmicContext);
            } else {
                newSize = this.proportionalResize([note], delta, handle, options).get(note.id);
            }
            
            newSizes.set(note.id, newSize);
        });
        
        return newSizes;
    }
    
    /**
     * Harmonic resize algorithm
     */
    harmonicResize(notes, delta, handle, options) {
        const newSizes = new Map();
        
        // Analyze harmonic relationships
        const harmonicContext = this.analyzeHarmonicContext(notes);
        
        notes.forEach(note => {
            const original = this.state.originalSizes.get(note.id);
            if (!original) return;
            
            let newSize = { ...original };
            
            // Preserve harmonic relationships
            if (harmonicContext.isChord) {
                newSize = this.preserveHarmonicRelationships(original, delta, harmonicContext);
            } else {
                newSize = this.proportionalResize([note], delta, handle, options).get(note.id);
            }
            
            newSizes.set(note.id, newSize);
        });
        
        return newSizes;
    }
    
    /**
     * Analyze musical context
     */
    analyzeMusicalContext(notes) {
        const context = {
            isRhythmic: false,
            isHarmonic: false,
            isChord: false,
            isScale: false,
            patterns: [],
            relationships: []
        };
        
        // Analyze rhythmic patterns
        const durations = notes.map(n => n.length);
        const uniqueDurations = [...new Set(durations)];
        context.isRhythmic = uniqueDurations.length < durations.length;
        
        // Analyze harmonic relationships
        const pitches = notes.map(n => n.pitch);
        const intervals = this.calculateIntervals(pitches);
        context.isHarmonic = this.isHarmonic(intervals);
        context.isChord = this.isChord(intervals);
        context.isScale = this.isScale(intervals);
        
        return context;
    }
    
    /**
     * Analyze rhythmic context
     */
    analyzeRhythmicContext(notes) {
        const context = {
            isPattern: false,
            patterns: [],
            relationships: []
        };
        
        // Analyze duration patterns
        const durations = notes.map(n => n.length);
        const patterns = this.findRhythmicPatterns(durations);
        context.isPattern = patterns.length > 0;
        context.patterns = patterns;
        
        return context;
    }
    
    /**
     * Analyze harmonic context
     */
    analyzeHarmonicContext(notes) {
        const context = {
            isChord: false,
            isScale: false,
            relationships: []
        };
        
        // Analyze pitch relationships
        const pitches = notes.map(n => n.pitch);
        const intervals = this.calculateIntervals(pitches);
        context.isChord = this.isChord(intervals);
        context.isScale = this.isScale(intervals);
        context.relationships = intervals;
        
        return context;
    }
    
    /**
     * Calculate intervals between pitches
     */
    calculateIntervals(pitches) {
        const intervals = [];
        for (let i = 1; i < pitches.length; i++) {
            intervals.push(pitches[i] - pitches[i - 1]);
        }
        return intervals;
    }
    
    /**
     * Check if intervals form a chord
     */
    isChord(intervals) {
        const chordIntervals = [3, 4, 7]; // Major third, perfect fourth, perfect fifth
        return intervals.some(interval => chordIntervals.includes(interval % 12));
    }
    
    /**
     * Check if intervals form a scale
     */
    isScale(intervals) {
        const scaleIntervals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        return intervals.every(interval => scaleIntervals.includes(interval % 12));
    }
    
    /**
     * Check if intervals are harmonic
     */
    isHarmonic(intervals) {
        const harmonicIntervals = [3, 4, 5, 7, 8, 9]; // Consonant intervals
        return intervals.some(interval => harmonicIntervals.includes(interval % 12));
    }
    
    /**
     * Find rhythmic patterns
     */
    findRhythmicPatterns(durations) {
        const patterns = [];
        const patternLength = Math.min(4, durations.length);
        
        for (let i = 0; i <= durations.length - patternLength; i++) {
            const pattern = durations.slice(i, i + patternLength);
            const isRepeated = this.isPatternRepeated(pattern, durations, i + patternLength);
            if (isRepeated) {
                patterns.push(pattern);
            }
        }
        
        return patterns;
    }
    
    /**
     * Check if pattern is repeated
     */
    isPatternRepeated(pattern, durations, startIndex) {
        for (let i = startIndex; i <= durations.length - pattern.length; i += pattern.length) {
            const slice = durations.slice(i, i + pattern.length);
            if (!this.arraysEqual(pattern, slice)) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Check if two arrays are equal
     */
    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, i) => val === b[i]);
    }
    
    /**
     * Preserve chord structure
     */
    preserveChordStructure(original, delta, context) {
        // Implement chord structure preservation
        return original;
    }
    
    /**
     * Preserve scale structure
     */
    preserveScaleStructure(original, delta, context) {
        // Implement scale structure preservation
        return original;
    }
    
    /**
     * Preserve rhythmic pattern
     */
    preserveRhythmicPattern(original, delta, context) {
        // Implement rhythmic pattern preservation
        return original;
    }
    
    /**
     * Preserve harmonic relationships
     */
    preserveHarmonicRelationships(original, delta, context) {
        // Implement harmonic relationship preservation
        return original;
    }
    
    /**
     * Calculate delta from position
     */
    calculateDelta(position) {
        if (!this.state.startPosition) return { x: 0, y: 0 };
        
        return {
            x: position.x - this.state.startPosition.x,
            y: position.y - this.state.startPosition.y
        };
    }
    
    /**
     * Get resize algorithm
     */
    getResizeAlgorithm(algorithmName) {
        const algorithm = this.algorithms.get(algorithmName);
        if (!algorithm) {
            console.warn(`Resize algorithm not found: ${algorithmName}`);
            return this.algorithms.get(RESIZE_ALGORITHMS.LINEAR);
        }
        return algorithm;
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
     * Calculate resize constraints
     */
    calculateResizeConstraints(notes, handle) {
        const constraints = {
            minWidth: this.config.constraints.minWidth,
            maxWidth: this.config.constraints.maxWidth,
            minHeight: this.config.constraints.minHeight,
            maxHeight: this.config.constraints.maxHeight,
            aspectRatio: this.config.constraints.aspectRatio
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
        if (!this.config.grid.enabled) return [];
        
        const snapPoints = [];
        const gridSize = this.config.grid.size;
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
        if (!this.config.magnetic.enabled) return [];
        
        const magneticPoints = [];
        const threshold = this.config.magnetic.range;
        
        // Add magnetic points for other notes
        notes.forEach(note => {
            magneticPoints.push({
                x: note.startTime,
                y: note.pitch,
                type: 'note',
                strength: this.config.magnetic.strength
            });
            magneticPoints.push({
                x: note.startTime + note.length,
                y: note.pitch,
                type: 'note',
                strength: this.config.magnetic.strength
            });
        });
        
        return magneticPoints;
    }
    
    /**
     * Apply resize constraints
     */
    applyResizeConstraints(sizes) {
        const { constraints } = this.state;
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
        const { snapPoints } = this.state;
        if (!snapPoints.length) return sizes;
        
        const snappedSizes = new Map();
        const threshold = this.config.constraints.snapThreshold;
        
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
        const { magneticPoints } = this.state;
        if (!magneticPoints.length) return sizes;
        
        const magneticSizes = new Map();
        const threshold = this.config.constraints.magneticThreshold;
        
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
     * Get selected notes
     */
    getSelectedNotes() {
        // This would be implemented to get notes from the piano roll
        return [];
    }
    
    /**
     * Get current state
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
        this.state.originalSizes.clear();
        this.state.selectedNotes.clear();
        this.state.snapPoints = [];
        this.state.magneticPoints = [];
        console.log('🔧 Batch Resize System destroyed');
    }
}

export default BatchResizeSystem;
