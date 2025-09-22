// lib/core/NativeTransportSystem.js
// DAWG - Native Transport System - ToneJS'siz tam native implementasyon

export class NativeTransportSystem {
    constructor(audioContext) {
        this.audioContext = audioContext;

        // Transport durumu
        this.isPlaying = false;
        this.position = 0; // bar-beat-sixteenth formatında
        this.bpm = 120;
        this.timeSignature = [4, 4]; // 4/4 time signature

        // Zamanlama
        this.ppq = 96; // pulses per quarter note (MIDI standart)
        this.currentTick = 0;
        this.nextTickTime = 0;
        this.lookAhead = 25.0; // 25ms lookahead
        this.scheduleAheadTime = 0.1; // 100ms scheduling window

        // Event callbacks
        this.callbacks = new Map();
        this.scheduledEvents = new Map(); // time -> events

        // Timer
        this.timerWorker = null;
        this.schedulerRunning = false;

        // Pattern scheduling
        this.patterns = new Map();
        this.activePatterns = new Set();
        this.nextPatternEventTime = Infinity;

        // Swing ve groove
        this.swingFactor = 0; // 0-1, 0 = straight, 1 = full swing
        this.groove = null;

        this.initializeWorkerTimer();

        console.log('🎵 NativeTransportSystem initialized');
    }

    // =================== TIMER INITIALIZATION ===================

    initializeWorkerTimer() {
        // Web Worker kullanarak daha stabil timing
        const workerScript = `
            let timerID = null;
            let interval = 25; // 25ms default

            self.onmessage = function(e) {
                if (e.data === 'start') {
                    timerID = setInterval(() => {
                        postMessage('tick');
                    }, interval);
                } else if (e.data === 'stop') {
                    clearInterval(timerID);
                } else if (e.data.interval) {
                    interval = e.data.interval;
                }
            };
        `;

        const blob = new Blob([workerScript], { type: 'application/javascript' });
        this.timerWorker = new Worker(URL.createObjectURL(blob));

        this.timerWorker.onmessage = () => {
            if (this.isPlaying) {
                this.scheduler();
            }
        };
    }

    // =================== BASIC TRANSPORT CONTROLS ===================

    start(when = null) {
        if (this.isPlaying) return;

        const startTime = when || this.audioContext.currentTime;
        this.isPlaying = true;
        this.nextTickTime = startTime;
        this.schedulerRunning = true;

        this.timerWorker.postMessage('start');

        this.triggerCallback('start', { time: startTime, position: this.position });
        console.log(`▶️ Transport started at ${startTime.toFixed(3)}s`);

        return this;
    }

    stop(when = null) {
        if (!this.isPlaying) return;

        const stopTime = when || this.audioContext.currentTime;
        this.isPlaying = false;
        this.schedulerRunning = false;

        this.timerWorker.postMessage('stop');

        // Aktif pattern'ları durdur
        this.activePatterns.forEach(patternId => {
            this.stopPattern(patternId, stopTime);
        });

        this.triggerCallback('stop', { time: stopTime, position: this.position });
        console.log(`⏹️ Transport stopped at ${stopTime.toFixed(3)}s`);

        return this;
    }

    pause(when = null) {
        const pauseTime = when || this.audioContext.currentTime;
        this.stop(pauseTime);
        this.triggerCallback('pause', { time: pauseTime, position: this.position });
        console.log(`⏸️ Transport paused at position ${this.formatPosition(this.position)}`);
        return this;
    }

    // =================== POSITION & TIMING ===================

    getPosition() {
        if (!this.isPlaying) return this.position;

        const elapsed = this.audioContext.currentTime - this.nextTickTime + this.getSecondsPerTick();
        const ticksElapsed = Math.floor(elapsed / this.getSecondsPerTick());
        return this.position + ticksElapsed;
    }

    setPosition(position) {
        this.position = position;
        this.currentTick = position;

        if (this.isPlaying) {
            this.nextTickTime = this.audioContext.currentTime;
        }

        this.triggerCallback('position', { position: this.position });
        console.log(`🎯 Position set to ${this.formatPosition(position)}`);
        return this;
    }

    setBPM(bpm) {
        if (bpm < 60 || bpm > 200) {
            console.warn('⚠️ BPM out of reasonable range (60-200)');
        }

        this.bpm = bpm;
        this.triggerCallback('bpm', { bpm: this.bpm });
        console.log(`🎼 BPM set to ${bpm}`);
        return this;
    }

    setTimeSignature(numerator, denominator = 4) {
        this.timeSignature = [numerator, denominator];
        console.log(`🎼 Time signature set to ${numerator}/${denominator}`);
        return this;
    }

    // =================== SCHEDULING CORE ===================

    scheduler() {
        while (this.nextTickTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleCurrentTick(this.nextTickTime);
            this.nextTick();
        }
    }

    scheduleCurrentTick(time) {
        // Position callback
        this.triggerCallback('tick', {
            time: time,
            position: this.currentTick,
            formatted: this.formatPosition(this.currentTick)
        });

        // Beat ve bar callbacks
        if (this.currentTick % this.ppq === 0) {
            const beat = Math.floor(this.currentTick / this.ppq) % this.timeSignature[0];
            this.triggerCallback('beat', { time, beat });

            if (beat === 0) {
                const bar = Math.floor(this.currentTick / (this.ppq * this.timeSignature[0]));
                this.triggerCallback('bar', { time, bar });
            }
        }

        // Pattern events'leri schedule et
        this.schedulePatternEvents(time);

        // Generic scheduled events
        this.processScheduledEvents(time);
    }

    nextTick() {
        this.currentTick++;
        this.position = this.currentTick;
        this.nextTickTime += this.getSecondsPerTick();
    }

    getSecondsPerTick() {
        const secondsPerBeat = 60.0 / this.bpm;
        return secondsPerBeat / this.ppq;
    }

    // =================== PATTERN SCHEDULING ===================

    schedulePattern(patternId, pattern, startTime = null) {
        startTime = startTime || this.audioContext.currentTime;

        const processedPattern = this.preprocessPattern(pattern);
        this.patterns.set(patternId, {
            ...processedPattern,
            startTime,
            originalPattern: pattern
        });

        this.activePatterns.add(patternId);
        console.log(`📋 Pattern scheduled: ${patternId} at ${startTime.toFixed(3)}s`);

        return this;
    }

    stopPattern(patternId, when = null) {
        const stopTime = when || this.audioContext.currentTime;

        if (this.patterns.has(patternId)) {
            this.patterns.delete(patternId);
            this.activePatterns.delete(patternId);

            this.triggerCallback('patternStop', { patternId, time: stopTime });
            console.log(`⏹️ Pattern stopped: ${patternId}`);
        }

        return this;
    }

    schedulePatternEvents(currentTime) {
        this.activePatterns.forEach(patternId => {
            const pattern = this.patterns.get(patternId);
            if (!pattern) return;

            pattern.events.forEach(event => {
                const eventTime = pattern.startTime + event.time;

                if (Math.abs(eventTime - currentTime) < 0.001) { // 1ms tolerance
                    this.triggerCallback('patternEvent', {
                        patternId,
                        event,
                        time: currentTime
                    });
                }
            });
        });
    }

    preprocessPattern(pattern) {
        // Pattern'ı schedule edilebilir events'lere çevir
        const events = [];

        if (Array.isArray(pattern)) {
            pattern.forEach((note, index) => {
                if (note && note.time !== undefined) {
                    events.push({
                        type: 'note',
                        time: this.parseTime(note.time),
                        data: note
                    });
                }
            });
        }

        return { events, duration: this.calculatePatternDuration(events) };
    }

    // =================== TIME UTILITIES ===================

    parseTime(timeValue) {
        if (typeof timeValue === 'number') {
            return timeValue; // Assume seconds
        }

        if (typeof timeValue === 'string') {
            // Parse formats like "1:2:0" (bar:beat:sixteenth)
            if (timeValue.includes(':')) {
                const parts = timeValue.split(':').map(Number);
                const [bar = 0, beat = 0, sixteenth = 0] = parts;

                return this.barBeatSixteenthToSeconds(bar, beat, sixteenth);
            }

            // Parse note durations like "4n", "8n", "16n"
            if (timeValue.match(/\d+[ndt]/)) {
                return this.noteDurationToSeconds(timeValue);
            }
        }

        return 0;
    }

    barBeatSixteenthToSeconds(bar, beat, sixteenth) {
        const totalSixteenths = (bar * this.timeSignature[0] * 4) + (beat * 4) + sixteenth;
        const sixteenthDuration = (60 / this.bpm) / 4; // Duration of one sixteenth note
        return totalSixteenths * sixteenthDuration;
    }

    noteDurationToSeconds(notation) {
        // "4n" = quarter note, "8n" = eighth note, etc.
        const matches = notation.match(/(\d+)([ndt])/);
        if (!matches) return 0;

        const [, noteValue, type] = matches;
        let duration = (60 / this.bpm) * (4 / parseInt(noteValue));

        if (type === 't') duration *= 2/3; // Triplet
        if (type === 'd') duration *= 1.5; // Dotted

        return duration;
    }

    formatPosition(ticks) {
        const ticksPerBar = this.ppq * this.timeSignature[0];
        const bar = Math.floor(ticks / ticksPerBar);
        const beat = Math.floor((ticks % ticksPerBar) / this.ppq);
        const sixteenth = Math.floor((ticks % this.ppq) / (this.ppq / 4));

        return `${bar}:${beat}:${sixteenth}`;
    }

    // =================== EVENT SYSTEM ===================

    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, new Set());
        }
        this.callbacks.get(event).add(callback);
        return this;
    }

    off(event, callback) {
        if (this.callbacks.has(event)) {
            this.callbacks.get(event).delete(callback);
        }
        return this;
    }

    triggerCallback(event, data = {}) {
        if (this.callbacks.has(event)) {
            this.callbacks.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Transport callback error (${event}):`, error);
                }
            });
        }
    }

    scheduleEvent(time, callback, data = {}) {
        const eventId = `event_${Date.now()}_${Math.random()}`;

        if (!this.scheduledEvents.has(time)) {
            this.scheduledEvents.set(time, []);
        }

        this.scheduledEvents.get(time).push({
            id: eventId,
            callback,
            data
        });

        return eventId;
    }

    processScheduledEvents(currentTime) {
        this.scheduledEvents.forEach((events, scheduledTime) => {
            if (Math.abs(scheduledTime - currentTime) < 0.001) {
                events.forEach(event => {
                    try {
                        event.callback(event.data);
                    } catch (error) {
                        console.error('❌ Scheduled event error:', error);
                    }
                });
                this.scheduledEvents.delete(scheduledTime);
            }
        });
    }

    // =================== UTILITY METHODS ===================

    calculatePatternDuration(events) {
        if (events.length === 0) return 0;
        return Math.max(...events.map(event => event.time + (event.data.duration || 0)));
    }

    applySwing(time, position) {
        if (this.swingFactor === 0) return time;

        const sixteenthPosition = position % (this.ppq / 4);
        if (sixteenthPosition === this.ppq / 8) { // Off-beat sixteenth
            const swingDelay = (this.getSecondsPerTick() * 2) * this.swingFactor * 0.3;
            return time + swingDelay;
        }

        return time;
    }

    getStats() {
        return {
            isPlaying: this.isPlaying,
            bpm: this.bpm,
            position: this.getPosition(),
            formattedPosition: this.formatPosition(this.getPosition()),
            timeSignature: this.timeSignature,
            activePatterns: this.activePatterns.size,
            scheduledEvents: this.scheduledEvents.size,
            audioLatency: this.audioContext.baseLatency || 'unknown',
            audioContextState: this.audioContext.state
        };
    }

    dispose() {
        console.log('🗑️ Disposing NativeTransportSystem...');

        this.stop();

        if (this.timerWorker) {
            this.timerWorker.terminate();
        }

        this.callbacks.clear();
        this.scheduledEvents.clear();
        this.patterns.clear();
        this.activePatterns.clear();

        console.log('✅ NativeTransportSystem disposed');
    }
}
