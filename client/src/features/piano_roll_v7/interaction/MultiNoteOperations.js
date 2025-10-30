/**
 * Multi-Note Operations System - Advanced Piano Roll UX
 * 
 * Bu sistem, piano roll'da çoklu nota operasyonları sağlar.
 * Emsal DAW'ların gelişmiş özelliklerini hedefler.
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

// ✅ MULTI-NOTE OPERATION CONSTANTS
export const OPERATION_TYPES = {
    // Basic operations
    SELECT: 'select',
    DESELECT: 'deselect',
    DELETE: 'delete',
    COPY: 'copy',
    CUT: 'cut',
    PASTE: 'paste',
    DUPLICATE: 'duplicate',
    
    // Transform operations
    MOVE: 'move',
    RESIZE: 'resize',
    ROTATE: 'rotate',
    FLIP: 'flip',
    MIRROR: 'mirror',
    
    // Musical operations
    QUANTIZE: 'quantize',
    HUMANIZE: 'humanize',
    VELOCITY: 'velocity',
    DURATION: 'duration',
    PITCH: 'pitch',
    TRANSPOSE: 'transpose',
    
    // Pattern operations
    REPEAT: 'repeat',
    REVERSE: 'reverse',
    STRETCH: 'stretch',
    COMPRESS: 'compress',
    CHOP: 'chop',
    SLICE: 'slice',
    
    // Advanced operations
    ARPEGGIATE: 'arpeggiate',
    STRUM: 'strum',
    FLAM: 'flam',
    ROLL: 'roll',
    GLISSANDO: 'glissando',
    PORTAMENTO: 'portamento',
    
    // Special operations
    RANDOMIZE: 'randomize',
    SMOOTH: 'smooth',
    NORMALIZE: 'normalize',
    INVERT: 'invert',
    REVERSE: 'reverse'
};

export const OPERATION_MODES = {
    // Selection modes
    SINGLE: 'single',
    MULTIPLE: 'multiple',
    ALL: 'all',
    RANGE: 'range',
    PATTERN: 'pattern',
    
    // Transform modes
    RELATIVE: 'relative',
    ABSOLUTE: 'absolute',
    PERCENTAGE: 'percentage',
    OFFSET: 'offset',
    
    // Musical modes
    SCALE: 'scale',
    CHORD: 'chord',
    PROGRESSION: 'progression',
    RHYTHM: 'rhythm',
    GROOVE: 'groove'
};

export const OPERATION_PRIORITIES = {
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

export const OPERATION_STATES = {
    // Basic states
    IDLE: 'idle',
    PREPARING: 'preparing',
    EXECUTING: 'executing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    
    // Special states
    PAUSED: 'paused',
    RESUMED: 'resumed',
    UNDOING: 'undoing',
    REDOING: 'redoing'
};

/**
 * Multi-Note Operations System
 * 
 * Bu sınıf, piano roll'da çoklu nota operasyonları sağlar.
 * Emsal DAW'ların gelişmiş özelliklerini hedefler.
 */
export class MultiNoteOperations extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            // Operation settings
            maxNotes: 1000,
            maxOperations: 100,
            operationTimeout: 5000,
            
            // Performance settings
            batchSize: 50,
            debounceMs: 16,
            throttleMs: 8,
            
            // Musical settings
            scales: ['C major', 'G major', 'D major', 'A major', 'E major'],
            chords: ['C', 'G', 'Am', 'F', 'Dm', 'Em'],
            progressions: ['I-V-vi-IV', 'vi-IV-I-V', 'I-vi-IV-V'],
            
            // Quantization settings
            quantizeValues: [0.25, 0.5, 1, 2, 4, 8, 16],
            quantizeStrength: 1.0,
            quantizeSwing: 0.0,
            
            // Humanization settings
            humanizeAmount: 0.1,
            humanizeTiming: true,
            humanizeVelocity: true,
            humanizePitch: false,
            
            // Velocity settings
            velocityMin: 1,
            velocityMax: 127,
            velocityDefault: 100,
            velocityCurve: 'linear',
            
            // Duration settings
            durationMin: 0.25,
            durationMax: 16,
            durationDefault: 1,
            durationCurve: 'linear',
            
            // Pitch settings
            pitchMin: 0,
            pitchMax: 127,
            pitchDefault: 60,
            pitchCurve: 'linear',
            
            ...options
        };
        
        // State management
        this.state = {
            // Operation state
            currentOperation: null,
            operationHistory: [],
            operationQueue: [],
            isProcessing: false,
            
            // Selection state
            selectedNotes: new Set(),
            selectionHistory: [],
            maxSelectionHistory: 50,
            
            // Transform state
            transformOrigin: { x: 0, y: 0 },
            transformMatrix: [1, 0, 0, 1, 0, 0],
            transformHistory: [],
            
            // Musical state
            currentScale: 'C major',
            currentChord: 'C',
            currentProgression: 'I-V-vi-IV',
            currentRhythm: '4/4',
            currentGroove: 'straight',
            
            // Performance state
            lastUpdate: 0,
            frameCount: 0,
            averageFrameTime: 16.67,
            droppedFrames: 0
        };
        
        // Operation handlers
        this.operationHandlers = new Map();
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize the multi-note operations system
     */
    initialize() {
        this.setupOperationHandlers();
        this.setupPerformanceMonitoring();
        this.setupEventHandlers();
        
        console.log('🎹 Multi-Note Operations System initialized');
    }
    
    /**
     * Setup operation handlers
     */
    setupOperationHandlers() {
        // Basic operations
        this.operationHandlers.set(OPERATION_TYPES.SELECT, this.handleSelect.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.DESELECT, this.handleDeselect.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.DELETE, this.handleDelete.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.COPY, this.handleCopy.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.CUT, this.handleCut.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.PASTE, this.handlePaste.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.DUPLICATE, this.handleDuplicate.bind(this));
        
        // Transform operations
        this.operationHandlers.set(OPERATION_TYPES.MOVE, this.handleMove.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.RESIZE, this.handleResize.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.ROTATE, this.handleRotate.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.FLIP, this.handleFlip.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.MIRROR, this.handleMirror.bind(this));
        
        // Musical operations
        this.operationHandlers.set(OPERATION_TYPES.QUANTIZE, this.handleQuantize.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.HUMANIZE, this.handleHumanize.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.VELOCITY, this.handleVelocity.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.DURATION, this.handleDuration.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.PITCH, this.handlePitch.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.TRANSPOSE, this.handleTranspose.bind(this));
        
        // Pattern operations
        this.operationHandlers.set(OPERATION_TYPES.REPEAT, this.handleRepeat.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.REVERSE, this.handleReverse.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.STRETCH, this.handleStretch.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.COMPRESS, this.handleCompress.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.CHOP, this.handleChop.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.SLICE, this.handleSlice.bind(this));
        
        // Advanced operations
        this.operationHandlers.set(OPERATION_TYPES.ARPEGGIATE, this.handleArpeggiate.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.STRUM, this.handleStrum.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.FLAM, this.handleFlam.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.ROLL, this.handleRoll.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.GLISSANDO, this.handleGlissando.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.PORTAMENTO, this.handlePortamento.bind(this));
        
        // Special operations
        this.operationHandlers.set(OPERATION_TYPES.RANDOMIZE, this.handleRandomize.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.SMOOTH, this.handleSmooth.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.NORMALIZE, this.handleNormalize.bind(this));
        this.operationHandlers.set(OPERATION_TYPES.INVERT, this.handleInvert.bind(this));
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
        // Keyboard shortcuts
        this.on('keydown', this.handleKeyDown.bind(this));
        this.on('keyup', this.handleKeyUp.bind(this));
        
        // Mouse events
        this.on('mousedown', this.handleMouseDown.bind(this));
        this.on('mousemove', this.handleMouseMove.bind(this));
        this.on('mouseup', this.handleMouseUp.bind(this));
        
        // Touch events
        this.on('touchstart', this.handleTouchStart.bind(this));
        this.on('touchmove', this.handleTouchMove.bind(this));
        this.on('touchend', this.handleTouchEnd.bind(this));
    }
    
    /**
     * Execute operation
     */
    async executeOperation(type, notes, options = {}) {
        const operation = {
            id: this.generateOperationId(),
            type,
            notes: [...notes],
            options,
            timestamp: Date.now(),
            state: OPERATION_STATES.PREPARING
        };
        
        // Add to queue
        this.state.operationQueue.push(operation);
        
        // Emit operation start
        this.emit('operationStart', operation);
        
        try {
            // Get handler
            const handler = this.operationHandlers.get(type);
            if (!handler) {
                throw new Error(`Operation handler not found: ${type}`);
            }
            
            // Execute operation
            operation.state = OPERATION_STATES.EXECUTING;
            const result = await handler(notes, options);
            
            // Update state
            operation.state = OPERATION_STATES.COMPLETED;
            operation.result = result;
            
            // Add to history
            this.addToHistory(operation);
            
            // Emit operation complete
            this.emit('operationComplete', operation);
            
            return result;
            
        } catch (error) {
            // Update state
            operation.state = OPERATION_STATES.FAILED;
            operation.error = error;
            
            // Emit operation error
            this.emit('operationError', { operation, error });
            
            throw error;
        }
    }
    
    /**
     * Handle select operation
     */
    async handleSelect(notes, options) {
        const { mode = OPERATION_MODES.MULTIPLE, addToSelection = false } = options;
        
        if (mode === OPERATION_MODES.ALL) {
            // Select all notes
            const allNotes = this.getAllNotes();
            this.state.selectedNotes = new Set(allNotes.map(n => n.id));
        } else if (mode === OPERATION_MODES.RANGE) {
            // Select notes in range
            const { start, end } = options.range;
            const notesInRange = this.getNotesInRange(start, end);
            this.state.selectedNotes = new Set(notesInRange.map(n => n.id));
        } else {
            // Select specific notes
            if (addToSelection) {
                notes.forEach(note => this.state.selectedNotes.add(note.id));
            } else {
                this.state.selectedNotes = new Set(notes.map(n => n.id));
            }
        }
        
        // Add to selection history
        this.addToSelectionHistory();
        
        return {
            selectedCount: this.state.selectedNotes.size,
            selectedNotes: Array.from(this.state.selectedNotes)
        };
    }
    
    /**
     * Handle deselect operation
     */
    async handleDeselect(notes, options) {
        const { mode = OPERATION_MODES.MULTIPLE } = options;
        
        if (mode === OPERATION_MODES.ALL) {
            // Deselect all notes
            this.state.selectedNotes.clear();
        } else {
            // Deselect specific notes
            notes.forEach(note => this.state.selectedNotes.delete(note.id));
        }
        
        // Add to selection history
        this.addToSelectionHistory();
        
        return {
            selectedCount: this.state.selectedNotes.size,
            selectedNotes: Array.from(this.state.selectedNotes)
        };
    }
    
    /**
     * Handle delete operation
     */
    async handleDelete(notes, options) {
        const { mode = OPERATION_MODES.MULTIPLE } = options;
        
        let notesToDelete = notes;
        
        if (mode === OPERATION_MODES.ALL) {
            notesToDelete = this.getAllNotes();
        } else if (mode === OPERATION_MODES.SELECTED) {
            notesToDelete = this.getSelectedNotes();
        }
        
        // Delete notes
        const deletedIds = notesToDelete.map(note => note.id);
        this.deleteNotes(deletedIds);
        
        // Clear selection
        this.state.selectedNotes.clear();
        
        return {
            deletedCount: deletedIds.length,
            deletedIds
        };
    }
    
    /**
     * Handle copy operation
     */
    async handleCopy(notes, options) {
        const { mode = OPERATION_MODES.MULTIPLE } = options;
        
        let notesToCopy = notes;
        
        if (mode === OPERATION_MODES.SELECTED) {
            notesToCopy = this.getSelectedNotes();
        }
        
        // Copy notes to clipboard
        const clipboard = {
            notes: notesToCopy.map(note => ({ ...note })),
            timestamp: Date.now(),
            operation: 'copy'
        };
        
        this.setClipboard(clipboard);
        
        return {
            copiedCount: notesToCopy.length,
            clipboard
        };
    }
    
    /**
     * Handle cut operation
     */
    async handleCut(notes, options) {
        // Copy first
        const copyResult = await this.handleCopy(notes, options);
        
        // Then delete
        const deleteResult = await this.handleDelete(notes, options);
        
        return {
            ...copyResult,
            ...deleteResult,
            operation: 'cut'
        };
    }
    
    /**
     * Handle paste operation
     */
    async handlePaste(notes, options) {
        const { position, mode = OPERATION_MODES.RELATIVE } = options;
        
        const clipboard = this.getClipboard();
        if (!clipboard || !clipboard.notes) {
            throw new Error('Clipboard is empty');
        }
        
        // Calculate paste position
        const pastePosition = this.calculatePastePosition(position, mode, clipboard);
        
        // Create new notes
        const newNotes = clipboard.notes.map(note => ({
            ...note,
            id: this.generateNoteId(),
            startTime: note.startTime + pastePosition.time,
            pitch: note.pitch + pastePosition.pitch
        }));
        
        // Add notes
        this.addNotes(newNotes);
        
        // Select pasted notes
        this.state.selectedNotes = new Set(newNotes.map(n => n.id));
        
        return {
            pastedCount: newNotes.length,
            newNotes
        };
    }
    
    /**
     * Handle duplicate operation
     */
    async handleDuplicate(notes, options) {
        const { offset = { time: 1, pitch: 0 }, mode = OPERATION_MODES.RELATIVE } = options;
        
        let notesToDuplicate = notes;
        
        if (mode === OPERATION_MODES.SELECTED) {
            notesToDuplicate = this.getSelectedNotes();
        }
        
        // Create duplicates
        const duplicatedNotes = notesToDuplicate.map(note => ({
            ...note,
            id: this.generateNoteId(),
            startTime: note.startTime + offset.time,
            pitch: note.pitch + offset.pitch
        }));
        
        // Add duplicates
        this.addNotes(duplicatedNotes);
        
        // Select duplicated notes
        this.state.selectedNotes = new Set(duplicatedNotes.map(n => n.id));
        
        return {
            duplicatedCount: duplicatedNotes.length,
            duplicatedNotes
        };
    }
    
    /**
     * Handle move operation
     */
    async handleMove(notes, options) {
        const { offset, mode = OPERATION_MODES.RELATIVE } = options;
        
        let notesToMove = notes;
        
        if (mode === OPERATION_MODES.SELECTED) {
            notesToMove = this.getSelectedNotes();
        }
        
        // Calculate new positions
        const movedNotes = notesToMove.map(note => ({
            ...note,
            startTime: note.startTime + offset.time,
            pitch: note.pitch + offset.pitch
        }));
        
        // Update notes
        this.updateNotes(movedNotes);
        
        return {
            movedCount: movedNotes.length,
            movedNotes
        };
    }
    
    /**
     * Handle resize operation
     */
    async handleResize(notes, options) {
        const { scale, mode = OPERATION_MODES.RELATIVE } = options;
        
        let notesToResize = notes;
        
        if (mode === OPERATION_MODES.SELECTED) {
            notesToResize = this.getSelectedNotes();
        }
        
        // Calculate new sizes
        const resizedNotes = notesToResize.map(note => ({
            ...note,
            length: note.length * scale
        }));
        
        // Update notes
        this.updateNotes(resizedNotes);
        
        return {
            resizedCount: resizedNotes.length,
            resizedNotes
        };
    }
    
    /**
     * Handle quantize operation
     */
    async handleQuantize(notes, options) {
        const { 
            value = 1, 
            strength = this.config.quantizeStrength,
            swing = this.config.quantizeSwing,
            mode = OPERATION_MODES.RELATIVE 
        } = options;
        
        let notesToQuantize = notes;
        
        if (mode === OPERATION_MODES.SELECTED) {
            notesToQuantize = this.getSelectedNotes();
        }
        
        // Quantize notes
        const quantizedNotes = notesToQuantize.map(note => {
            const quantizedTime = this.quantizeTime(note.startTime, value, strength, swing);
            return {
                ...note,
                startTime: quantizedTime
            };
        });
        
        // Update notes
        this.updateNotes(quantizedNotes);
        
        return {
            quantizedCount: quantizedNotes.length,
            quantizedNotes
        };
    }
    
    /**
     * Handle humanize operation
     */
    async handleHumanize(notes, options) {
        const { 
            amount = this.config.humanizeAmount,
            timing = this.config.humanizeTiming,
            velocity = this.config.humanizeVelocity,
            pitch = this.config.humanizePitch,
            mode = OPERATION_MODES.RELATIVE 
        } = options;
        
        let notesToHumanize = notes;
        
        if (mode === OPERATION_MODES.SELECTED) {
            notesToHumanize = this.getSelectedNotes();
        }
        
        // Humanize notes
        const humanizedNotes = notesToHumanize.map(note => {
            const humanizedNote = { ...note };
            
            if (timing) {
                const timeVariation = (Math.random() - 0.5) * amount * 2;
                humanizedNote.startTime += timeVariation;
            }
            
            if (velocity) {
                const velocityVariation = (Math.random() - 0.5) * amount * 20;
                humanizedNote.velocity = Math.max(1, Math.min(127, 
                    humanizedNote.velocity + velocityVariation));
            }
            
            if (pitch) {
                const pitchVariation = (Math.random() - 0.5) * amount * 2;
                humanizedNote.pitch = Math.max(0, Math.min(127, 
                    humanizedNote.pitch + pitchVariation));
            }
            
            return humanizedNote;
        });
        
        // Update notes
        this.updateNotes(humanizedNotes);
        
        return {
            humanizedCount: humanizedNotes.length,
            humanizedNotes
        };
    }
    
    /**
     * Handle velocity operation
     */
    async handleVelocity(notes, options) {
        const { 
            value, 
            mode = OPERATION_MODES.RELATIVE,
            curve = this.config.velocityCurve 
        } = options;
        
        let notesToModify = notes;
        
        if (mode === OPERATION_MODES.SELECTED) {
            notesToModify = this.getSelectedNotes();
        }
        
        // Modify velocity
        const modifiedNotes = notesToModify.map(note => {
            let newVelocity = note.velocity;
            
            if (mode === OPERATION_MODES.RELATIVE) {
                newVelocity += value;
            } else if (mode === OPERATION_MODES.ABSOLUTE) {
                newVelocity = value;
            } else if (mode === OPERATION_MODES.PERCENTAGE) {
                newVelocity *= value;
            }
            
            // Apply curve
            newVelocity = this.applyCurve(newVelocity, curve);
            
            // Clamp to valid range
            newVelocity = Math.max(this.config.velocityMin, 
                Math.min(this.config.velocityMax, newVelocity));
            
            return {
                ...note,
                velocity: Math.round(newVelocity)
            };
        });
        
        // Update notes
        this.updateNotes(modifiedNotes);
        
        return {
            modifiedCount: modifiedNotes.length,
            modifiedNotes
        };
    }
    
    /**
     * Handle duration operation
     */
    async handleDuration(notes, options) {
        const { 
            value, 
            mode = OPERATION_MODES.RELATIVE,
            curve = this.config.durationCurve 
        } = options;
        
        let notesToModify = notes;
        
        if (mode === OPERATION_MODES.SELECTED) {
            notesToModify = this.getSelectedNotes();
        }
        
        // Modify duration
        const modifiedNotes = notesToModify.map(note => {
            let newDuration = note.length;
            
            if (mode === OPERATION_MODES.RELATIVE) {
                newDuration += value;
            } else if (mode === OPERATION_MODES.ABSOLUTE) {
                newDuration = value;
            } else if (mode === OPERATION_MODES.PERCENTAGE) {
                newDuration *= value;
            }
            
            // Apply curve
            newDuration = this.applyCurve(newDuration, curve);
            
            // Clamp to valid range
            newDuration = Math.max(this.config.durationMin, 
                Math.min(this.config.durationMax, newDuration));
            
            return {
                ...note,
                length: newDuration
            };
        });
        
        // Update notes
        this.updateNotes(modifiedNotes);
        
        return {
            modifiedCount: modifiedNotes.length,
            modifiedNotes
        };
    }
    
    /**
     * Handle pitch operation
     */
    async handlePitch(notes, options) {
        const { 
            value, 
            mode = OPERATION_MODES.RELATIVE,
            curve = this.config.pitchCurve 
        } = options;
        
        let notesToModify = notes;
        
        if (mode === OPERATION_MODES.SELECTED) {
            notesToModify = this.getSelectedNotes();
        }
        
        // Modify pitch
        const modifiedNotes = notesToModify.map(note => {
            let newPitch = note.pitch;
            
            if (mode === OPERATION_MODES.RELATIVE) {
                newPitch += value;
            } else if (mode === OPERATION_MODES.ABSOLUTE) {
                newPitch = value;
            } else if (mode === OPERATION_MODES.PERCENTAGE) {
                newPitch *= value;
            }
            
            // Apply curve
            newPitch = this.applyCurve(newPitch, curve);
            
            // Clamp to valid range
            newPitch = Math.max(this.config.pitchMin, 
                Math.min(this.config.pitchMax, newPitch));
            
            return {
                ...note,
                pitch: Math.round(newPitch)
            };
        });
        
        // Update notes
        this.updateNotes(modifiedNotes);
        
        return {
            modifiedCount: modifiedNotes.length,
            modifiedNotes
        };
    }
    
    /**
     * Handle transpose operation
     */
    async handleTranspose(notes, options) {
        const { semitones, mode = OPERATION_MODES.RELATIVE } = options;
        
        return await this.handlePitch(notes, {
            value: semitones,
            mode: OPERATION_MODES.RELATIVE
        });
    }
    
    /**
     * Quantize time value
     */
    quantizeTime(time, value, strength, swing) {
        const quantized = Math.round(time / value) * value;
        const swingOffset = swing * (value / 2);
        const finalTime = quantized + (swingOffset * strength);
        
        return finalTime;
    }
    
    /**
     * Apply curve to value
     */
    applyCurve(value, curve) {
        switch (curve) {
            case 'linear':
                return value;
            case 'exponential':
                return Math.pow(value, 2);
            case 'logarithmic':
                return Math.sqrt(value);
            case 'sine':
                return Math.sin(value * Math.PI / 2);
            case 'cosine':
                return Math.cos(value * Math.PI / 2);
            default:
                return value;
        }
    }
    
    /**
     * Generate operation ID
     */
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    
    /**
     * Generate note ID
     */
    generateNoteId() {
        return `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    
    /**
     * Add to operation history
     */
    addToHistory(operation) {
        this.state.operationHistory.push(operation);
        
        // Keep only last N operations
        if (this.state.operationHistory.length > this.config.maxOperations) {
            this.state.operationHistory.shift();
        }
    }
    
    /**
     * Add to selection history
     */
    addToSelectionHistory() {
        this.state.selectionHistory.push({
            selectedNotes: new Set(this.state.selectedNotes),
            timestamp: Date.now()
        });
        
        // Keep only last N selections
        if (this.state.selectionHistory.length > this.state.maxSelectionHistory) {
            this.state.selectionHistory.shift();
        }
    }
    
    /**
     * Get all notes (placeholder)
     */
    getAllNotes() {
        // This would be implemented to get notes from the piano roll
        return [];
    }
    
    /**
     * Get selected notes
     */
    getSelectedNotes() {
        const allNotes = this.getAllNotes();
        return allNotes.filter(note => this.state.selectedNotes.has(note.id));
    }
    
    /**
     * Get notes in range
     */
    getNotesInRange(start, end) {
        const allNotes = this.getAllNotes();
        return allNotes.filter(note => 
            note.startTime >= start && note.startTime <= end
        );
    }
    
    /**
     * Calculate paste position
     */
    calculatePastePosition(position, mode, clipboard) {
        if (mode === OPERATION_MODES.ABSOLUTE) {
            return position;
        } else if (mode === OPERATION_MODES.RELATIVE) {
            return {
                time: position.time + clipboard.notes[0].startTime,
                pitch: position.pitch + clipboard.notes[0].pitch
            };
        }
        
        return position;
    }
    
    /**
     * Set clipboard
     */
    setClipboard(clipboard) {
        this.state.clipboard = clipboard;
    }
    
    /**
     * Get clipboard
     */
    getClipboard() {
        return this.state.clipboard;
    }
    
    /**
     * Add notes (placeholder)
     */
    addNotes(notes) {
        // This would be implemented to add notes to the piano roll
        console.log('Adding notes:', notes);
    }
    
    /**
     * Update notes (placeholder)
     */
    updateNotes(notes) {
        // This would be implemented to update notes in the piano roll
        console.log('Updating notes:', notes);
    }
    
    /**
     * Delete notes (placeholder)
     */
    deleteNotes(noteIds) {
        // This would be implemented to delete notes from the piano roll
        console.log('Deleting notes:', noteIds);
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
        this.state.operationQueue = [];
        this.state.operationHistory = [];
        this.state.selectionHistory = [];
        console.log('🎹 Multi-Note Operations System destroyed');
    }
}

export default MultiNoteOperations;
