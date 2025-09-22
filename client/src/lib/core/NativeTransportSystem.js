// client/src/lib/core/NativeTransportSystem.js
export class NativeTransportSystem {
  constructor(audioContextManager) {
    this.audioContextManager = audioContextManager;
    this.context = audioContextManager.context;
    
    // Transport state
    this.isPlaying = false;
    this.isPaused = false;
    this.bpm = 120;
    this.timeSignature = [4, 4]; // [numerator, denominator]
    
    // Timing
    this.startTime = 0;
    this.pauseTime = 0;
    this.currentPosition = 0; // in 16th notes
    this.loopStart = 0; // in 16th notes
    this.loopEnd = 64; // in 16th notes (4 bars)
    this.isLooping = true;
    
    // Scheduling
    this.scheduledEvents = new Map();
    this.nextEventId = 0;
    this.scheduleAheadTime = 25.0; // How far ahead to schedule events (ms)
    this.lookAhead = 25.0; // How frequently to call scheduling function (ms)
    this.timerWorker = null;
    
    // Callbacks
    this.onPositionChange = null;
    this.onBeatChange = null;
    this.onBarChange = null;
    this.onStateChange = null;
    
    // Performance metrics
    this.stats = {
      actualBPM: 0,
      drift: 0,
      eventsScheduled: 0,
      missedEvents: 0
    };

    this.setupTimerWorker();
    console.log('🚀 Native Transport System initialized');
  }

  // BPM and timing calculations
  setBPM(newBPM) {
    const clampedBPM = Math.max(60, Math.min(200, newBPM));
    this.bpm = clampedBPM;
    console.log(`🎵 BPM set to: ${this.bpm}`);
    
    if (this.onBeatChange) {
      this.onBeatChange({ bpm: this.bpm });
    }
  }

  getBPM() {
    return this.bpm;
  }

  // Convert between time units
  beatsPerSecond() {
    return this.bpm / 60;
  }

  secondsPerBeat() {
    return 60 / this.bpm;
  }

  secondsPer16thNote() {
    return this.secondsPerBeat() / 4;
  }

  stepsToSeconds(steps) {
    return steps * this.secondsPer16thNote();
  }

  secondsToSteps(seconds) {
    return seconds / this.secondsPer16thNote();
  }

  // Position management
  setPosition(step) {
    this.currentPosition = Math.max(0, step);
    if (this.onPositionChange) {
      this.onPositionChange(this.getPositionInfo());
    }
  }

  getPosition() {
    if (!this.isPlaying) {
      return this.currentPosition;
    }

    const elapsedTime = this.context.currentTime - this.startTime;
    const elapsedSteps = this.secondsToSteps(elapsedTime);
    let position = elapsedSteps;

    // Handle looping
    if (this.isLooping && this.loopEnd > this.loopStart) {
      const loopLength = this.loopEnd - this.loopStart;
      if (position >= this.loopEnd) {
        position = this.loopStart + ((position - this.loopStart) % loopLength);
      }
    }

    return position;
  }

  getPositionInfo() {
    const position = this.getPosition();
    const bar = Math.floor(position / 16) + 1;
    const beat = Math.floor((position % 16) / 4) + 1;
    const sixteenth = (position % 4) + 1;
    
    return {
      position,
      bar,
      beat,
      sixteenth,
      formatted: `${bar}:${beat}:${Math.floor(sixteenth)}`
    };
  }

  // Transport controls
  start(fromStep = null) {
    if (this.isPlaying) {
      this.stop();
    }

    const startStep = fromStep !== null ? fromStep : this.currentPosition;
    this.currentPosition = startStep;
    this.startTime = this.context.currentTime;
    this.pauseTime = 0;
    this.isPlaying = true;
    this.isPaused = false;

    this.startScheduling();
    
    console.log(`▶️ Transport started from step ${startStep}`);
    
    if (this.onStateChange) {
      this.onStateChange({ 
        isPlaying: true, 
        isPaused: false, 
        position: startStep 
      });
    }
  }

  pause() {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    this.pauseTime = this.context.currentTime;
    this.currentPosition = this.getPosition();
    
    this.stopScheduling();
    this.clearScheduledEvents();

    console.log(`⏸️ Transport paused at step ${this.currentPosition}`);
    
    if (this.onStateChange) {
      this.onStateChange({ 
        isPlaying: true, 
        isPaused: true, 
        position: this.currentPosition 
      });
    }
  }

  resume() {
    if (!this.isPlaying || !this.isPaused) return;

    const pausedDuration = this.pauseTime - this.startTime;
    this.startTime = this.context.currentTime - pausedDuration;
    this.isPaused = false;
    
    this.startScheduling();

    console.log(`▶️ Transport resumed from step ${this.currentPosition}`);
    
    if (this.onStateChange) {
      this.onStateChange({ 
        isPlaying: true, 
        isPaused: false, 
        position: this.currentPosition 
      });
    }
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentPosition = 0;
    this.startTime = 0;
    this.pauseTime = 0;
    
    this.stopScheduling();
    this.clearScheduledEvents();

    console.log('⏹️ Transport stopped');
    
    if (this.onStateChange) {
      this.onStateChange({ 
        isPlaying: false, 
        isPaused: false, 
        position: 0 
      });
    }
  }

  // Loop management
  setLoop(startStep, endStep) {
    this.loopStart = Math.max(0, startStep);
    this.loopEnd = Math.max(this.loopStart + 1, endStep);
    console.log(`🔄 Loop set: ${this.loopStart} - ${this.loopEnd}`);
  }

  setLooping(enabled) {
    this.isLooping = enabled;
    console.log(`🔄 Looping ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Event scheduling system
  scheduleEvent(callback, time, data = {}) {
    const eventId = this.nextEventId++;
    const event = {
      id: eventId,
      callback,
      time,
      data,
      scheduled: false
    };

    this.scheduledEvents.set(eventId, event);
    return eventId;
  }

  cancelScheduledEvent(eventId) {
    return this.scheduledEvents.delete(eventId);
  }

  clearScheduledEvents() {
    this.scheduledEvents.clear();
  }

  // Pattern scheduling
  schedulePattern(pattern, instrumentCallback) {
    this.clearScheduledEvents();
    
    Object.entries(pattern).forEach(([instrumentId, notes]) => {
      if (!Array.isArray(notes)) return;
      
      notes.forEach(note => {
        const noteTime = this.stepsToSeconds(note.time);
        
        this.scheduleEvent(
          (time, eventData) => {
            instrumentCallback(eventData.instrumentId, eventData.note, time);
          },
          noteTime,
          { instrumentId, note }
        );
      });
    });

    console.log(`📋 Pattern scheduled: ${this.scheduledEvents.size} events`);
  }

  // Timer worker for precise scheduling
  setupTimerWorker() {
    // Create a simple timer worker using setTimeout
    // In production, you'd use a proper Web Worker for better timing
    this.timerWorker = {
      start: () => {
        this.schedulerInterval = setInterval(() => {
          this.scheduler();
        }, this.lookAhead);
      },
      stop: () => {
        if (this.schedulerInterval) {
          clearInterval(this.schedulerInterval);
          this.schedulerInterval = null;
        }
      }
    };
  }

  startScheduling() {
    if (this.timerWorker) {
      this.timerWorker.start();
    }
  }

  stopScheduling() {
    if (this.timerWorker) {
      this.timerWorker.stop();
    }
  }

  // Main scheduler function
  scheduler() {
    if (!this.isPlaying || this.isPaused) return;

    const currentTime = this.context.currentTime;
    const currentPosition = this.getPosition();
    
    // Schedule events that are coming up
    this.scheduledEvents.forEach((event, eventId) => {
      if (event.scheduled) return;
      
      const eventAbsoluteTime = this.startTime + event.time;
      
      if (eventAbsoluteTime < currentTime + (this.scheduleAheadTime / 1000)) {
        try {
          event.callback(eventAbsoluteTime, event.data);
          event.scheduled = true;
          this.stats.eventsScheduled++;
        } catch (error) {
          console.error('❌ Scheduler event error:', error);
          this.stats.missedEvents++;
        }
      }
    });

    // Clean up old events
    const cutoffTime = currentTime - 1; // Keep events for 1 second
    this.scheduledEvents.forEach((event, eventId) => {
      if (event.scheduled && this.startTime + event.time < cutoffTime) {
        this.scheduledEvents.delete(eventId);
      }
    });

    // Update position
    if (this.onPositionChange) {
      this.onPositionChange(this.getPositionInfo());
    }

    // Handle looping
    if (this.isLooping && currentPosition >= this.loopEnd) {
      const overshoot = currentPosition - this.loopEnd;
      const newPosition = this.loopStart + overshoot;
      
      // Reset start time to handle loop
      this.startTime = currentTime - this.stepsToSeconds(newPosition - this.loopStart);
      this.currentPosition = newPosition;
      
      // Reschedule all events for the new loop
      this.reschedulePendingEvents();
    }
  }

  reschedulePendingEvents() {
    // Reset all unscheduled events
    this.scheduledEvents.forEach(event => {
      if (!event.scheduled) {
        event.scheduled = false;
      }
    });
  }

  // Performance monitoring
  updateStats() {
    // Calculate actual BPM based on timing
    // This would measure actual vs intended timing
    this.stats.actualBPM = this.bpm; // Simplified for now
    this.stats.drift = 0; // Calculate timing drift
  }

  getStats() {
    this.updateStats();
    return { ...this.stats };
  }

  // Utility methods
  jumpTo(step) {
    const wasPlaying = this.isPlaying;
    
    if (wasPlaying) {
      this.pause();
    }
    
    this.setPosition(step);
    
    if (wasPlaying) {
      this.start(step);
    }
  }

  jumpToBar(barNumber) {
    const step = (barNumber - 1) * 16;
    this.jumpTo(step);
  }

  // Cleanup
  dispose() {
    this.stop();
    this.stopScheduling();
    this.clearScheduledEvents();
    
    if (this.timerWorker) {
      this.timerWorker = null;
    }

    console.log('🗑️ Native Transport System disposed');
  }
}