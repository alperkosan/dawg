// client/src/lib/core/scheduling/SchedulerDiagnostics.js
// Diagnostic tools for ContinuousScheduler debugging

/**
 * SchedulerDiagnostics
 *
 * Real-time monitoring and debugging tools for ContinuousScheduler
 * Access via browser console: window.schedulerDiag
 */
export class SchedulerDiagnostics {
    constructor(playbackService) {
        this.playbackService = playbackService;
        this.adapter = playbackService.schedulerAdapter;
        this.scheduler = this.adapter?.continuousScheduler;

        // Monitoring state
        this.isMonitoring = false;
        this.monitorInterval = null;
        this.eventLog = [];
        this.maxLogSize = 100;

        console.log('🔍 [SchedulerDiagnostics] Initialized');
    }

    // =================== QUICK CHECKS ===================

    /**
     * Check overall system health
     */
    healthCheck() {
        const health = {
            timestamp: Date.now(),
            continuousScheduler: {
                enabled: this.adapter?.useContinuousScheduler || false,
                running: this.scheduler?.isRunning || false,
                exists: !!this.scheduler
            },
            schedulerService: {
                exists: !!this.playbackService?.schedulerService,
                running: this.playbackService?.schedulerService?.isRunning || false
            },
            transport: {
                exists: !!this.playbackService?.engine?.transport,
                playing: this.playbackService?.engine?.transport?.isPlaying || false,
                currentTick: this.playbackService?.engine?.transport?.currentTick || 0,
                bpm: this.playbackService?.engine?.transport?.bpm || 0
            },
            pattern: {
                activeId: this._getActivePatternId(),
                noteCount: this._getActivePatternNoteCount()
            },
            stats: this.scheduler?.getStats() || null
        };

        // Health score
        health.score = this._calculateHealthScore(health);
        health.issues = this._detectIssues(health);

        return health;
    }

    /**
     * Calculate health score (0-100)
     */
    _calculateHealthScore(health) {
        let score = 100;

        if (!health.continuousScheduler.enabled) score -= 50;
        if (!health.continuousScheduler.running && health.transport.playing) score -= 30;
        if (!health.schedulerService.running && health.transport.playing) score -= 30;
        if (!health.pattern.activeId) score -= 10;
        if (health.pattern.noteCount === 0) score -= 10;

        return Math.max(0, score);
    }

    /**
     * Detect specific issues
     */
    _detectIssues(health) {
        const issues = [];

        if (!health.continuousScheduler.enabled) {
            issues.push('⚠️ ContinuousScheduler DISABLED - using old scheduler');
        }

        if (health.transport.playing && !health.continuousScheduler.running) {
            issues.push('❌ Transport playing but ContinuousScheduler NOT running');
        }

        if (health.transport.playing && !health.schedulerService.running) {
            issues.push('❌ Transport playing but SchedulerService NOT running (no audio execution!)');
        }

        if (!health.pattern.activeId) {
            issues.push('⚠️ No active pattern selected');
        }

        if (health.pattern.noteCount === 0) {
            issues.push('ℹ️ Active pattern has no notes');
        }

        const stats = health.stats;
        if (stats && stats.eventsScheduled > 0 && stats.eventsExecuted === 0) {
            issues.push('❌ Events scheduled but NONE executed - audio not working!');
        }

        if (stats && stats.avgTickDuration > 10) {
            issues.push('⚠️ Tick duration too high (>10ms) - performance issue');
        }

        return issues;
    }

    // =================== DETAILED INSPECTION ===================

    /**
     * Get detailed scheduler state
     */
    getState() {
        if (!this.scheduler) {
            return { error: 'ContinuousScheduler not available' };
        }

        return {
            running: this.scheduler.isRunning,
            stats: this.scheduler.getStats(),
            scheduledEvents: this._getScheduledEventsSummary(),
            dirtyPatterns: Array.from(this.scheduler.dirtyPatterns),
            lastPosition: this.scheduler.lastPosition,
            transport: {
                currentTick: this.scheduler.transport.currentTick,
                bpm: this.scheduler.transport.bpm,
                isPlaying: this.scheduler.transport.isPlaying
            }
        };
    }

    /**
     * Get summary of scheduled events
     */
    _getScheduledEventsSummary() {
        if (!this.scheduler) return null;

        const events = Array.from(this.scheduler.scheduledEvents.values());
        const now = this.playbackService.engine.audioContext.currentTime;

        return {
            total: events.length,
            executed: events.filter(e => e.executed).length,
            pending: events.filter(e => !e.executed && e.time >= now).length,
            past: events.filter(e => !e.executed && e.time < now).length,
            byPattern: this._groupEventsByPattern(events)
        };
    }

    /**
     * Group events by pattern
     */
    _groupEventsByPattern(events) {
        const grouped = {};
        events.forEach(event => {
            if (!grouped[event.patternId]) {
                grouped[event.patternId] = { total: 0, executed: 0, pending: 0 };
            }
            grouped[event.patternId].total++;
            if (event.executed) {
                grouped[event.patternId].executed++;
            } else {
                grouped[event.patternId].pending++;
            }
        });
        return grouped;
    }

    // =================== REAL-TIME MONITORING ===================

    /**
     * Start real-time monitoring (prints to console every second)
     */
    startMonitoring(intervalMs = 1000) {
        if (this.isMonitoring) {
            console.log('⚠️ [Diagnostics] Already monitoring');
            return;
        }

        console.log('📊 [Diagnostics] Starting real-time monitoring...');
        this.isMonitoring = true;

        this.monitorInterval = setInterval(() => {
            this._printMonitoringSnapshot();
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            console.log('⚠️ [Diagnostics] Not monitoring');
            return;
        }

        console.log('⏹️ [Diagnostics] Stopping monitoring');
        clearInterval(this.monitorInterval);
        this.isMonitoring = false;
    }

    /**
     * Print monitoring snapshot
     */
    _printMonitoringSnapshot() {
        const health = this.healthCheck();
        const state = this.getState();

        console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SCHEDULER MONITOR | Health: ${health.score}/100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 Transport: ${health.transport.playing ? '▶️ PLAYING' : '⏸️ STOPPED'} | Tick: ${health.transport.currentTick} | BPM: ${health.transport.bpm}
🔄 Scheduler: ${state.running ? '✅ RUNNING' : '❌ STOPPED'} | Ticks: ${state.stats?.tickCount || 0} | Avg: ${state.stats?.avgTickDuration?.toFixed(2) || 0}ms
📅 Events: Scheduled: ${state.stats?.eventsScheduled || 0} | Executed: ${state.stats?.eventsExecuted || 0} | In Map: ${state.scheduledEvents?.total || 0}
🎹 Pattern: ${health.pattern.activeId || 'None'} | Notes: ${health.pattern.noteCount || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${health.issues.length > 0 ? health.issues.join('\n') : '✅ No issues detected'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
    }

    // =================== EVENT LOGGING ===================

    /**
     * Log an event (for debugging)
     */
    logEvent(type, data) {
        const event = {
            timestamp: Date.now(),
            type,
            data
        };

        this.eventLog.push(event);

        // Keep log size manageable
        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog.shift();
        }
    }

    /**
     * Get recent events
     */
    getRecentEvents(count = 10) {
        return this.eventLog.slice(-count);
    }

    /**
     * Clear event log
     */
    clearLog() {
        this.eventLog = [];
        console.log('🗑️ [Diagnostics] Event log cleared');
    }

    // =================== HELPERS ===================

    /**
     * Get active pattern ID
     */
    _getActivePatternId() {
        try {
            if (typeof window !== 'undefined' && window.__stores?.useArrangementStore) {
                return window.__stores.useArrangementStore.getState().activePatternId;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get active pattern note count
     */
    _getActivePatternNoteCount() {
        try {
            if (typeof window !== 'undefined' && window.__stores?.useArrangementStore) {
                const state = window.__stores.useArrangementStore.getState();
                const pattern = state.patterns[state.activePatternId];
                return pattern?.notes?.length || 0;
            }
            return 0;
        } catch (e) {
            return 0;
        }
    }

    // =================== QUICK COMMANDS ===================

    /**
     * Print quick status (one-liner)
     */
    status() {
        const health = this.healthCheck();
        console.log(`
🎵 Scheduler Status | Health: ${health.score}/100
${health.issues.length > 0 ? health.issues.join('\n') : '✅ All systems operational'}
        `);
    }

    /**
     * Print detailed report
     */
    report() {
        const health = this.healthCheck();
        const state = this.getState();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 CONTINUOUS SCHEDULER DIAGNOSTIC REPORT');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n1️⃣ HEALTH CHECK:');
        console.log(health);
        console.log('\n2️⃣ SCHEDULER STATE:');
        console.log(state);
        console.log('\n3️⃣ SCHEDULED EVENTS:');
        console.log(state.scheduledEvents);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    /**
     * Force scheduler restart (for testing)
     */
    restart() {
        console.log('🔄 [Diagnostics] Forcing scheduler restart...');
        if (this.scheduler) {
            this.scheduler.stop();
            this.scheduler.clearAll();
            this.scheduler.start();
            console.log('✅ [Diagnostics] Scheduler restarted');
        } else {
            console.log('❌ [Diagnostics] Scheduler not available');
        }
    }

    /**
     * Get help text
     */
    help() {
        console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SCHEDULER DIAGNOSTICS - HELP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quick Commands:
  schedulerDiag.status()         - Quick health check
  schedulerDiag.report()         - Detailed diagnostic report
  schedulerDiag.healthCheck()    - Full health check with issues
  schedulerDiag.getState()       - Current scheduler state

Monitoring:
  schedulerDiag.startMonitoring()  - Start real-time monitoring
  schedulerDiag.stopMonitoring()   - Stop monitoring

Debugging:
  schedulerDiag.getRecentEvents()  - Show recent events
  schedulerDiag.clearLog()         - Clear event log
  schedulerDiag.restart()          - Force scheduler restart

Examples:
  // Quick check
  schedulerDiag.status()

  // Watch in real-time
  schedulerDiag.startMonitoring()

  // Stop watching
  schedulerDiag.stopMonitoring()

  // Full diagnostic
  schedulerDiag.report()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
    }
}

// =================== GLOBAL EXPOSURE ===================

/**
 * Initialize diagnostics globally
 * Called from PlaybackService after initialization
 */
export function initSchedulerDiagnostics(playbackService) {
    if (typeof window !== 'undefined') {
        window.schedulerDiag = new SchedulerDiagnostics(playbackService);
        console.log('🔍 [SchedulerDiagnostics] Available globally as window.schedulerDiag');
        console.log('💡 Type schedulerDiag.help() for commands');
    }
}
