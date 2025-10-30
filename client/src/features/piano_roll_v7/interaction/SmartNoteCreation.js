/**
 * Smart Note Creation System - Intelligent Piano Roll UX
 * 
 * Bu sistem, piano roll'da akıllı nota oluşturma ve düzenleme sağlar.
 * Kullanıcı deneyimini artırmak için context-aware davranışlar içerir.
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

// ✅ SMART NOTE CREATION CONSTANTS
export const NOTE_CREATION_MODES = {
    // Basic modes
    SINGLE: 'single',
    MULTIPLE: 'multiple',
    CONTINUOUS: 'continuous',
    
    // Smart modes
    SMART: 'smart',
    CONTEXT_AWARE: 'context-aware',
    PATTERN_BASED: 'pattern-based',
    
    // Special modes
    QUANTIZED: 'quantized',
    HUMANIZED: 'humanized',
    VELOCITY_LAYERED: 'velocity-layered'
};

export const CONTEXT_TYPES = {
    // Musical context
    SCALE: 'scale',
    CHORD: 'chord',
    PROGRESSION: 'progression',
    RHYTHM: 'rhythm',
    
    // Spatial context
    GRID: 'grid',
    SNAP: 'snap',
    ALIGNMENT: 'alignment',
    
    // Temporal context
    TIMING: 'timing',
    DURATION: 'duration',
    VELOCITY: 'velocity',
    
    // Pattern context
    REPETITION: 'repetition',
    VARIATION: 'variation',
    SEQUENCE: 'sequence'
};

export const INTELLIGENCE_LEVELS = {
    // Basic intelligence
    BASIC: 'basic',
    
    // Intermediate intelligence
    INTERMEDIATE: 'intermediate',
    
    // Advanced intelligence
    ADVANCED: 'advanced',
    
    // Expert intelligence
    EXPERT: 'expert'
};

/**
 * Smart Note Creation System
 * 
 * Bu sınıf, piano roll'da akıllı nota oluşturma ve düzenleme sağlar.
 * Context-aware davranışlar ve intelligent defaults içerir.
 */
export class SmartNoteCreation extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            // Intelligence settings
            intelligenceLevel: INTELLIGENCE_LEVELS.INTERMEDIATE,
            contextAwareness: true,
            patternRecognition: true,
            musicalIntelligence: true,
            
            // Default settings
            defaults: {
                duration: 1, // 1 step
                velocity: 100,
                pitch: 60, // C4
                snapToGrid: true,
                quantize: true
            },
            
            // Smart settings
            smart: {
                // Duration intelligence
                durationMemory: true,
                durationContext: true,
                durationPatterns: true,
                
                // Velocity intelligence
                velocityLayering: true,
                velocityContext: true,
                velocityPatterns: true,
                
                // Pitch intelligence
                pitchContext: true,
                scaleAwareness: true,
                chordAwareness: true,
                
                // Timing intelligence
                timingContext: true,
                rhythmAwareness: true,
                grooveAwareness: true
            },
            
            // Context settings
            context: {
                // Musical context
                scales: ['C major', 'G major', 'D major', 'A major', 'E major'],
                chords: ['C', 'G', 'Am', 'F', 'Dm', 'Em'],
                progressions: ['I-V-vi-IV', 'vi-IV-I-V', 'I-vi-IV-V'],
                
                // Rhythm context
                timeSignatures: ['4/4', '3/4', '2/4'],
                tempos: [120, 140, 160, 180],
                grooveTypes: ['straight', 'swing', 'shuffle']
            },
            
            // Pattern recognition
            patterns: {
                // Duration patterns
                durationPatterns: [
                    { pattern: [1, 1, 1, 1], name: 'quarter notes' },
                    { pattern: [0.5, 0.5, 0.5, 0.5], name: 'eighth notes' },
                    { pattern: [2, 1, 1], name: 'dotted quarter' },
                    { pattern: [1, 0.5, 0.5], name: 'quarter eighth' }
                ],
                
                // Velocity patterns
                velocityPatterns: [
                    { pattern: [100, 80, 90, 85], name: 'accented' },
                    { pattern: [70, 70, 70, 70], name: 'soft' },
                    { pattern: [120, 100, 110, 105], name: 'strong' }
                ],
                
                // Pitch patterns
                pitchPatterns: [
                    { pattern: [60, 62, 64, 65], name: 'ascending' },
                    { pattern: [65, 64, 62, 60], name: 'descending' },
                    { pattern: [60, 64, 67, 72], name: 'arpeggio' }
                ]
            },
            
            ...options
        };
        
        // State management
        this.state = {
            // Creation state
            isCreating: false,
            creationMode: NOTE_CREATION_MODES.SINGLE,
            lastCreatedNote: null,
            creationHistory: [],
            
            // Context state
            currentContext: null,
            contextHistory: [],
            patternMemory: new Map(),
            
            // Intelligence state
            learnedPatterns: new Map(),
            userPreferences: new Map(),
            adaptationLevel: 0.5,
            
            // Smart state
            smartDefaults: {
                duration: 1,
                velocity: 100,
                pitch: 60
            },
            
            // Memory state
            memory: {
                lastDuration: 1,
                lastVelocity: 100,
                lastPitch: 60,
                durationHistory: [],
                velocityHistory: [],
                pitchHistory: []
            }
        };
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize the smart note creation system
     */
    initialize() {
        this.setupContextAwareness();
        this.setupPatternRecognition();
        this.setupIntelligenceEngine();
        this.setupMemorySystem();
        
        console.log('🧠 Smart Note Creation System initialized');
    }
    
    /**
     * Setup context awareness
     */
    setupContextAwareness() {
        this.contextAwareness = {
            // Current context
            current: null,
            
            // Context detection
            detect: (notes, position, userAction) => {
                const context = {
                    type: null,
                    confidence: 0,
                    data: {}
                };
                
                // Detect musical context
                if (this.config.smart.pitchContext) {
                    const pitchContext = this.detectPitchContext(notes, position);
                    if (pitchContext.confidence > context.confidence) {
                        context.type = CONTEXT_TYPES.SCALE;
                        context.confidence = pitchContext.confidence;
                        context.data = pitchContext;
                    }
                }
                
                // Detect rhythm context
                if (this.config.smart.timingContext) {
                    const rhythmContext = this.detectRhythmContext(notes, position);
                    if (rhythmContext.confidence > context.confidence) {
                        context.type = CONTEXT_TYPES.RHYTHM;
                        context.confidence = rhythmContext.confidence;
                        context.data = rhythmContext;
                    }
                }
                
                // Detect pattern context
                if (this.config.smart.patternRecognition) {
                    const patternContext = this.detectPatternContext(notes, position);
                    if (patternContext.confidence > context.confidence) {
                        context.type = CONTEXT_TYPES.PATTERN;
                        context.confidence = patternContext.confidence;
                        context.data = patternContext;
                    }
                }
                
                return context;
            },
            
            // Update context
            update: (newContext) => {
                this.state.currentContext = newContext;
                this.state.contextHistory.push({
                    ...newContext,
                    timestamp: Date.now()
                });
                
                // Keep only last 50 contexts
                if (this.state.contextHistory.length > 50) {
                    this.state.contextHistory.shift();
                }
                
                this.emit('contextUpdate', newContext);
            }
        };
    }
    
    /**
     * Setup pattern recognition
     */
    setupPatternRecognition() {
        this.patternRecognition = {
            // Pattern detectors
            detectors: {
                duration: this.createPatternDetector('duration'),
                velocity: this.createPatternDetector('velocity'),
                pitch: this.createPatternDetector('pitch'),
                rhythm: this.createPatternDetector('rhythm')
            },
            
            // Pattern matching
            match: (pattern, data) => {
                const matches = [];
                
                for (let i = 0; i <= data.length - pattern.length; i++) {
                    const slice = data.slice(i, i + pattern.length);
                    const similarity = this.calculateSimilarity(pattern, slice);
                    
                    if (similarity > 0.8) {
                        matches.push({
                            start: i,
                            end: i + pattern.length,
                            similarity,
                            pattern: slice
                        });
                    }
                }
                
                return matches;
            },
            
            // Learn patterns
            learn: (pattern, type) => {
                if (!this.state.learnedPatterns.has(type)) {
                    this.state.learnedPatterns.set(type, []);
                }
                
                const patterns = this.state.learnedPatterns.get(type);
                patterns.push({
                    pattern,
                    timestamp: Date.now(),
                    frequency: 1
                });
                
                // Keep only last 100 patterns per type
                if (patterns.length > 100) {
                    patterns.shift();
                }
                
                this.emit('patternLearned', { type, pattern });
            }
        };
    }
    
    /**
     * Setup intelligence engine
     */
    setupIntelligenceEngine() {
        this.intelligenceEngine = {
            // Smart defaults
            generateSmartDefaults: (context, userAction) => {
                const defaults = { ...this.config.defaults };
                
                // Apply context-aware intelligence
                if (context && context.type) {
                    switch (context.type) {
                        case CONTEXT_TYPES.SCALE:
                            defaults.pitch = this.suggestPitchFromScale(context.data);
                            break;
                        case CONTEXT_TYPES.RHYTHM:
                            defaults.duration = this.suggestDurationFromRhythm(context.data);
                            break;
                        case CONTEXT_TYPES.PATTERN:
                            defaults = this.applyPatternIntelligence(defaults, context.data);
                            break;
                    }
                }
                
                // Apply user preferences
                defaults = this.applyUserPreferences(defaults);
                
                // Apply learned patterns
                defaults = this.applyLearnedPatterns(defaults);
                
                return defaults;
            },
            
            // Context-aware suggestions
            suggestPitch: (context, position) => {
                if (!context || context.type !== CONTEXT_TYPES.SCALE) {
                    return this.state.memory.lastPitch;
                }
                
                const scale = context.data.scale;
                const positionInScale = this.getPositionInScale(position, scale);
                
                return this.getPitchFromScalePosition(scale, positionInScale);
            },
            
            suggestDuration: (context, position) => {
                if (!context || context.type !== CONTEXT_TYPES.RHYTHM) {
                    return this.state.memory.lastDuration;
                }
                
                const rhythm = context.data.rhythm;
                const positionInRhythm = this.getPositionInRhythm(position, rhythm);
                
                return this.getDurationFromRhythmPosition(rhythm, positionInRhythm);
            },
            
            suggestVelocity: (context, position) => {
                if (!context || context.type !== CONTEXT_TYPES.PATTERN) {
                    return this.state.memory.lastVelocity;
                }
                
                const pattern = context.data.pattern;
                const positionInPattern = this.getPositionInPattern(position, pattern);
                
                return this.getVelocityFromPatternPosition(pattern, positionInPattern);
            }
        };
    }
    
    /**
     * Setup memory system
     */
    setupMemorySystem() {
        this.memorySystem = {
            // Remember note creation
            rememberNote: (note) => {
                this.state.memory.lastDuration = note.duration;
                this.state.memory.lastVelocity = note.velocity;
                this.state.memory.lastPitch = note.pitch;
                
                // Add to history
                this.state.memory.durationHistory.push(note.duration);
                this.state.memory.velocityHistory.push(note.velocity);
                this.state.memory.pitchHistory.push(note.pitch);
                
                // Keep only last 100 entries
                if (this.state.memory.durationHistory.length > 100) {
                    this.state.memory.durationHistory.shift();
                }
                if (this.state.memory.velocityHistory.length > 100) {
                    this.state.memory.velocityHistory.shift();
                }
                if (this.state.memory.pitchHistory.length > 100) {
                    this.state.memory.pitchHistory.shift();
                }
                
                // Update smart defaults
                this.updateSmartDefaults();
                
                this.emit('noteRemembered', note);
            },
            
            // Update smart defaults based on memory
            updateSmartDefaults: () => {
                const durationHistory = this.state.memory.durationHistory;
                const velocityHistory = this.state.memory.velocityHistory;
                const pitchHistory = this.state.memory.pitchHistory;
                
                if (durationHistory.length > 0) {
                    this.state.smartDefaults.duration = this.calculateAverage(durationHistory);
                }
                
                if (velocityHistory.length > 0) {
                    this.state.smartDefaults.velocity = this.calculateAverage(velocityHistory);
                }
                
                if (pitchHistory.length > 0) {
                    this.state.smartDefaults.pitch = this.calculateAverage(pitchHistory);
                }
            }
        };
    }
    
    /**
     * Create smart note
     */
    createSmartNote(position, options = {}) {
        // Detect context
        const context = this.detectContext(position);
        
        // Generate smart defaults
        const smartDefaults = this.intelligenceEngine.generateSmartDefaults(context, options);
        
        // Create note with smart defaults
        const note = {
            id: this.generateNoteId(),
            startTime: position.time,
            pitch: options.pitch || smartDefaults.pitch,
            duration: options.duration || smartDefaults.duration,
            velocity: options.velocity || smartDefaults.velocity,
            instrumentId: options.instrumentId,
            timestamp: Date.now()
        };
        
        // Remember note for future intelligence
        this.memorySystem.rememberNote(note);
        
        // Emit creation event
        this.emit('noteCreated', { note, context, smartDefaults });
        
        return note;
    }
    
    /**
     * Detect context at position
     */
    detectContext(position) {
        const notes = this.getNotesAtPosition(position);
        const context = this.contextAwareness.detect(notes, position, 'note_creation');
        
        // Update context
        this.contextAwareness.update(context);
        
        return context;
    }
    
    /**
     * Detect pitch context
     */
    detectPitchContext(notes, position) {
        if (notes.length < 3) {
            return { confidence: 0, scale: null };
        }
        
        // Analyze pitch patterns
        const pitches = notes.map(n => n.pitch);
        const scale = this.analyzeScale(pitches);
        
        return {
            confidence: scale.confidence,
            scale: scale.name,
            notes: scale.notes,
            key: scale.key
        };
    }
    
    /**
     * Detect rhythm context
     */
    detectRhythmContext(notes, position) {
        if (notes.length < 3) {
            return { confidence: 0, rhythm: null };
        }
        
        // Analyze rhythm patterns
        const durations = notes.map(n => n.duration);
        const rhythm = this.analyzeRhythm(durations);
        
        return {
            confidence: rhythm.confidence,
            rhythm: rhythm.name,
            pattern: rhythm.pattern,
            tempo: rhythm.tempo
        };
    }
    
    /**
     * Detect pattern context
     */
    detectPatternContext(notes, position) {
        if (notes.length < 4) {
            return { confidence: 0, pattern: null };
        }
        
        // Analyze patterns
        const durationPattern = this.analyzeDurationPattern(notes);
        const velocityPattern = this.analyzeVelocityPattern(notes);
        const pitchPattern = this.analyzePitchPattern(notes);
        
        const confidence = Math.max(
            durationPattern.confidence,
            velocityPattern.confidence,
            pitchPattern.confidence
        );
        
        return {
            confidence,
            patterns: {
                duration: durationPattern,
                velocity: velocityPattern,
                pitch: pitchPattern
            }
        };
    }
    
    /**
     * Analyze scale from pitches
     */
    analyzeScale(pitches) {
        // Simple scale detection
        const uniquePitches = [...new Set(pitches)].sort((a, b) => a - b);
        const intervals = uniquePitches.slice(1).map((pitch, i) => pitch - uniquePitches[i]);
        
        // Check against known scales
        const knownScales = {
            'C major': [0, 2, 4, 5, 7, 9, 11],
            'G major': [0, 2, 4, 5, 7, 9, 11],
            'D major': [0, 2, 4, 5, 7, 9, 11],
            'A major': [0, 2, 4, 5, 7, 9, 11],
            'E major': [0, 2, 4, 5, 7, 9, 11]
        };
        
        let bestMatch = { name: 'C major', confidence: 0 };
        
        for (const [scaleName, scaleIntervals] of Object.entries(knownScales)) {
            const similarity = this.calculateScaleSimilarity(intervals, scaleIntervals);
            if (similarity > bestMatch.confidence) {
                bestMatch = { name: scaleName, confidence: similarity };
            }
        }
        
        return {
            ...bestMatch,
            notes: uniquePitches,
            intervals
        };
    }
    
    /**
     * Analyze rhythm from durations
     */
    analyzeRhythm(durations) {
        // Simple rhythm detection
        const uniqueDurations = [...new Set(durations)].sort((a, b) => a - b);
        const pattern = this.detectRhythmPattern(durations);
        
        return {
            confidence: pattern.confidence,
            name: pattern.name,
            pattern: pattern.pattern,
            tempo: 120 // Default tempo
        };
    }
    
    /**
     * Calculate similarity between two arrays
     */
    calculateSimilarity(arr1, arr2) {
        if (arr1.length !== arr2.length) return 0;
        
        let matches = 0;
        for (let i = 0; i < arr1.length; i++) {
            if (Math.abs(arr1[i] - arr2[i]) < 0.1) {
                matches++;
            }
        }
        
        return matches / arr1.length;
    }
    
    /**
     * Calculate scale similarity
     */
    calculateScaleSimilarity(intervals1, intervals2) {
        if (intervals1.length !== intervals2.length) return 0;
        
        let matches = 0;
        for (let i = 0; i < intervals1.length; i++) {
            if (intervals1[i] === intervals2[i]) {
                matches++;
            }
        }
        
        return matches / intervals1.length;
    }
    
    /**
     * Calculate average of array
     */
    calculateAverage(arr) {
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    }
    
    /**
     * Generate unique note ID
     */
    generateNoteId() {
        return `note_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    
    /**
     * Get notes at position (placeholder)
     */
    getNotesAtPosition(position) {
        // This would be implemented to get notes from the piano roll
        return [];
    }
    
    /**
     * Create pattern detector
     */
    createPatternDetector(type) {
        return {
            type,
            detect: (data) => {
                // Pattern detection logic
                return { confidence: 0, pattern: null };
            }
        };
    }
    
    /**
     * Apply user preferences
     */
    applyUserPreferences(defaults) {
        // Apply user preferences from state
        return defaults;
    }
    
    /**
     * Apply learned patterns
     */
    applyLearnedPatterns(defaults) {
        // Apply learned patterns from state
        return defaults;
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
        console.log('🧠 Smart Note Creation System destroyed');
    }
}

export default SmartNoteCreation;
