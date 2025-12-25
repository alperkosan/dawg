/**
 * AudioObjectPool - Memory Management for Audio Processing
 * 
 * Provides pre-allocated object pools to minimize GC pressure during
 * real-time audio processing. Critical for maintaining smooth playback.
 * 
 * Features:
 * - Pre-allocated note objects
 * - Pre-allocated voice objects
 * - Typed array buffers for audio data
 * - Zero-allocation render loop support
 * 
 * @module lib/core/utils/AudioObjectPool
 */

import { logger, NAMESPACES } from '../../utils/debugLogger.js';

/**
 * Generic object pool implementation
 */
class ObjectPool {
    /**
     * @param {Function} factory - Factory function to create new objects
     * @param {Function} reset - Function to reset an object for reuse
     * @param {number} initialSize - Initial pool size
     */
    constructor(factory, reset, initialSize = 100) {
        this.factory = factory;
        this.reset = reset;
        this.pool = [];
        this.activeCount = 0;

        // Pre-allocate
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }

    /**
     * Acquire an object from the pool
     * @returns {Object}
     */
    acquire() {
        let obj;

        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            // Pool exhausted, create new object
            obj = this.factory();
        }

        this.activeCount++;
        return obj;
    }

    /**
     * Release an object back to the pool
     * @param {Object} obj 
     */
    release(obj) {
        this.reset(obj);
        this.pool.push(obj);
        this.activeCount--;
    }

    /**
     * Get pool statistics
     * @returns {Object}
     */
    getStats() {
        return {
            available: this.pool.length,
            active: this.activeCount,
            total: this.pool.length + this.activeCount
        };
    }

    /**
     * Clear the pool
     */
    clear() {
        this.pool = [];
        this.activeCount = 0;
    }
}

/**
 * Note object factory
 */
const createNoteObject = () => ({
    id: null,
    pitch: 0,
    velocity: 0,
    step: 0,
    duration: 0,
    startTime: 0,
    endTime: 0,
    instrumentId: null,
    isActive: false
});

/**
 * Reset note object for reuse
 */
const resetNoteObject = (note) => {
    note.id = null;
    note.pitch = 0;
    note.velocity = 0;
    note.step = 0;
    note.duration = 0;
    note.startTime = 0;
    note.endTime = 0;
    note.instrumentId = null;
    note.isActive = false;
};

/**
 * Voice object factory
 */
const createVoiceObject = () => ({
    id: null,
    instrumentId: null,
    pitch: 0,
    velocity: 0,
    startTime: 0,
    releaseTime: 0,
    state: 'free', // 'free' | 'attack' | 'sustain' | 'release'
    gain: 0,
    pan: 0
});

/**
 * Reset voice object for reuse
 */
const resetVoiceObject = (voice) => {
    voice.id = null;
    voice.instrumentId = null;
    voice.pitch = 0;
    voice.velocity = 0;
    voice.startTime = 0;
    voice.releaseTime = 0;
    voice.state = 'free';
    voice.gain = 0;
    voice.pan = 0;
};

/**
 * Scheduled event factory
 */
const createEventObject = () => ({
    id: null,
    type: null,
    time: 0,
    data: null,
    executed: false,
    cancelled: false
});

/**
 * Reset event object for reuse
 */
const resetEventObject = (event) => {
    event.id = null;
    event.type = null;
    event.time = 0;
    event.data = null;
    event.executed = false;
    event.cancelled = false;
};

/**
 * AudioObjectPool - Centralized memory management
 */
export class AudioObjectPool {
    constructor(options = {}) {
        const {
            notePoolSize = 1000,
            voicePoolSize = 128,
            eventPoolSize = 500,
            bufferBlockSize = 128
        } = options;

        // Object pools
        this.notePool = new ObjectPool(createNoteObject, resetNoteObject, notePoolSize);
        this.voicePool = new ObjectPool(createVoiceObject, resetVoiceObject, voicePoolSize);
        this.eventPool = new ObjectPool(createEventObject, resetEventObject, eventPoolSize);

        // Pre-allocated typed arrays for audio processing
        this.bufferBlockSize = bufferBlockSize;
        this._tempBufferL = new Float32Array(bufferBlockSize);
        this._tempBufferR = new Float32Array(bufferBlockSize);
        this._mixBuffer = new Float32Array(bufferBlockSize * 2);

        // Level meters (32 stereo channels)
        this._levelBuffer = new Float32Array(64);

        // Parameter automation buffer
        this._automationBuffer = new Float64Array(1024);

        // Note scheduling buffer (pitch, velocity, step, duration)
        this._scheduleBuffer = new Int32Array(4096);

        logger.debug(NAMESPACES.AUDIO, `AudioObjectPool initialized: ${notePoolSize} notes, ${voicePoolSize} voices`);
    }

    // =================== NOTE POOL ===================

    /**
     * Acquire a note object
     * @returns {Object}
     */
    acquireNote() {
        return this.notePool.acquire();
    }

    /**
     * Release a note object
     * @param {Object} note 
     */
    releaseNote(note) {
        this.notePool.release(note);
    }

    /**
     * Create a note from data (uses pool)
     * @param {Object} noteData 
     * @returns {Object}
     */
    createNote(noteData) {
        const note = this.acquireNote();
        note.id = noteData.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        note.pitch = noteData.pitch || 0;
        note.velocity = noteData.velocity || 0.8;
        note.step = noteData.step || 0;
        note.duration = noteData.duration || 1;
        note.instrumentId = noteData.instrumentId || null;
        note.isActive = true;
        return note;
    }

    // =================== VOICE POOL ===================

    /**
     * Acquire a voice object
     * @returns {Object}
     */
    acquireVoice() {
        return this.voicePool.acquire();
    }

    /**
     * Release a voice object
     * @param {Object} voice 
     */
    releaseVoice(voice) {
        this.voicePool.release(voice);
    }

    /**
     * Allocate a voice for a note
     * @param {string} instrumentId 
     * @param {number} pitch 
     * @param {number} velocity 
     * @param {number} startTime 
     * @returns {Object}
     */
    allocateVoice(instrumentId, pitch, velocity, startTime) {
        const voice = this.acquireVoice();
        voice.id = `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        voice.instrumentId = instrumentId;
        voice.pitch = pitch;
        voice.velocity = velocity;
        voice.startTime = startTime;
        voice.state = 'attack';
        return voice;
    }

    // =================== EVENT POOL ===================

    /**
     * Acquire an event object
     * @returns {Object}
     */
    acquireEvent() {
        return this.eventPool.acquire();
    }

    /**
     * Release an event object
     * @param {Object} event 
     */
    releaseEvent(event) {
        this.eventPool.release(event);
    }

    /**
     * Create a scheduled event (uses pool)
     * @param {string} type 
     * @param {number} time 
     * @param {Object} data 
     * @returns {Object}
     */
    createEvent(type, time, data) {
        const event = this.acquireEvent();
        event.id = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        event.type = type;
        event.time = time;
        event.data = data;
        event.executed = false;
        event.cancelled = false;
        return event;
    }

    // =================== TYPED ARRAY BUFFERS ===================

    /**
     * Get temp buffer for left channel
     * @returns {Float32Array}
     */
    getTempBufferL() {
        this._tempBufferL.fill(0);
        return this._tempBufferL;
    }

    /**
     * Get temp buffer for right channel
     * @returns {Float32Array}
     */
    getTempBufferR() {
        this._tempBufferR.fill(0);
        return this._tempBufferR;
    }

    /**
     * Get mix buffer (interleaved stereo)
     * @returns {Float32Array}
     */
    getMixBuffer() {
        this._mixBuffer.fill(0);
        return this._mixBuffer;
    }

    /**
     * Get level buffer
     * @returns {Float32Array}
     */
    getLevelBuffer() {
        return this._levelBuffer;
    }

    /**
     * Get automation buffer
     * @returns {Float64Array}
     */
    getAutomationBuffer() {
        return this._automationBuffer;
    }

    /**
     * Get schedule buffer
     * @returns {Int32Array}
     */
    getScheduleBuffer() {
        return this._scheduleBuffer;
    }

    // =================== STATS ===================

    /**
     * Get pool statistics
     * @returns {Object}
     */
    getStats() {
        return {
            notePool: this.notePool.getStats(),
            voicePool: this.voicePool.getStats(),
            eventPool: this.eventPool.getStats(),
            buffers: {
                tempBufferSize: this._tempBufferL.length,
                mixBufferSize: this._mixBuffer.length,
                levelBufferSize: this._levelBuffer.length,
                automationBufferSize: this._automationBuffer.length,
                scheduleBufferSize: this._scheduleBuffer.length
            }
        };
    }

    /**
     * Reset all pools
     */
    reset() {
        this.notePool.clear();
        this.voicePool.clear();
        this.eventPool.clear();

        // Re-initialize pools with default sizes
        for (let i = 0; i < 1000; i++) {
            this.notePool.pool.push(createNoteObject());
        }
        for (let i = 0; i < 128; i++) {
            this.voicePool.pool.push(createVoiceObject());
        }
        for (let i = 0; i < 500; i++) {
            this.eventPool.pool.push(createEventObject());
        }

        logger.debug(NAMESPACES.AUDIO, 'AudioObjectPool reset');
    }

    /**
     * Dispose the pool
     */
    dispose() {
        this.notePool.clear();
        this.voicePool.clear();
        this.eventPool.clear();

        this._tempBufferL = null;
        this._tempBufferR = null;
        this._mixBuffer = null;
        this._levelBuffer = null;
        this._automationBuffer = null;
        this._scheduleBuffer = null;

        logger.debug(NAMESPACES.AUDIO, 'AudioObjectPool disposed');
    }
}

// Global singleton instance
export const audioObjectPool = new AudioObjectPool();
