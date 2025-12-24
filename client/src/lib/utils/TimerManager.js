/**
 * TIMER MANAGER
 * 
 * Centralized timer management system to prevent memory leaks
 * and ensure proper cleanup of all setInterval and RAF timers.
 * 
 * Problem Solved:
 * - 32+ setInterval timers scattered across codebase
 * - Many without proper cleanup (memory leaks)
 * - No centralized tracking or monitoring
 * 
 * Features:
 * - Automatic cleanup on dispose
 * - Timer tracking and statistics
 * - Support for both setInterval and RAF
 * - Debug logging
 * 
 * Usage:
 *   const timerManager = new TimerManager();
 *   const id = timerManager.setInterval(() => {...}, 1000, 'my-timer');
 *   timerManager.clearInterval(id);
 *   timerManager.cleanup(); // Clear all timers
 */

class TimerManager {
    constructor(name = 'default') {
        this.name = name;
        this.timers = new Map();
        this.rafHandles = new Map();
        this.stats = {
            created: 0,
            cleared: 0,
            leaked: 0
        };
    }

    /**
     * Create a managed setInterval
     * @param {Function} callback - Function to call
     * @param {number} delay - Delay in milliseconds
     * @param {string} id - Optional unique identifier
     * @returns {string} Timer ID
     */
    setInterval(callback, delay, id = null) {
        const timerId = id || `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Clear existing timer with same ID
        if (this.timers.has(timerId)) {
            console.warn(`⏱️ TimerManager[${this.name}]: Replacing existing timer: ${timerId}`);
            this.clearInterval(timerId);
        }

        const handle = setInterval(callback, delay);
        this.timers.set(timerId, {
            handle,
            type: 'interval',
            delay,
            createdAt: Date.now()
        });

        this.stats.created++;
        console.log(`⏱️ TimerManager[${this.name}]: Created interval "${timerId}" (${delay}ms)`);

        return timerId;
    }

    /**
     * Create a managed setTimeout
     * @param {Function} callback - Function to call
     * @param {number} delay - Delay in milliseconds
     * @param {string} id - Optional unique identifier
     * @returns {string} Timer ID
     */
    setTimeout(callback, delay, id = null) {
        const timerId = id || `timeout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (this.timers.has(timerId)) {
            console.warn(`⏱️ TimerManager[${this.name}]: Replacing existing timeout: ${timerId}`);
            this.clearTimeout(timerId);
        }

        const handle = setTimeout(() => {
            callback();
            // Auto-remove after execution
            this.timers.delete(timerId);
        }, delay);

        this.timers.set(timerId, {
            handle,
            type: 'timeout',
            delay,
            createdAt: Date.now()
        });

        this.stats.created++;
        console.log(`⏱️ TimerManager[${this.name}]: Created timeout "${timerId}" (${delay}ms)`);

        return timerId;
    }

    /**
     * Create a managed RAF loop
     * @param {Function} callback - Function to call (receives timestamp)
     * @param {string} id - Optional unique identifier
     * @returns {string} RAF ID
     */
    requestAnimationFrame(callback, id = null) {
        const rafId = id || `raf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (this.rafHandles.has(rafId)) {
            console.warn(`⏱️ TimerManager[${this.name}]: Replacing existing RAF: ${rafId}`);
            this.cancelAnimationFrame(rafId);
        }

        const loop = (timestamp) => {
            // Callback can return false to stop the loop
            const shouldContinue = callback(timestamp);

            if (shouldContinue !== false && this.rafHandles.has(rafId)) {
                const handle = requestAnimationFrame(loop);
                this.rafHandles.set(rafId, {
                    handle,
                    createdAt: this.rafHandles.get(rafId)?.createdAt || Date.now()
                });
            } else {
                this.rafHandles.delete(rafId);
            }
        };

        const handle = requestAnimationFrame(loop);
        this.rafHandles.set(rafId, {
            handle,
            createdAt: Date.now()
        });

        this.stats.created++;
        console.log(`⏱️ TimerManager[${this.name}]: Created RAF "${rafId}"`);

        return rafId;
    }

    /**
     * Clear a setInterval timer
     */
    clearInterval(id) {
        const timer = this.timers.get(id);
        if (timer) {
            clearInterval(timer.handle);
            this.timers.delete(id);
            this.stats.cleared++;
            console.log(`⏱️ TimerManager[${this.name}]: Cleared interval "${id}"`);
            return true;
        }
        return false;
    }

    /**
     * Clear a setTimeout timer
     */
    clearTimeout(id) {
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer.handle);
            this.timers.delete(id);
            this.stats.cleared++;
            console.log(`⏱️ TimerManager[${this.name}]: Cleared timeout "${id}"`);
            return true;
        }
        return false;
    }

    /**
     * Cancel a RAF loop
     */
    cancelAnimationFrame(id) {
        const raf = this.rafHandles.get(id);
        if (raf) {
            cancelAnimationFrame(raf.handle);
            this.rafHandles.delete(id);
            this.stats.cleared++;
            console.log(`⏱️ TimerManager[${this.name}]: Cancelled RAF "${id}"`);
            return true;
        }
        return false;
    }

    /**
     * Cleanup all timers (call on component unmount)
     */
    cleanup() {
        const timerCount = this.timers.size;
        const rafCount = this.rafHandles.size;

        // Clear all intervals/timeouts
        for (const [id, timer] of this.timers) {
            if (timer.type === 'interval') {
                clearInterval(timer.handle);
            } else {
                clearTimeout(timer.handle);
            }
        }

        // Clear all RAF handles
        for (const [id, raf] of this.rafHandles) {
            cancelAnimationFrame(raf.handle);
        }

        this.stats.leaked += timerCount + rafCount;
        this.timers.clear();
        this.rafHandles.clear();

        if (timerCount > 0 || rafCount > 0) {
            console.warn(
                `⏱️ TimerManager[${this.name}]: Cleaned up ${timerCount} timers + ${rafCount} RAF handles (potential memory leak prevented)`
            );
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            name: this.name,
            activeTimers: this.timers.size,
            activeRAFs: this.rafHandles.size,
            totalCreated: this.stats.created,
            totalCleared: this.stats.cleared,
            potentialLeaks: this.stats.leaked,
            timers: Array.from(this.timers.entries()).map(([id, timer]) => ({
                id,
                type: timer.type,
                delay: timer.delay,
                age: Date.now() - timer.createdAt
            })),
            rafs: Array.from(this.rafHandles.entries()).map(([id, raf]) => ({
                id,
                age: Date.now() - raf.createdAt
            }))
        };
    }

    /**
     * Log current state
     */
    logStats() {
        const stats = this.getStats();
        console.group(`⏱️ TimerManager[${this.name}] Statistics`);
        console.log(`Active Timers: ${stats.activeTimers}`);
        console.log(`Active RAFs: ${stats.activeRAFs}`);
        console.log(`Total Created: ${stats.totalCreated}`);
        console.log(`Total Cleared: ${stats.totalCleared}`);
        console.log(`Potential Leaks Prevented: ${stats.potentialLeaks}`);

        if (stats.timers.length > 0) {
            console.group('Active Timers');
            stats.timers.forEach(t => {
                console.log(`  ${t.id}: ${t.type} (${t.delay}ms, age: ${t.age}ms)`);
            });
            console.groupEnd();
        }

        if (stats.rafs.length > 0) {
            console.group('Active RAFs');
            stats.rafs.forEach(r => {
                console.log(`  ${r.id}: (age: ${r.age}ms)`);
            });
            console.groupEnd();
        }

        console.groupEnd();
    }

    /**
     * Dispose manager (cleanup + prevent further use)
     */
    dispose() {
        this.cleanup();
        console.log(`⏱️ TimerManager[${this.name}]: Disposed`);
    }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

export const globalTimerManager = new TimerManager('global');

// Cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        globalTimerManager.cleanup();
    });
}

export default TimerManager;
