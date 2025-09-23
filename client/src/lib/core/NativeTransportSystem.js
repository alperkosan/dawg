// NativeTransportSystem.js - CRITICAL TIMING FIXES

export class NativeTransportSystem {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // ✅ DÜZELTME: Clear timing definitions
        this.isPlaying = false;
        this.bpm = 120;
        this.timeSignature = [4, 4];
        
        // ✅ Timing constants - STEPS vs TICKS vs SECONDS clarification
        this.ppq = 96; // pulses per quarter note (ticks)
        this.stepsPerBar = 16; // 16th note steps per bar (4/4 time)
        this.ticksPerStep = this.ppq / 4; // 24 ticks per step (16th note)
        this.ticksPerBar = this.ppq * this.timeSignature[0]; // 384 ticks per bar
        
        // ✅ Position tracking - ALL IN TICKS
        this.currentTick = 0;
        this.nextTickTime = 0;
        this.lookAhead = 25.0;
        this.scheduleAheadTime = 0.1;

        // ✅ CRITICAL: Loop system - ALL IN TICKS
        this.loop = true;
        this.loopStartTick = 0;
        this.loopEndTick = 64 * this.ticksPerStep; // 64 steps = 1536 ticks
        
        // Bar tracking
        this.currentBar = 0;
        
        this.callbacks = new Map();
        this.scheduledEvents = new Map();
        this.initializeWorkerTimer();
        
        console.log('🎵 NativeTransportSystem initialized:');
        console.log(`   PPQ: ${this.ppq} ticks/quarter`);
        console.log(`   Steps per bar: ${this.stepsPerBar}`);
        console.log(`   Ticks per step: ${this.ticksPerStep}`);
        console.log(`   Loop: ${this.loopStartTick} → ${this.loopEndTick} ticks`);
        console.log(`   Loop: ${this.loopStartTick / this.ticksPerStep} → ${this.loopEndTick / this.ticksPerStep} steps`);
    }

    // ✅ CRITICAL FIX: Loop points setting with proper conversion
    setLoopPoints(startStep, endStep) {
        // Convert steps to ticks (1 step = 24 ticks at PPQ=96)
        this.loopStartTick = startStep * this.ticksPerStep;
        this.loopEndTick = endStep * this.ticksPerStep;
        
        console.log(`🔁 Loop points set:`);
        console.log(`   Steps: ${startStep} → ${endStep} (${endStep - startStep} steps = ${(endStep - startStep)/16} bars)`);
        console.log(`   Ticks: ${this.loopStartTick} → ${this.loopEndTick} (${this.loopEndTick - this.loopStartTick} ticks)`);
        console.log(`   Seconds: ${(this.loopStartTick * this.getSecondsPerTick()).toFixed(2)} → ${(this.loopEndTick * this.getSecondsPerTick()).toFixed(2)}`);
        
        // Reset position if outside loop
        if (this.currentTick >= this.loopEndTick) {
            console.warn('[Transport] Current position beyond loop end, resetting to start');
            this.currentTick = this.loopStartTick;
            this.nextTickTime = this.audioContext.currentTime;
        }
    }

    // ✅ CRITICAL FIX: Scheduler with proper time conversion
    scheduler() {
        const scheduleUntil = this.audioContext.currentTime + this.scheduleAheadTime;

        while (this.nextTickTime < scheduleUntil) {
            // 1. UI callbacks with position info
            this.scheduleCurrentTick(this.nextTickTime);
            
            // 2. ✅ FIXED: Process scheduled events at current time
            this.processScheduledEvents(this.nextTickTime);
            
            this.advanceToNextTick();
        }
    }

    // ✅ CRITICAL FIX: Tick advancement with proper loop logic
    advanceToNextTick() {
        const secondsPerTick = this.getSecondsPerTick();
        
        // Advance time first
        this.nextTickTime += secondsPerTick;
        
        // Then advance tick position
        this.currentTick++;
        
        // ✅ FIXED: Loop logic - only trigger when actually hitting loop end
        if (this.loop && this.currentTick >= this.loopEndTick) {
            console.log(`🔁 Loop trigger:`);
            console.log(`   Current tick: ${this.currentTick}, Loop end: ${this.loopEndTick}`);
            console.log(`   Time: ${this.nextTickTime.toFixed(3)}s, Duration: ${((this.currentTick - this.loopStartTick) * secondsPerTick).toFixed(3)}s`);
            
            this.currentTick = this.loopStartTick;
            
            this.triggerCallback('loop', { 
                time: this.nextTickTime, 
                fromTick: this.loopEndTick - 1, 
                toTick: this.loopStartTick 
            });
        }
        
        // ✅ FIXED: Bar tracking - only update when crossing bar boundaries
        const newBar = Math.floor(this.currentTick / this.ticksPerBar);
        if (newBar !== this.currentBar) {
            this.currentBar = newBar;
            console.log(`🎼 Bar ${this.currentBar} (tick ${this.currentTick})`);
            
            this.triggerCallback('bar', { 
                time: this.nextTickTime, 
                bar: this.currentBar,
                tick: this.currentTick
            });
        }
    }

    // ✅ UTILITY: Time conversions
    getSecondsPerTick() {
        const secondsPerBeat = 60.0 / this.bpm;
        return secondsPerBeat / this.ppq;
    }
    
    stepsToTicks(steps) {
        return steps * this.ticksPerStep;
    }
    
    ticksToSteps(ticks) {
        return ticks / this.ticksPerStep;
    }
    
    stepsToSeconds(steps) {
        const ticks = this.stepsToTicks(steps);
        return ticks * this.getSecondsPerTick();
    }
    
    secondsToSteps(seconds) {
        const ticks = seconds / this.getSecondsPerTick();
        return this.ticksToSteps(ticks);
    }

    // ✅ CRITICAL FIX: Event scheduling with proper time conversion
    scheduleEvent(timeInSeconds, callback, data = {}) {
        const eventId = `event_${Date.now()}_${Math.random()}`;

        if (!this.scheduledEvents.has(timeInSeconds)) {
            this.scheduledEvents.set(timeInSeconds, []);
        }

        this.scheduledEvents.get(timeInSeconds).push({
            id: eventId,
            callback,
            data
        });

        return eventId;
    }

    processScheduledEvents(currentTime) {
        // Process events at or before current time
        for (const [scheduledTime, events] of this.scheduledEvents.entries()) {
            if (scheduledTime <= currentTime) {
                events.forEach(event => {
                    try {
                        event.callback(scheduledTime, event.data);
                    } catch (error) {
                        console.error('❌ Scheduled event error:', error);
                    }
                });
                this.scheduledEvents.delete(scheduledTime);
            }
        }
    }

    // ✅ Position formatting
    formatPosition(ticks) {
        const bar = Math.floor(ticks / this.ticksPerBar);
        const beat = Math.floor((ticks % this.ticksPerBar) / this.ppq);
        const sixteenth = Math.floor((ticks % this.ppq) / (this.ppq / 4));
        return `${bar}:${beat}:${sixteenth}`;
    }

    // ✅ Start/Stop methods remain the same
    start(when = null) {
        if (this.isPlaying) return;

        const startTime = when || this.audioContext.currentTime;
        this.isPlaying = true;
        this.nextTickTime = startTime;

        console.log(`▶️ Transport starting at tick ${this.currentTick} (${this.formatPosition(this.currentTick)}), time ${startTime.toFixed(3)}s`);
        console.log(`🔁 Loop: ${this.loopStartTick} → ${this.loopEndTick} ticks (${this.loop ? 'enabled' : 'disabled'})`);

        this.timerWorker.postMessage('start');
        this.triggerCallback('start', { time: startTime, position: this.currentTick });
        
        return this;
    }

    stop(when = null) {
        if (!this.isPlaying) return this;

        const stopTime = when || this.audioContext.currentTime;
        this.isPlaying = false;

        this.timerWorker.postMessage('stop');

        // ✅ FIXED: Reset to loop start
        this.currentTick = this.loopStartTick;
        this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);
        this.nextTickTime = stopTime;

        this.clearScheduledEvents();
        this.triggerCallback('stop', { time: stopTime, position: this.currentTick });
        
        console.log(`⏹️ Transport stopped, reset to tick ${this.currentTick} (${this.formatPosition(this.currentTick)})`);
        return this;
    }

    clearScheduledEvents() {
        this.scheduledEvents.clear();
        console.log('🧹 Scheduled events cleared');
    }

    // Standard event system methods...
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, new Set());
        }
        this.callbacks.get(event).add(callback);
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

    scheduleCurrentTick(time) {
        this.triggerCallback('tick', {
            time: time,
            position: this.currentTick,
            formatted: this.formatPosition(this.currentTick),
            bar: this.currentBar,
            step: this.ticksToSteps(this.currentTick)
        });

        // Beat callback
        if (this.currentTick % this.ppq === 0) {
            const beat = Math.floor(this.currentTick / this.ppq) % this.timeSignature[0];
            this.triggerCallback('beat', { time, beat, tick: this.currentTick });
        }
    }
}