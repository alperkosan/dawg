/**
 * Event Batcher - Batch Processing for Performance
 * 
 * Processes multiple events in batches to reduce CPU overhead and improve timing consistency.
 * Industry Standard: FL Studio, Ableton Live, Logic Pro all use event batching
 * 
 * Benefits:
 * - Reduced function call overhead
 * - Better CPU cache utilization
 * - Improved timing consistency
 * - Lower memory allocation
 */

export class EventBatcher {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 32; // Process 32 events at once
        this.maxBatchTime = options.maxBatchTime || 0.001; // 1ms max batch processing time
        this.pendingEvents = [];
        this.processingBatch = false;
        
        // Statistics
        this.stats = {
            totalBatches: 0,
            totalEvents: 0,
            avgBatchSize: 0,
            maxBatchSize: 0
        };
    }

    /**
     * Add event to batch queue
     * 
     * @param {Function} callback - Event callback function
     * @param {number} scheduledTime - Scheduled time in seconds
     * @param {Object} data - Event data
     * @param {number} priority - Event priority (higher = more important, default: 0)
     */
    addEvent(callback, scheduledTime, data = {}, priority = 0) {
        this.pendingEvents.push({
            callback,
            scheduledTime,
            data,
            priority,
            addedAt: performance.now()
        });
        
        this.stats.totalEvents++;
    }

    /**
     * Process batch of events up to a certain time
     * 
     * @param {number} currentTime - Current audio time
     * @param {number} maxTime - Maximum time to process up to
     * @returns {number} Number of events processed
     */
    processBatch(currentTime, maxTime) {
        if (this.pendingEvents.length === 0) {
            return 0;
        }

        // Sort events by time and priority
        // Priority first (higher priority first), then time (earlier first)
        this.pendingEvents.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority; // Higher priority first
            }
            return a.scheduledTime - b.scheduledTime; // Earlier time first
        });

        // Process events up to maxTime
        const batchStartTime = performance.now();
        let processedCount = 0;
        const eventsToProcess = [];

        // Collect events to process
        for (let i = 0; i < this.pendingEvents.length; i++) {
            const event = this.pendingEvents[i];
            
            // Only process events that are due (scheduledTime <= currentTime)
            // and within the maxTime window
            if (event.scheduledTime <= maxTime && event.scheduledTime <= currentTime) {
                eventsToProcess.push(event);
            } else if (event.scheduledTime > maxTime) {
                // Events beyond maxTime, stop collecting
                break;
            }
        }

        // Process events in batch
        if (eventsToProcess.length > 0) {
            // Limit batch size to prevent long processing
            const batch = eventsToProcess.slice(0, this.batchSize);
            
            // Execute all callbacks in batch
            for (const event of batch) {
                try {
                    event.callback(event.scheduledTime, event.data);
                    processedCount++;
                } catch (error) {
                    console.error('EventBatcher: Event execution error:', error);
                }
            }

            // Remove processed events from pending queue
            this.pendingEvents = this.pendingEvents.filter(
                event => !batch.includes(event)
            );

            // Update statistics
            this.stats.totalBatches++;
            this.stats.avgBatchSize = (this.stats.avgBatchSize * (this.stats.totalBatches - 1) + batch.length) / this.stats.totalBatches;
            this.stats.maxBatchSize = Math.max(this.stats.maxBatchSize, batch.length);

            // Check processing time
            const processingTime = (performance.now() - batchStartTime) / 1000; // Convert to seconds
            if (processingTime > this.maxBatchTime) {
                console.warn(`EventBatcher: Batch processing took ${(processingTime * 1000).toFixed(2)}ms (limit: ${this.maxBatchTime * 1000}ms)`);
            }
        }

        return processedCount;
    }

    /**
     * Process all due events (up to current time)
     * 
     * @param {number} currentTime - Current audio time
     * @returns {number} Number of events processed
     */
    processDueEvents(currentTime) {
        return this.processBatch(currentTime, currentTime);
    }

    /**
     * Clear all pending events
     */
    clear() {
        this.pendingEvents = [];
    }

    /**
     * Get pending events count
     * 
     * @returns {number} Number of pending events
     */
    getPendingCount() {
        return this.pendingEvents.length;
    }

    /**
     * Get statistics
     * 
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            pendingEvents: this.pendingEvents.length
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalBatches: 0,
            totalEvents: 0,
            avgBatchSize: 0,
            maxBatchSize: 0
        };
    }
}

