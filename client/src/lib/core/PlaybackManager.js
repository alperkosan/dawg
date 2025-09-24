// lib/core/PlaybackManager.js
// DAWG - Enhanced Playback System with Song/Pattern Modes

import { NativeTimeUtils } from '../utils/NativeTimeUtils.js';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import EventBus from './EventBus.js';
import { PositionTracker } from './PositionTracker.js';

/**
 * ⚡ PERFORMANCE OPTIMIZATION: Debounced Scheduling System
 * Prevents excessive rescheduling when multiple notes are added/removed rapidly
 */
class SchedulingOptimizer {
    constructor() {
        this.pendingSchedule = null;
        this.scheduleDebounceTime = 16; // ~60fps (16ms)
        this.lastScheduleReason = '';
        this.scheduleCount = 0;
    }

    requestSchedule(callback, reason = 'unknown') {
        // Cancel any pending schedule
        if (this.pendingSchedule) {
            clearTimeout(this.pendingSchedule);
        }

        this.lastScheduleReason = reason;
        this.scheduleCount++;

        // Schedule new callback with debounce
        this.pendingSchedule = setTimeout(() => {
            callback();
            this.pendingSchedule = null;
        }, this.scheduleDebounceTime);
    }

    forceExecute(callback, reason = 'force') {
        if (this.pendingSchedule) {
            clearTimeout(this.pendingSchedule);
            this.pendingSchedule = null;
        }
        callback();
    }

    isSchedulePending() {
        return this.pendingSchedule !== null;
    }
}

export class PlaybackManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.transport = audioEngine.transport;

        // ⚡ OPTIMIZATION: Initialize scheduling optimizer
        this.schedulingOptimizer = new SchedulingOptimizer();

        // ✅ NEW: Initialize position tracker
        this.positionTracker = new PositionTracker(this.transport);

        // ✅ EKLENDİ: Transport'tan gelen olayları dinlemek için.
        this._bindTransportEvents();

        // ✅ NEW: Centralized event management via EventBus
        this._bindGlobalEvents();

        // Playback state
        this.currentMode = 'pattern'; // 'pattern' | 'song'
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPosition = 0; // in steps
        
        // Loop settings
        this.loopEnabled = true;
        this.loopStart = 0; // in steps
        this.loopEnd = 64; // in steps
        this.isAutoLoop = true; // Auto calculate loop points
        
        // Pattern mode settings
        this.activePatternId = null;
        this.patternLength = 64;
        
        // Song mode settings
        this.songLength = 256; // in bars
        this.playbackCursor = 0; // Current playback position in song
        
        // Scheduling
        this.scheduledEvents = new Map();
        this.automationEvents = new Map();
        this.nextEventTime = Infinity;
        
    }

    /**
     * @private
     * Transport'tan gelen temel olayları (döngü gibi) dinler ve
     * bunlara göre yeniden planlama yapar.
     */
    _bindTransportEvents() {
        // ✅ MERKEZI LOOP HANDLING - Transport loop event'ini yakala
        this.transport.on('loop', (data) => {
            const { nextLoopStartTime, fromTick, toTick, time } = data;
            
            
            // ✅ MERKEZI RESTART HANDLING
            this._handleLoopRestart(nextLoopStartTime || time);
        });

        // ✅ BONUS: Diğer transport event'leri de merkezi olarak yönet
        this.transport.on('start', (data) => {
            this._emit('transportStart', data);
        });

        this.transport.on('stop', (data) => {

            // ✅ FIX: Reset position tracker and emit accurate position
            this.positionTracker.clearCache();
            this.currentPosition = this.loopStart;

            const position = this.positionTracker.jumpToStep(this.loopStart);
            const positionData = {
                step: position.step,
                tick: position.tick,
                bbt: position.bbt,
                formatted: position.bbt
            };
            this._emit('positionUpdate', positionData);

            this._emit('transportStop', data);
        });

        this.transport.on('pause', (data) => {

            // ✅ FIX: Get accurate position from PositionTracker and preserve it
            const position = this.positionTracker.getDisplayPosition();
            this.currentPosition = position.stepFloat;

            const positionData = {
                step: position.stepFloat,
                tick: position.tick,
                bbt: position.bbt,
                formatted: position.display
            };

            this._emit('positionUpdate', positionData);

            this._emit('transportPause', data);
        });

        this.transport.on('bar', (data) => {
            // Bar değişikliklerini UI'a bildir
            this._emit('barChange', data);
        });

        // ✅ BPM değişikliklerini dinle ve smooth transition sağla
        this.transport.on('bpm', (data) => {
            const { bpm, oldBpm, wasPlaying } = data;

            if (wasPlaying) {
                // BPM değişikliği sırasında playback devam ediyorsa,
                // yeniden scheduling YAP ama loop pozisyonunu KORUMA
                this._scheduleContent(null, 'bpm-change', true);
            }

            this._emit('bpmChange', { bpm, oldBpm, wasPlaying });
        });
    }

    /**
     * ✅ NEW: Centralized global event management
     * Handles all pattern/note changes through EventBus to prevent conflicts
     */
    _bindGlobalEvents() {
        // ✅ CRITICAL: Central pattern change handler
        EventBus.on('PATTERN_CHANGED', (data) => {
            this._handlePatternChange(data);
        });

        // ✅ CRITICAL: Central note events
        EventBus.on('NOTE_ADDED', (data) => {
            this._handleNoteAdded(data);
        });

        EventBus.on('NOTE_REMOVED', (data) => {
            this._handleNoteRemoved(data);
        });

        EventBus.on('NOTE_MODIFIED', (data) => {
            this._handleNoteModified(data);
        });

    }

    /**
     * ✅ NEW: Centralized pattern change handler
     * @param {Object} data - {patternId, changeType, ...}
     */
    _handlePatternChange(data) {
        const { patternId, changeType } = data;

        // Only handle active pattern changes
        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) {
            return;
        }


        // Pattern structure changes require full reschedule
        if (['structure-change', 'pattern-switch'].includes(changeType)) {
            this._scheduleContent(null, `pattern-${changeType}`, true);
        }
    }

    /**
     * ✅ NEW: Handle note addition with smart scheduling
     * @param {Object} data - {patternId, instrumentId, note}
     */
    _handleNoteAdded(data) {
        const { patternId, instrumentId, note } = data;

        // Only handle active pattern
        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;


        // ✅ CRITICAL: Only immediate scheduling during playback, no full reschedule
        if (this.isPlaying && !this.isPaused) {
            this._scheduleNewNotesImmediate([{ instrumentId, note }]);
        }
        // No else clause - we DON'T want full reschedule for single note additions
    }

    /**
     * ✅ NEW: Handle note removal
     * @param {Object} data - {patternId, instrumentId, noteId}
     */
    _handleNoteRemoved(data) {
        const { patternId } = data;

        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;


        // Note removal requires minimal handling during playback
        // The note will simply not be scheduled in next loop iteration
    }

    /**
     * ✅ NEW: Handle note modification
     * @param {Object} data - {patternId, instrumentId, note}
     */
    _handleNoteModified(data) {
        const { patternId, instrumentId, note } = data;

        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;


        // For note modifications, treat as remove + add
        if (this.isPlaying && !this.isPaused) {
            this._scheduleNewNotesImmediate([{ instrumentId, note }]);
        }
    }

    /**
     * ✅ FIXED: Loop restart handler with immediate position sync
     * @param {number} nextStartTime - Bir sonraki loop'un başlangıç zamanı
     */
    _handleLoopRestart(nextStartTime = null) {

        // ✅ CRITICAL: Immediately sync position to loop start for high BPM accuracy
        this.currentPosition = this.loopStart;

        // ✅ CRITICAL: Force transport position to loop start immediately
        if (this.transport.setPosition) {
            this.transport.setPosition(this.loopStart);
        }

        // Mevcut scheduled events'leri temizle
        this._clearScheduledEvents();

        // Content'i yeniden schedule et
        const startTime = nextStartTime || this.transport.audioContext.currentTime;
        this._scheduleContent(startTime, 'loop-restart', true); // Force immediate scheduling for loop restart

        // ✅ BONUS: Loop restart analytics
        this._trackLoopRestart();

        // UI'ı bilgilendir - use corrected position
        this._emit('loopRestart', {
            time: startTime,
            tick: this.loopStart * this.transport.ticksPerStep,
            step: this.loopStart,
            mode: this.currentMode,
            patternId: this.activePatternId
        });

    }

    /**
     * ✅ YENİ: Loop restart analytics/tracking
     * @private
     */
    _trackLoopRestart() {
        if (!this.loopStats) {
            this.loopStats = {
                totalLoops: 0,
                loopsInCurrentSession: 0,
                lastLoopTime: null,
                averageLoopInterval: 0
            };
        }
        
        const now = performance.now();
        
        if (this.loopStats.lastLoopTime) {
            const interval = now - this.loopStats.lastLoopTime;
            this.loopStats.averageLoopInterval = 
                (this.loopStats.averageLoopInterval + interval) / 2;
        }
        
        this.loopStats.totalLoops++;
        this.loopStats.loopsInCurrentSession++;
        this.loopStats.lastLoopTime = now;
        
        // Debug info
    }

    // =================== MODE MANAGEMENT ===================

    setPlaybackMode(mode) {
        if (this.currentMode === mode) return;
        
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this.stop();
        }
        
        this.currentMode = mode;
        this._updateLoopSettings();
        
        
        if (wasPlaying) {
            this.play();
        }
    }

    getPlaybackMode() {
        return this.currentMode;
    }

    // =================== LOOP MANAGEMENT ===================

    setLoopPoints(startStep, endStep) {
        this.loopStart = Math.max(0, startStep);
        this.loopEnd = Math.max(this.loopStart + 1, endStep);
        this.isAutoLoop = false;
        
        // Update transport loop
        this._updateTransportLoop();

        // ⚡ OPTIMIZATION: Detailed loop logging only when needed (removed duplicate)
    }

    enableAutoLoop() {
        this.isAutoLoop = true;
        this._updateLoopSettings();
    }

    setLoopEnabled(enabled) {
        this.loopEnabled = enabled;
        this._updateTransportLoop();
    }

    _updateLoopSettings() {
        if (!this.isAutoLoop) return;

        // ⚡ OPTIMIZATION: Debounce loop settings update to prevent excessive calculations
        this.schedulingOptimizer.requestSchedule(() => {
            if (this.currentMode === 'pattern') {
                this._calculatePatternLoop();
            } else {
                this._calculateSongLoop();
            }

            this._updateTransportLoop();
        }, 'loop-settings-update');
    }

    _updateLoopSettingsImmediate() {
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
        const activePatternId = arrangementStore.activePatternId;
        const activePattern = arrangementStore.patterns[activePatternId];
        
        if (!activePattern || !activePattern.data) {
            this.loopStart = 0;
            this.loopEnd = 64; // 4 bar * 16 step/bar
            this.patternLength = 64;
            return;
        }
    

        // Pattern içindeki en son notanın bittiği adımı (step) hesapla
        let maxStep = 0;
        const instrumentDetails = {};

        Object.entries(activePattern.data).forEach(([instrumentId, notes]) => {
            if (Array.isArray(notes) && notes.length > 0) {
                let instrumentMaxStep = 0;
                notes.forEach(note => {
                    const noteTime = note.time || 0;
                    // Notanın süresini step cinsinden al, varsayılan olarak 1 step (16'lık nota)
                    const noteDuration = this._getDurationInSteps(note.duration) || 1;
                    const noteEnd = noteTime + noteDuration;
                    instrumentMaxStep = Math.max(instrumentMaxStep, noteEnd);
                });
                instrumentDetails[instrumentId] = {
                    noteCount: notes.length,
                    maxStep: instrumentMaxStep
                };
                maxStep = Math.max(maxStep, instrumentMaxStep);
            }
        });

    
        // Uzunluğu en az 4 bar (64 step) yap ve en yakın bar sayısına yukarı yuvarla.
        // (1 bar = 16 step)
        this.patternLength = Math.max(64, Math.ceil(maxStep / 16) * 16);
        this.loopStart = 0;
        this.loopEnd = this.patternLength;
        
    }

    _calculateSongLoop() {
        const arrangementStore = useArrangementStore.getState();
        const clips = arrangementStore.clips || [];
        
        if (clips.length === 0) {
            this.loopStart = 0;
            this.loopEnd = 256; // Default song length in steps
            return;
        }

        // Find the last clip end time
        let lastEnd = 0;
        clips.forEach(clip => {
            const clipEnd = (clip.startTime || 0) + (clip.duration || 4);
            lastEnd = Math.max(lastEnd, clipEnd);
        });

        // Convert bars to steps (assuming 4 beats per bar, 4 steps per beat)
        this.songLength = Math.max(16, Math.ceil(lastEnd / 4) * 4); // Round to bars
        this.loopStart = 0;
        this.loopEnd = this.songLength * 16; // Convert bars to steps
        
    }

    _updateTransportLoop() {
        if (this.transport) {
            // ✅ DÜZELTME: Step'leri doğru şekilde transport'a gönder
            this.transport.setLoopPoints(this.loopStart, this.loopEnd);
            this.transport.setLoopEnabled(this.loopEnabled);
        } else {
        }
    }

    // =================== PLAYBACK CONTROLS ===================

    play(startStep = null) {
        if (this.isPlaying && !this.isPaused) return;

        // ✅ CRITICAL FIX: If resuming from pause, use resume() instead
        if (this.isPaused && startStep === null) {
            return this.resume();
        }

        try {
            const startTime = this.audioEngine.audioContext.currentTime;

            // ✅ FIX: Improved position handling - maintain current position unless explicitly changed
            if (startStep !== null) {
                // If explicitly requested to jump to a position
                this.jumpToStep(startStep);
            } else if (!this.isPaused && this.currentPosition === this.loopStart) {
                // Only reset to loop start if we're not paused AND we're already at the beginning
                // This prevents resetting when user has manually set position via jumpToStep
                if (this.transport.setPosition) {
                    this.transport.setPosition(this.loopStart);
                }
            }
            // Otherwise, keep current position (whether paused or manually set)


            this._updateLoopSettingsImmediate(); // Force immediate loop update for playback start
            this._scheduleContent(startTime, 'playback-start', true); // Force immediate scheduling for playback start
            this.transport.start(startTime);

            this.isPlaying = true;
            this.isPaused = false;
            usePlaybackStore.getState().setPlaybackState('playing');
        } catch (error) {
            this.stop();
        }
    }

    pause() {
        if (!this.isPlaying || this.isPaused) {
            return;
        }

        try {
            // ✅ FIX: Sync current position before pausing (keep current position, don't reset)
            this.currentPosition = this.transport.ticksToSteps(this.transport.currentTick);

            this.transport.pause();
            this.isPaused = true;


            // Notify stores
            usePlaybackStore.getState().setPlaybackState('paused');

        } catch (error) {
        }
    }

    resume() {
        if (!this.isPaused) {
            return;
        }

        try {
            const startTime = this.audioEngine.audioContext.currentTime;

            // ✅ CRITICAL FIX: Transport start() will check isPaused and preserve position
            this.transport.start(startTime);

            this.isPlaying = true;
            this.isPaused = false;


            // ✅ CRITICAL FIX: Reschedule content from current position
            this._scheduleContent(startTime, 'resume', true);

            // Notify stores
            usePlaybackStore.getState().setPlaybackState('playing');

        } catch (error) {
        }
    }

    stop() {
        if (!this.isPlaying && !this.isPaused) return;

        try {
            this.transport.stop();
            this._clearScheduledEvents();

            this.isPlaying = false;
            this.isPaused = false;
            this.currentPosition = this.loopStart;

            // ✅ FIX: Reset transport position to loop start when stopping
            if (this.transport.setPosition) {
                this.transport.setPosition(this.loopStart);
            }

            usePlaybackStore.getState().setPlaybackState('stopped');
        } catch (error) {
        }
    }

    // =================== POSITION MANAGEMENT ===================

    jumpToStep(step) {
        const targetStep = Math.max(0, Math.min(step, this.loopEnd - 1));
        this.currentPosition = targetStep;

        // ✅ FIX: Always update transport position, whether playing or not
        if (this.transport.setPosition) {
            this.transport.setPosition(targetStep);
        }

        if (this.isPlaying) {
            // Reschedule from new position when playing
            this._clearScheduledEvents();
            this._scheduleContent(null, 'jump-to-step', false); // Allow debouncing for jump operations
        }

        // ✅ FIX: Emit position update for UI
        const positionData = {
            step: targetStep,
            formatted: this._formatPosition(targetStep)
        };
        this._emit('positionUpdate', positionData);

    }

    jumpToBar(bar) {
        const targetStep = (bar - 1) * 16; // 16 steps per bar
        this.jumpToStep(targetStep);
    }

    /**
     * ⚠️ DEPRECATED: Use EventBus-based pattern change handlers instead
     * This method is kept for backward compatibility but should not be used
     * @deprecated Use EventBus.emit('NOTE_ADDED', data) instead
     */
    onPatternChanged(patternId, reason = 'pattern-edit', addedNotes = null) {

        // Only log for debugging, don't actually process
        // This prevents double-scheduling issues
    }

    /**
     * ⚡ OPTIMIZED: Handle active pattern switch with immediate scheduling
     * Called when switching between different patterns
     */
    onActivePatternChanged(newPatternId, reason = 'pattern-switch') {

        // Pattern switches need immediate scheduling to prevent audio gaps
        this._scheduleContent(null, `active-pattern-${reason}`, true);
    }

    jumpToTime(timeInSeconds) {
        const targetStep = this._secondsToSteps(timeInSeconds);
        this.jumpToStep(targetStep);
    }

    getCurrentPosition() {
        // ✅ NEW: Use PositionTracker for accurate position management
        const position = this.positionTracker.getCurrentPosition();

        // During active playback, ensure loop bounds
        if (this.isPlaying && !this.isPaused) {
            const loopLength = this.loopEnd - this.loopStart;
            if (loopLength > 0) {
                const relativeStep = (position.stepFloat - this.loopStart) % loopLength;
                const boundedStep = this.loopStart + Math.max(0, relativeStep);

                return boundedStep;
            }
            return position.stepFloat;
        }

        // For stopped/paused states, use stored position
        return this.currentPosition;
    }
    // =================== CONTENT SCHEDULING ===================

    /**
     * ⚡ OPTIMIZED: Debounced content scheduling to prevent excessive rescheduling
     * @param {number} startTime - İçeriğin planlanacağı başlangıç zamanı
     * @param {string} reason - Scheduling reason for debugging
     * @param {boolean} force - Force immediate execution without debouncing
     */
    _scheduleContent(startTime = null, reason = 'manual', force = false) {
        const scheduleCallback = () => {
            const baseTime = startTime || this.transport.audioContext.currentTime;


            // Önceki event'leri temizle (eğer daha önce temizlenmediyse)
            this._clearScheduledEvents();

            if (this.currentMode === 'pattern') {
                this._schedulePatternContent(baseTime);
            } else {
                this._scheduleSongContent(baseTime);
            }

        };

        // Use debounced scheduling unless forced
        if (force) {
            this.schedulingOptimizer.forceExecute(scheduleCallback, reason);
        } else {
            this.schedulingOptimizer.requestSchedule(scheduleCallback, reason);
        }
    }

    /**
     * ✅ DÜZELTME: Pattern content scheduling with base time
     * @param {number} baseTime - Base scheduling time
     */
    _schedulePatternContent(baseTime) {
        const arrangementStore = useArrangementStore.getState();
        const activePattern = arrangementStore.patterns[arrangementStore.activePatternId];
        
        if (!activePattern) {
            return;
        }


        // Schedule notes for each instrument
        Object.entries(activePattern.data).forEach(([instrumentId, notes]) => {
            if (!Array.isArray(notes) || notes.length === 0) {
                return;
            }
            
            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (!instrument) {
                return;
            }

            this._scheduleInstrumentNotes(instrument, notes, instrumentId, baseTime);
        });
    }

    _scheduleSongContent() {
        const arrangementStore = useArrangementStore.getState();
        const clips = arrangementStore.clips || [];
        const patterns = arrangementStore.patterns || {};
        

        clips.forEach(clip => {
            const pattern = patterns[clip.patternId];
            if (!pattern) return;

            const clipStartStep = (clip.startTime || 0) * 16; // Convert bars to steps

            // Schedule pattern notes with clip timing offset
            Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
                if (!Array.isArray(notes) || notes.length === 0) return;
                
                const instrument = this.audioEngine.instruments.get(instrumentId);
                if (!instrument) return;

                // Offset notes by clip start time
                const offsetNotes = notes.map(note => ({
                    ...note,
                    time: (note.time || 0) + clipStartStep
                }));

                this._scheduleInstrumentNotes(instrument, offsetNotes, instrumentId);
            });
        });
    }

    /**
     * ✅ DÜZELTME: Instrument notes scheduling with base time
     * @param {*} instrument - Instrument instance
     * @param {Array} notes - Notes array
     * @param {string} instrumentId - Instrument ID
     * @param {number} baseTime - Base scheduling time
     */
    _scheduleInstrumentNotes(instrument, notes, instrumentId, baseTime) {
        // ✅ CRITICAL FIX: Get current transport position for relative scheduling
        const currentStep = this.transport.ticksToSteps(this.transport.currentTick);
        const currentPositionInSeconds = currentStep * this.transport.stepsToSeconds(1);

        notes.forEach(note => {
            // Note timing calculation
            const noteTimeInSteps = note.time || 0;
            const noteTimeInTicks = noteTimeInSteps * this.transport.ticksPerStep;
            const noteTimeInSeconds = noteTimeInTicks * this.transport.getSecondsPerTick();

            // ✅ CRITICAL FIX: Calculate relative time from current position
            const relativeTime = noteTimeInSeconds - currentPositionInSeconds;
            let absoluteTime = baseTime + relativeTime;

            // ✅ CRITICAL FIX: Handle loop-aware scheduling with proper current position handling
            if (absoluteTime < baseTime) {
                // Note is in the past - schedule for next loop if looping is enabled
                if (this.loop) {
                    const loopLength = this.loopEnd - this.loopStart;
                    const loopTimeInSeconds = loopLength * this.transport.stepsToSeconds(1);
                    absoluteTime = baseTime + relativeTime + loopTimeInSeconds;

                    // If still in past after loop adjustment, skip it
                    if (absoluteTime < baseTime) {
                        return;
                    }
                } else {
                    // No looping - skip past notes
                    return;
                }
            }

            const noteDuration = note.duration ?
                NativeTimeUtils.parseTime(note.duration, this.transport.bpm) :
                this.transport.stepsToSeconds(1);

            // Note on event
            this.transport.scheduleEvent(
                absoluteTime,
                (scheduledTime) => {
                    try {
                        instrument.triggerNote(
                            note.pitch || 'C4',
                            note.velocity || 1,
                            scheduledTime,
                            noteDuration
                        );
                    } catch (error) {
                    }
                },
                { type: 'noteOn', instrumentId, note, step: noteTimeInSteps }
            );

            // Note off event (if needed)
            if (note.duration && note.duration !== 'trigger') {
                this.transport.scheduleEvent(
                    absoluteTime + noteDuration,
                    (scheduledTime) => {
                        try {
                            instrument.releaseNote(note.pitch || 'C4', scheduledTime);
                        } catch (error) {
                        }
                    },
                    { type: 'noteOff', instrumentId, note }
                );
            }
        });
    }

    _schedulePatternAutomation(pattern) {
        // Schedule pattern-level automation
        // This would include things like pattern-specific mixer changes, effects automation, etc.
        if (pattern.automation) {
            Object.entries(pattern.automation).forEach(([targetId, automationData]) => {
                this._scheduleAutomationEvents(targetId, automationData);
            });
        }
    }

    _scheduleSongAutomation() {
        // Schedule song-level automation
        const arrangementStore = useArrangementStore.getState();
        if (arrangementStore.automation) {
            Object.entries(arrangementStore.automation).forEach(([targetId, automationData]) => {
                this._scheduleAutomationEvents(targetId, automationData);
            });
        }
    }

    _scheduleAutomationEvents(targetId, automationData) {
        if (!Array.isArray(automationData)) return;

        automationData.forEach(event => {
            const eventTime = this._stepsToSeconds(event.time || 0);
            
            this.transport.scheduleEvent(
                eventTime,
                () => {
                    this._applyAutomationEvent(targetId, event);
                },
                { type: 'automation', targetId, event }
            );
        });
    }

    _applyAutomationEvent(targetId, event) {
        // Apply automation event to target (mixer channel, instrument parameter, etc.)
        const [type, id, parameter] = targetId.split('.');
        
        switch (type) {
            case 'mixer':
                this._applyMixerAutomation(id, parameter, event.value);
                break;
            case 'instrument':
                this._applyInstrumentAutomation(id, parameter, event.value);
                break;
            case 'effect':
                this._applyEffectAutomation(id, parameter, event.value);
                break;
            default:
        }
    }

    _applyMixerAutomation(channelId, parameter, value) {
        const channel = this.audioEngine.mixerChannels.get(channelId);
        if (!channel) return;

        switch (parameter) {
            case 'volume':
                channel.setVolume(value);
                break;
            case 'pan':
                channel.setPan(value);
                break;
            default:
        }
    }

    _applyInstrumentAutomation(instrumentId, parameter, value) {
        const instrument = this.audioEngine.instruments.get(instrumentId);
        if (!instrument || !instrument.parameters) return;

        const param = instrument.parameters.get(parameter);
        if (param) {
            param.setTargetAtTime(value, this.audioEngine.audioContext.currentTime, 0.01);
        }
    }

    _applyEffectAutomation(effectId, parameter, value) {
        // Find effect across all mixer channels
        this.audioEngine.mixerChannels.forEach(channel => {
            const effect = channel.effects.get(effectId);
            if (effect) {
                effect.updateParameter(parameter, value);
            }
        });
    }

    // =================== UTILITY METHODS ===================

    _stepsToSeconds(steps) {
        return this.transport.stepsToSeconds(steps);
    }

    _secondsToSteps(seconds) {
        return this.transport.secondsToSteps(seconds);
    }

    /**
     * ✅ NEW: Format position for UI display
     * @param {number} step - Position in steps
     * @returns {string} Formatted position string
     */
    _formatPosition(step) {
        const bar = Math.floor(step / 16) + 1;
        const beat = Math.floor((step % 16) / 4) + 1;
        const subBeat = (step % 4) + 1;
        return `${bar}:${beat}:${subBeat}`;
    }

    /**
     * @private
     * "8n", "4n" gibi notasyonları step birimine çevirir.
     * @param {string} duration - Nota süresi gösterimi (örn: "16n").
     * @returns {number} Sürenin step cinsinden karşılığı.
     */
    _getDurationInSteps(duration) {
        if (!duration || typeof duration !== 'string') {
            return 1; // Varsayılan süre 1 step (16'lık nota)
        }
        
        const bpm = this.transport.bpm || 120;
        // NativeTimeUtils kullanarak süreyi saniyeye çevir
        const durationInSeconds = NativeTimeUtils.parseTime(duration, bpm);
        // Transport'taki yardımcı fonksiyonla saniyeyi step'e çevir
        return this.transport.secondsToSteps(durationInSeconds);
    }

    /**
     * ✅ NEW: Schedule newly added notes immediately during playback
     * @param {Array} addedNotes - Array of newly added notes with their instrument IDs
     */
    _scheduleNewNotesImmediate(addedNotes) {
        if (!this.isPlaying || this.isPaused) return;

        const currentTime = this.transport.audioContext.currentTime;
        const currentTick = this.transport.currentTick;
        const currentStep = this.transport.ticksToSteps(currentTick);


        addedNotes.forEach(({ instrumentId, note }) => {
            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (!instrument) {
                return;
            }

            const noteStep = note.time || 0;

            // ✅ CRITICAL: Check if note should play in current loop iteration
            const loopLength = this.loopEnd - this.loopStart;
            const relativeCurrentStep = (currentStep - this.loopStart) % loopLength;
            const relativeNoteStep = (noteStep - this.loopStart) % loopLength;

            // Calculate when note should play
            let nextPlayStep;
            if (relativeNoteStep > relativeCurrentStep) {
                // Note is later in current loop - schedule for current loop
                nextPlayStep = noteStep;
            } else {
                // Note is earlier in loop - schedule for next loop iteration
                nextPlayStep = noteStep + loopLength;
            }

            // Convert to absolute time
            const noteTimeInTicks = nextPlayStep * this.transport.ticksPerStep;
            const noteTimeInSeconds = noteTimeInTicks * this.transport.getSecondsPerTick();
            const loopStartTime = currentTime - (currentTick * this.transport.getSecondsPerTick());
            const absoluteTime = loopStartTime + noteTimeInSeconds;

            // Schedule the note
            if (absoluteTime > currentTime) {
                const noteDuration = note.duration ?
                    NativeTimeUtils.parseTime(note.duration, this.transport.bpm) :
                    this.transport.stepsToSeconds(1);

                this.transport.scheduleEvent(
                    absoluteTime,
                    (scheduledTime) => {
                        try {
                            instrument.triggerNote(
                                note.pitch || 'C4',
                                note.velocity || 1,
                                scheduledTime,
                                noteDuration
                            );
                        } catch (error) {
                        }
                    },
                    { type: 'noteOn', instrumentId, note, step: nextPlayStep, immediate: true }
                );

            } else {
            }
        });
    }

    _clearScheduledEvents() {
        if (this.transport && this.transport.clearScheduledEvents) {
            this.transport.clearScheduledEvents();
        }

    }

    // =================== STATUS & DEBUG ===================

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

    getLoopInfo() {
        return {
            start: this.loopStart,
            end: this.loopEnd,
            length: this.loopEnd - this.loopStart,
            enabled: this.loopEnabled,
            auto: this.isAutoLoop,
            lengthInSeconds: this._stepsToSeconds(this.loopEnd - this.loopStart)
        };
    }

    /**
     * ✅ BONUS: Playback manager stats'ları al
     */
    getStats() {
        return {
            mode: this.currentMode,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentPosition: this.currentPosition,
            loopInfo: this.getLoopInfo(),
            loopStats: this.loopStats,
            activePatternId: this.activePatternId,
            scheduledEventsCount: this.transport?.scheduledEvents?.size || 0
        };
    }    

    // =================== EVENTS ===================

    on(event, callback) {
        if (!this.eventListeners) {
            this.eventListeners = new Map();
        }
        
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        
        this.eventListeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.eventListeners?.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }

    _emit(event, data) {
        if (this.eventListeners?.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                }
            });
        }
    }
}