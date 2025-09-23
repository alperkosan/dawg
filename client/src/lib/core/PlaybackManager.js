// PlaybackManager.js - CRITICAL NOTE SCHEDULING FIX

import { NativeTimeUtils } from '../utils/NativeTimeUtils.js';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useArrangementStore } from '../../store/useArrangementStore';

export class PlaybackManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.transport = audioEngine.transport;
        
        // Playback state
        this.currentMode = 'pattern';
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPosition = 0;
        
        // Loop settings
        this.loopEnabled = true;
        this.loopStart = 0;
        this.loopEnd = 64;
        this.isAutoLoop = true;
        
        console.log('🎵 PlaybackManager initialized');
    }

    // ✅ CRITICAL FIX: Loop settings with proper conversion
    _updateLoopSettings() {
        if (!this.isAutoLoop) return;
        
        if (this.currentMode === 'pattern') {
            this._calculatePatternLoop();
        } else {
            this._calculateSongLoop();
        }
        
        this._updateTransportLoop();
    }

    _calculatePatternLoop() {
        const arrangementStore = useArrangementStore.getState();
        const activePattern = arrangementStore.patterns[arrangementStore.activePatternId];
        
        if (!activePattern) {
            this.loopStart = 0;
            this.loopEnd = 64;
            return;
        }
    
        // ✅ CRITICAL FIX: Calculate actual pattern length in STEPS
        let maxStep = 0;
        Object.values(activePattern.data).forEach(notes => {
            if (Array.isArray(notes)) {
                notes.forEach(note => {
                    // ✅ FIXED: note.time is in STEPS (16th note units)
                    const noteTime = note.time || 0;
                    const noteDuration = note.duration ? 
                        this._getDurationInSteps(note.duration) : 1;
                    const noteEnd = noteTime + noteDuration;
                    maxStep = Math.max(maxStep, noteEnd);
                });
            }
        });
    
        // ✅ FIXED: Pattern minimum 64 step (4 bars), round to bar boundaries
        this.patternLength = Math.max(64, Math.ceil(maxStep / 16) * 16);
        this.loopStart = 0;
        this.loopEnd = this.patternLength;
        
        console.log(`📏 Pattern loop calculated: 0 → ${this.loopEnd} steps (${this.loopEnd/16} bars)`);
        console.log(`   Max note step found: ${maxStep}`);
        console.log(`   Pattern length: ${this.patternLength} steps`);
    }

    _updateTransportLoop() {
        if (this.transport) {
            // ✅ CRITICAL: Pass STEPS to transport (transport will convert to ticks)
            this.transport.setLoopPoints(this.loopStart, this.loopEnd);
            this.transport.setLoopEnabled(this.loopEnabled);
            
            console.log(`🔁 Transport loop updated: ${this.loopStart} → ${this.loopEnd} steps`);
        }
    }

    // ✅ CRITICAL FIX: Content scheduling with proper time conversion
    _scheduleInstrumentNotes(instrument, notes, instrumentId) {
        notes.forEach(note => {
            // ✅ CRITICAL: Convert note.time (steps) to seconds
            const noteTimeInSteps = note.time || 0;
            const noteTimeInSeconds = this.transport.stepsToSeconds(noteTimeInSteps);
            
            const noteDuration = note.duration ? 
                NativeTimeUtils.parseTime(note.duration, this.transport.bpm) : 
                this.transport.stepsToSeconds(1); // Default 1 step duration
    
            // ✅ FIXED: Schedule with SECONDS (transport expects seconds)
            this.transport.scheduleEvent(
                noteTimeInSeconds,
                (scheduledTime) => {
                    try {
                        instrument.triggerNote(
                            note.pitch || 'C4',
                            note.velocity || 1,
                            scheduledTime,
                            noteDuration
                        );
                        console.log(`🎵 Note scheduled: ${instrumentId} - ${note.pitch} at step ${noteTimeInSteps} (${scheduledTime.toFixed(3)}s)`);
                    } catch (error) {
                        console.error(`❌ Note trigger failed: ${instrumentId}`, error);
                    }
                },
                { type: 'noteOn', instrumentId, note, step: noteTimeInSteps }
            );
    
            // Note release scheduling
            if (note.duration && note.duration !== 'trigger') {
                this.transport.scheduleEvent(
                    noteTimeInSeconds + noteDuration,
                    (scheduledTime) => {
                        try {
                            instrument.releaseNote(note.pitch || 'C4', scheduledTime);
                            console.log(`🎵 Note released: ${instrumentId} - ${note.pitch} at ${scheduledTime.toFixed(3)}s`);
                        } catch (error) {
                            console.error(`❌ Note release failed: ${instrumentId}`, error);
                        }
                    },
                    { type: 'noteOff', instrumentId, note }
                );
            }
        });
        
        console.log(`📋 Scheduled ${notes.length} notes for ${instrumentId}`);
    }

    // ✅ Time conversion utilities
    _stepsToSeconds(steps) {
        return this.transport.stepsToSeconds(steps);
    }

    _secondsToSteps(seconds) {
        return this.transport.secondsToSteps(seconds);
    }

    _getDurationInSteps(duration) {
        if (!duration) return 1;
        
        const bpm = this.transport.bpm || 120;
        const durationSeconds = NativeTimeUtils.parseTime(duration, bpm);
        return this._secondsToSteps(durationSeconds);
    }

    // ✅ Playback controls remain the same
    play(startStep = null) {
        if (this.isPlaying && !this.isPaused) {
            console.log('⚠️ Already playing');
            return;
        }

        try {
            // Determine start position
            if (startStep !== null) {
                this.currentPosition = startStep;
            } else if (!this.isPaused) {
                this.currentPosition = this.loopStart;
            }

            console.log(`▶️ Starting playback from step ${this.currentPosition} (${this.currentMode} mode)`);

            // ✅ CRITICAL: Update loop settings before scheduling
            this._updateLoopSettings();

            // Schedule content based on mode
            this._scheduleContent();

            // Start transport
            this.transport.start();

            this.isPlaying = true;
            this.isPaused = false;

            // Notify stores
            usePlaybackStore.getState().setPlaybackState('playing');

        } catch (error) {
            console.error('❌ Playback start failed:', error);
            throw error;
        }
    }

    stop() {
        if (!this.isPlaying && !this.isPaused) {
            console.log('⚠️ Already stopped');
            return;
        }

        try {
            this.transport.stop();
            this._clearScheduledEvents();
            
            this.isPlaying = false;
            this.isPaused = false;
            this.currentPosition = this.loopStart;
            
            console.log('⏹️ Playback stopped');
            
            // Notify stores
            usePlaybackStore.getState().setPlaybackState('stopped');
            
        } catch (error) {
            console.error('❌ Stop failed:', error);
        }
    }

    // ✅ Content scheduling
    _scheduleContent() {
        this._clearScheduledEvents();
        
        if (this.currentMode === 'pattern') {
            this._schedulePatternContent();
        } else {
            this._scheduleSongContent();
        }
    }

    _schedulePatternContent() {
        const arrangementStore = useArrangementStore.getState();
        const activePattern = arrangementStore.patterns[arrangementStore.activePatternId];
        
        if (!activePattern) {
            console.warn('⚠️ No active pattern to schedule');
            return;
        }

        console.log(`📋 Scheduling pattern: ${activePattern.name}`);
        console.log(`   Pattern data keys: ${Object.keys(activePattern.data)}`);

        // Schedule notes for each instrument
        Object.entries(activePattern.data).forEach(([instrumentId, notes]) => {
            if (!Array.isArray(notes) || notes.length === 0) {
                console.log(`   ${instrumentId}: No notes`);
                return;
            }
            
            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (!instrument) {
                console.warn(`⚠️ Instrument not found: ${instrumentId}`);
                return;
            }

            console.log(`   ${instrumentId}: ${notes.length} notes`);
            this._scheduleInstrumentNotes(instrument, notes, instrumentId);
        });
    }

    _clearScheduledEvents() {
        if (this.transport && this.transport.clearScheduledEvents) {
            this.transport.clearScheduledEvents();
        }
        
        console.log('🧹 Playback events cleared');
    }

    // Event system methods
    on(event, callback) {
        if (!this.eventListeners) {
            this.eventListeners = new Map();
        }
        
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        
        this.eventListeners.get(event).add(callback);
    }

    getPlaybackStatus() {
        return {
            mode: this.currentMode,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentPosition: this.currentPosition,
            loopStart: this.loopStart,
            loopEnd: this.loopEnd,
            loopEnabled: this.loopEnabled,
            isAutoLoop: this.isAutoLoop,
            bpm: this.transport?.bpm || 120
        };
    }
}