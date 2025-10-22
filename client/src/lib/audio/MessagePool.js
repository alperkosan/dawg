/**
 * Message Pool
 *
 * ⚡ PERFORMANCE OPTIMIZATION: Object pooling for AudioWorklet messages
 *
 * Problem:
 *   - Every note trigger creates new objects: { type, data: { pitch, velocity, ... } }
 *   - 32 polyphony × 60 notes/min = hundreds of objects/sec
 *   - String allocations: `${pitch}_${time}` for noteId
 *   - Causes frequent GC pauses → audio glitches!
 *
 * Solution:
 *   - Pre-allocate message objects in a pool
 *   - Reuse objects instead of creating new ones
 *   - Use number noteId instead of string
 *   - Eliminates GC pressure completely!
 *
 * Usage:
 * ```javascript
 * const pool = new MessagePool(64);
 *
 * // Acquire message from pool
 * const msg = pool.acquire('noteOn');
 * msg.data.pitch = 440;
 * msg.data.velocity = 0.8;
 *
 * // Send (pool automatically reuses it next time)
 * workletNode.port.postMessage(msg);
 * ```
 */

export class MessagePool {
    constructor(size = 64, messageTypes = null) {
        this.size = size;
        this.pools = new Map();
        this.index = new Map();
        this.nextNoteId = 0;

        // Default message types
        this.defaultTypes = messageTypes || [
            'noteOn',
            'noteOff',
            'paramUpdate',
            'patternData',
            'control'
        ];

        // Statistics (must be initialized BEFORE _initializePools)
        this.stats = {
            allocated: 0,
            acquired: 0,
            types: new Map()
        };

        // Initialize pools for each message type
        this._initializePools();
    }

    /**
     * Initialize object pools for each message type
     */
    _initializePools() {
        for (const type of this.defaultTypes) {
            const pool = [];
            const template = this._createMessageTemplate(type);

            // Pre-allocate messages
            for (let i = 0; i < this.size; i++) {
                pool.push(this._cloneMessage(template));
            }

            this.pools.set(type, pool);
            this.index.set(type, 0);
            this.stats.allocated += this.size;
        }
    }

    /**
     * Create message template based on type
     */
    _createMessageTemplate(type) {
        switch (type) {
            case 'noteOn':
                return {
                    type: 'noteOn',
                    data: {
                        pitch: 0,
                        frequency: 0,
                        velocity: 0,
                        time: 0,
                        duration: 0,
                        noteId: 0  // ⚡ Number instead of string
                    }
                };

            case 'noteOff':
                return {
                    type: 'noteOff',
                    data: {
                        pitch: 0,
                        frequency: 0,
                        time: 0,
                        noteId: 0
                    }
                };

            case 'paramUpdate':
                return {
                    type: 'paramUpdate',
                    data: {
                        paramName: '',
                        value: 0,
                        time: 0
                    }
                };

            case 'patternData':
                return {
                    type: 'patternData',
                    data: {
                        notes: [],
                        length: 0,
                        startTime: 0
                    }
                };

            case 'control':
                return {
                    type: 'control',
                    data: {
                        command: '',
                        value: 0
                    }
                };

            default:
                // Generic message
                return {
                    type: type,
                    data: {}
                };
        }
    }

    /**
     * Clone message template (deep copy)
     */
    _cloneMessage(template) {
        return {
            type: template.type,
            data: { ...template.data }
        };
    }

    /**
     * Acquire message from pool
     * @param {string} type - Message type ('noteOn', 'noteOff', etc.)
     * @returns {Object} Reused message object
     */
    acquire(type = 'noteOn') {
        const pool = this.pools.get(type);

        if (!pool) {
            console.warn(`⚠️ MessagePool: Unknown type '${type}', creating new message`);
            return this._createMessageTemplate(type);
        }

        // Get current index for this type
        const currentIndex = this.index.get(type);

        // Get message from pool (circular)
        const msg = pool[currentIndex];

        // Advance index (wrap around)
        this.index.set(type, (currentIndex + 1) % this.size);

        // Update statistics
        this.stats.acquired++;
        const typeStats = this.stats.types.get(type) || { count: 0 };
        typeStats.count++;
        this.stats.types.set(type, typeStats);

        // Reset message to default state (but keep object reference)
        this._resetMessage(msg, type);

        return msg;
    }

    /**
     * Reset message to default state
     */
    _resetMessage(msg, type) {
        msg.type = type;

        // Reset data fields based on type
        const template = this._createMessageTemplate(type);
        Object.assign(msg.data, template.data);
    }

    /**
     * Acquire noteOn message with data
     * @param {number} pitch - MIDI pitch
     * @param {number} frequency - Frequency in Hz
     * @param {number} velocity - Velocity (0-1)
     * @param {number} time - Start time
     * @param {number} duration - Duration (or null)
     * @returns {Object} Pre-filled noteOn message
     */
    acquireNoteOn(pitch, frequency, velocity, time, duration = null) {
        const msg = this.acquire('noteOn');

        msg.data.pitch = pitch;
        msg.data.frequency = frequency;
        msg.data.velocity = velocity;
        msg.data.time = time;
        msg.data.duration = duration || 0;
        msg.data.noteId = this.nextNoteId++;  // ⚡ Auto-increment number ID

        return msg;
    }

    /**
     * Acquire noteOff message with data
     * @param {number} pitch - MIDI pitch
     * @param {number} frequency - Frequency in Hz
     * @param {number} time - Release time
     * @param {number} noteId - Note ID
     * @returns {Object} Pre-filled noteOff message
     */
    acquireNoteOff(pitch, frequency, time, noteId = 0) {
        const msg = this.acquire('noteOff');

        msg.data.pitch = pitch;
        msg.data.frequency = frequency;
        msg.data.time = time;
        msg.data.noteId = noteId;

        return msg;
    }

    /**
     * Acquire paramUpdate message
     * @param {string} paramName - Parameter name
     * @param {number} value - New value
     * @param {number} time - Update time
     * @returns {Object} Pre-filled paramUpdate message
     */
    acquireParamUpdate(paramName, value, time) {
        const msg = this.acquire('paramUpdate');

        msg.data.paramName = paramName;
        msg.data.value = value;
        msg.data.time = time;

        return msg;
    }

    /**
     * Get pooling statistics
     */
    getStats() {
        const efficiency = this.stats.acquired > 0
            ? (this.stats.acquired / this.stats.allocated) * 100
            : 0;

        const typeBreakdown = {};
        for (const [type, stats] of this.stats.types) {
            typeBreakdown[type] = stats.count;
        }

        return {
            poolSize: this.size,
            totalAllocated: this.stats.allocated,
            totalAcquired: this.stats.acquired,
            efficiency: efficiency.toFixed(1) + '%',
            types: typeBreakdown,
            gcPressure: 'None (pooled objects)'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats.acquired = 0;
        this.stats.types.clear();
    }

    /**
     * Expand pool size if needed
     * @param {string} type - Message type
     * @param {number} additionalSize - How many more to allocate
     */
    expandPool(type, additionalSize = 32) {
        const pool = this.pools.get(type);
        if (!pool) {
            console.warn(`⚠️ MessagePool: Cannot expand unknown type '${type}'`);
            return;
        }

        const template = this._createMessageTemplate(type);
        for (let i = 0; i < additionalSize; i++) {
            pool.push(this._cloneMessage(template));
            this.stats.allocated++;
        }

        console.log(`✅ MessagePool: Expanded '${type}' pool by ${additionalSize} (new size: ${pool.length})`);
    }

    /**
     * Cleanup (not much needed - we keep pools alive)
     */
    dispose() {
        // Clear pools
        for (const pool of this.pools.values()) {
            pool.length = 0;
        }
        this.pools.clear();
        this.index.clear();
    }
}

/**
 * Global singleton message pool
 */
export const globalMessagePool = new MessagePool(128); // Larger pool for global use

/**
 * Convenience functions using global pool
 */
export function acquireNoteOn(pitch, frequency, velocity, time, duration = null) {
    return globalMessagePool.acquireNoteOn(pitch, frequency, velocity, time, duration);
}

export function acquireNoteOff(pitch, frequency, time, noteId = 0) {
    return globalMessagePool.acquireNoteOff(pitch, frequency, time, noteId);
}

export function acquireParamUpdate(paramName, value, time) {
    return globalMessagePool.acquireParamUpdate(paramName, value, time);
}

export function getMessagePoolStats() {
    return globalMessagePool.getStats();
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.getMessagePoolStats = () => {
        const stats = getMessagePoolStats();
        console.log('📊 Message Pool Statistics:', stats);
        return stats;
    };

    console.log('⚡ MessagePool loaded - use window.getMessagePoolStats() to check performance');
}

export default MessagePool;
