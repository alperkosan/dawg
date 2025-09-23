// lib/core/PlaybackManager.js
// DAWG - Enhanced Playback System with Song/Pattern Modes

import { NativeTimeUtils } from '../utils/NativeTimeUtils.js';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useArrangementStore } from '../../store/useArrangementStore';

export class PlaybackManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.transport = audioEngine.transport;

        // ✅ EKLENDİ: Transport'tan gelen olayları dinlemek için.
        this._bindTransportEvents();
        
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
        
        console.log('🎵 PlaybackManager initialized');
    }

    /**
     * @private
     * Transport'tan gelen temel olayları (döngü gibi) dinler ve
     * bunlara göre yeniden planlama yapar.
     */
    _bindTransportEvents() {
        this.transport.on('loop', ({ nextLoopStartTime }) => {
            console.log(`🧠 PlaybackManager received loop event. Rescheduling for ${nextLoopStartTime.toFixed(3)}s`);
            // Bir sonraki döngünün başlangıç zamanını kullanarak içeriği yeniden planla.
            this._scheduleContent(nextLoopStartTime);
        });
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
        
        console.log(`🔄 Playback mode changed to: ${mode}`);
        
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
        
        console.log(`🔁 Loop points set: ${this.loopStart} -> ${this.loopEnd} steps`);
    }

    enableAutoLoop() {
        this.isAutoLoop = true;
        this._updateLoopSettings();
        console.log('🔄 Auto loop enabled');
    }

    setLoopEnabled(enabled) {
        this.loopEnabled = enabled;
        this._updateTransportLoop();
        console.log(`🔁 Loop ${enabled ? 'enabled' : 'disabled'}`);
    }

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
        
        console.log(`📏 Song loop calculated: ${this.songLength} bars (${this.loopEnd} steps)`);
    }

    _updateTransportLoop() {
        if (this.transport) {
            // ✅ DÜZELTME: Step'leri doğru şekilde transport'a gönder
            this.transport.setLoopPoints(this.loopStart, this.loopEnd);
            this.transport.setLoopEnabled(this.loopEnabled);
            
            console.log(`🔁 Transport loop updated: ${this.loopStart} -> ${this.loopEnd} steps`);
        }
    }

    // =================== PLAYBACK CONTROLS ===================

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

    pause() {
        if (!this.isPlaying || this.isPaused) {
            console.log('⚠️ Not playing or already paused');
            return;
        }

        try {
            this.transport.pause();
            this.isPaused = true;
            
            console.log(`⏸️ Playback paused at step ${this.currentPosition}`);
            
            // Notify stores
            usePlaybackStore.getState().setPlaybackState('paused');
            
        } catch (error) {
            console.error('❌ Pause failed:', error);
        }
    }

    resume() {
        if (!this.isPaused) {
            console.log('⚠️ Not paused');
            return;
        }

        try {
            this.transport.start();
            this.isPaused = false;
            
            console.log(`▶️ Playback resumed from step ${this.currentPosition}`);
            
            // Notify stores
            usePlaybackStore.getState().setPlaybackState('playing');
            
        } catch (error) {
            console.error('❌ Resume failed:', error);
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

    // =================== POSITION MANAGEMENT ===================

    jumpToStep(step) {
        const targetStep = Math.max(0, Math.min(step, this.loopEnd - 1));
        this.currentPosition = targetStep;
        
        if (this.isPlaying) {
            // Transport should handle position jumping
            this.transport.setPosition?.(targetStep);
            
            // Reschedule from new position
            this._clearScheduledEvents();
            this._scheduleContent();
        }
        
        console.log(`🎯 Jumped to step ${targetStep}`);
    }

    jumpToBar(bar) {
        const targetStep = (bar - 1) * 16; // 16 steps per bar
        this.jumpToStep(targetStep);
    }

    jumpToTime(timeInSeconds) {
        const targetStep = this._secondsToSteps(timeInSeconds);
        this.jumpToStep(targetStep);
    }

    getCurrentPosition() {
        if (this.isPlaying && this.transport) {
            // Get current position from transport
            return this.transport.ticksToSteps?.(this.transport.currentTick) || this.currentPosition;
        }
        return this.currentPosition;
    }
    // =================== CONTENT SCHEDULING ===================

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

    _scheduleSongContent() {
        const arrangementStore = useArrangementStore.getState();
        const clips = arrangementStore.clips || [];
        const patterns = arrangementStore.patterns || {};
        
        console.log(`🎬 Scheduling song: ${clips.length} clips`);

        clips.forEach(clip => {
            const pattern = patterns[clip.patternId];
            if (!pattern) return;

            const clipStartStep = (clip.startTime || 0) * 16; // Convert bars to steps
            const clipDuration = (clip.duration || 4) * 16; // Convert bars to steps

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

    _scheduleInstrumentNotes(instrument, notes, instrumentId, startTime) {
        notes.forEach(note => {
            const noteTimeInSteps = note.time || 0;
            const noteTimeRelativeInSeconds = this.transport.stepsToSeconds(noteTimeInSteps);
            const noteTimeAbsoluteInSeconds = startTime + noteTimeRelativeInSeconds;

            const noteDuration = note.duration ? 
                NativeTimeUtils.parseTime(note.duration, this.transport.bpm) : 
                this.transport.stepsToSeconds(1);
    
            // ✅ DÜZELTME: scheduleEvent'e sadece MUTLAK zamanı gönderiyoruz.
            this.transport.scheduleEvent(
                noteTimeAbsoluteInSeconds,
                (scheduledTime) => {
                    // triggerNote fonksiyonuna da mutlak zamanı veriyoruz.
                    instrument.triggerNote(note.pitch || 'C4', note.velocity || 1, scheduledTime, noteDuration);
                },
                { type: 'noteOn', instrumentId, note, step: noteTimeInSteps }
            );
    
            if (note.duration && note.duration !== 'trigger') {
                this.transport.scheduleEvent(
                    noteTimeAbsoluteInSeconds + noteDuration,
                    (scheduledTime) => {
                        instrument.releaseNote(note.pitch || 'C4', scheduledTime);
                    },
                    { type: 'noteOff', instrumentId, note }
                );
            }
        });
        
        console.log(`📋 Scheduled ${notes.length} notes for ${instrumentId} starting at ${startTime.toFixed(3)}s`);
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
                console.warn(`⚠️ Unknown automation target: ${targetId}`);
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
                console.warn(`⚠️ Unknown mixer parameter: ${parameter}`);
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

    _getDurationInSteps(duration) {
        if (!duration) return 1;
        
        const bpm = this.transport.bpm || 120;
        const durationSeconds = NativeTimeUtils.parseTime(duration, bpm);
        return this._secondsToSteps(durationSeconds);
    }

    _clearScheduledEvents() {
        if (this.transport && this.transport.clearScheduledEvents) {
            this.transport.clearScheduledEvents();
        }
        
        console.log('🧹 Playback events cleared');
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
                    console.error(`❌ Event callback error (${event}):`, error);
                }
            });
        }
    }
}