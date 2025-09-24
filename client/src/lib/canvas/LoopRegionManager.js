// Loop Region Manager - Dinamik loop yönetimi sistemi
export class LoopRegionManager {
    constructor() {
        this.loops = new Map(); // Active loops
        this.selectedLoop = null;
        this.callbacks = {
            onLoopCreate: null,
            onLoopUpdate: null,
            onLoopDelete: null,
            onLoopSelect: null
        };
    }

    // Event listeners
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(`on${event.charAt(0).toUpperCase()}${event.slice(1)}`)) {
            this.callbacks[`on${event.charAt(0).toUpperCase()}${event.slice(1)}`] = callback;
        }
    }

    // Create new loop region
    createLoop(startTime, endTime, options = {}) {
        const loop = {
            id: options.id || `loop_${Date.now()}`,
            startTime: Math.min(startTime, endTime),
            endTime: Math.max(startTime, endTime),
            name: options.name || `Loop ${this.loops.size + 1}`,
            color: options.color || this.getRandomColor(),
            isActive: options.isActive || false,
            fadeIn: options.fadeIn || 0,
            fadeOut: options.fadeOut || 0,
            gain: options.gain || 1.0,
            muted: options.muted || false,
            locked: options.locked || false,
            metadata: options.metadata || {}
        };

        this.loops.set(loop.id, loop);
        this.callbacks.onLoopCreate?.(loop);

        console.log(`🔄 Created loop: ${loop.name} (${loop.startTime}s - ${loop.endTime}s)`);
        return loop;
    }

    // Update existing loop
    updateLoop(loopId, updates) {
        const loop = this.loops.get(loopId);
        if (!loop) return null;

        const oldLoop = { ...loop };
        Object.assign(loop, updates);

        // Validate time boundaries
        if (loop.startTime >= loop.endTime) {
            loop.endTime = loop.startTime + 0.25; // Minimum duration
        }

        this.callbacks.onLoopUpdate?.(loop, oldLoop);
        return loop;
    }

    // Delete loop
    deleteLoop(loopId) {
        const loop = this.loops.get(loopId);
        if (!loop) return false;

        this.loops.delete(loopId);

        if (this.selectedLoop?.id === loopId) {
            this.selectedLoop = null;
        }

        this.callbacks.onLoopDelete?.(loop);
        console.log(`🗑️ Deleted loop: ${loop.name}`);
        return true;
    }

    // Select loop
    selectLoop(loopId) {
        const loop = loopId ? this.loops.get(loopId) : null;
        this.selectedLoop = loop;
        this.callbacks.onLoopSelect?.(loop);
        return loop;
    }

    // Get loop at time position
    getLoopAtTime(time) {
        for (const loop of this.loops.values()) {
            if (time >= loop.startTime && time < loop.endTime) {
                return loop;
            }
        }
        return null;
    }

    // Get loops in time range
    getLoopsInRange(startTime, endTime) {
        return Array.from(this.loops.values()).filter(loop =>
            loop.startTime < endTime && loop.endTime > startTime
        );
    }

    // Get all loops sorted by start time
    getAllLoops() {
        return Array.from(this.loops.values())
            .sort((a, b) => a.startTime - b.startTime);
    }

    // Check for overlapping loops
    hasOverlap(startTime, endTime, excludeLoopId = null) {
        for (const loop of this.loops.values()) {
            if (excludeLoopId && loop.id === excludeLoopId) continue;

            if (startTime < loop.endTime && endTime > loop.startTime) {
                return loop;
            }
        }
        return null;
    }

    // Merge overlapping loops
    mergeLoops(loopId1, loopId2) {
        const loop1 = this.loops.get(loopId1);
        const loop2 = this.loops.get(loopId2);

        if (!loop1 || !loop2) return null;

        const mergedLoop = this.createLoop(
            Math.min(loop1.startTime, loop2.startTime),
            Math.max(loop1.endTime, loop2.endTime),
            {
                name: `${loop1.name} + ${loop2.name}`,
                color: loop1.color,
                gain: (loop1.gain + loop2.gain) / 2
            }
        );

        this.deleteLoop(loopId1);
        this.deleteLoop(loopId2);

        return mergedLoop;
    }

    // Split loop at time
    splitLoop(loopId, splitTime) {
        const loop = this.loops.get(loopId);
        if (!loop || splitTime <= loop.startTime || splitTime >= loop.endTime) {
            return null;
        }

        // Create second part
        const loop2 = this.createLoop(
            splitTime,
            loop.endTime,
            {
                name: `${loop.name} (2)`,
                color: loop.color,
                gain: loop.gain,
                fadeIn: loop.fadeIn,
                fadeOut: loop.fadeOut
            }
        );

        // Update first part
        this.updateLoop(loopId, {
            endTime: splitTime,
            name: `${loop.name} (1)`
        });

        return [loop, loop2];
    }

    // Duplicate loop
    duplicateLoop(loopId, offset = 0) {
        const loop = this.loops.get(loopId);
        if (!loop) return null;

        const duration = loop.endTime - loop.startTime;
        const newStartTime = loop.endTime + offset;

        return this.createLoop(
            newStartTime,
            newStartTime + duration,
            {
                name: `${loop.name} (Copy)`,
                color: loop.color,
                gain: loop.gain,
                fadeIn: loop.fadeIn,
                fadeOut: loop.fadeOut,
                metadata: { ...loop.metadata }
            }
        );
    }

    // Quantize loop to grid
    quantizeLoop(loopId, gridSize = 0.25) {
        const loop = this.loops.get(loopId);
        if (!loop) return null;

        const quantizedStart = Math.round(loop.startTime / gridSize) * gridSize;
        const quantizedEnd = Math.round(loop.endTime / gridSize) * gridSize;

        return this.updateLoop(loopId, {
            startTime: quantizedStart,
            endTime: Math.max(quantizedEnd, quantizedStart + gridSize)
        });
    }

    // Generate random color for loop
    getRandomColor() {
        const colors = [
            '#4CAF50', '#2196F3', '#FF9800', '#E91E63',
            '#9C27B0', '#00BCD4', '#CDDC39', '#FF5722',
            '#795548', '#607D8B', '#3F51B5', '#009688'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Export loops data
    exportLoops() {
        return {
            loops: Array.from(this.loops.entries()),
            selectedLoop: this.selectedLoop?.id || null,
            exportTime: Date.now()
        };
    }

    // Import loops data
    importLoops(data) {
        this.loops.clear();
        this.selectedLoop = null;

        if (data.loops) {
            data.loops.forEach(([id, loop]) => {
                this.loops.set(id, loop);
            });
        }

        if (data.selectedLoop) {
            this.selectedLoop = this.loops.get(data.selectedLoop);
        }

        console.log(`📥 Imported ${this.loops.size} loops`);
    }

    // Clear all loops
    clearAll() {
        const count = this.loops.size;
        this.loops.clear();
        this.selectedLoop = null;

        console.log(`🗑️ Cleared ${count} loops`);
    }

    // Get loop statistics
    getStatistics() {
        const loops = Array.from(this.loops.values());

        return {
            totalLoops: loops.length,
            totalDuration: loops.reduce((sum, loop) => sum + (loop.endTime - loop.startTime), 0),
            averageDuration: loops.length > 0 ?
                loops.reduce((sum, loop) => sum + (loop.endTime - loop.startTime), 0) / loops.length : 0,
            activeLoops: loops.filter(loop => loop.isActive).length,
            mutedLoops: loops.filter(loop => loop.muted).length,
            lockedLoops: loops.filter(loop => loop.locked).length,
            timeRange: loops.length > 0 ? {
                earliest: Math.min(...loops.map(loop => loop.startTime)),
                latest: Math.max(...loops.map(loop => loop.endTime))
            } : null
        };
    }

    // Validate loops integrity
    validateLoops() {
        const issues = [];

        for (const [id, loop] of this.loops.entries()) {
            // Check time consistency
            if (loop.startTime >= loop.endTime) {
                issues.push(`Loop ${id}: Invalid time range`);
            }

            // Check for negative times
            if (loop.startTime < 0) {
                issues.push(`Loop ${id}: Negative start time`);
            }

            // Check gain values
            if (loop.gain < 0 || loop.gain > 2) {
                issues.push(`Loop ${id}: Invalid gain value`);
            }

            // Check fade values
            if (loop.fadeIn < 0 || loop.fadeOut < 0) {
                issues.push(`Loop ${id}: Negative fade values`);
            }
        }

        if (issues.length > 0) {
            console.warn('Loop validation issues:', issues);
        }

        return issues;
    }

    // Auto-arrange loops to prevent overlaps
    autoArrangeLoops() {
        const loops = this.getAllLoops();
        let currentTime = 0;
        const gap = 0.1; // 100ms gap between loops

        loops.forEach(loop => {
            const duration = loop.endTime - loop.startTime;

            if (loop.startTime < currentTime) {
                // Move loop to avoid overlap
                this.updateLoop(loop.id, {
                    startTime: currentTime,
                    endTime: currentTime + duration
                });
            }

            currentTime = Math.max(currentTime, loop.endTime) + gap;
        });

        console.log('🔧 Auto-arranged loops to prevent overlaps');
    }
}

// Singleton instance
export const loopRegionManager = new LoopRegionManager();