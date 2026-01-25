// DEBUG_SCHEDULER.js
// Copy-paste this in browser console to diagnose scheduler issues

console.log('=== SCHEDULER DIAGNOSTICS ===\n');

const adapter = window.playbackService?.schedulerAdapter;
const scheduler = adapter?.continuousScheduler;

if (!scheduler) {
    console.error('❌ Scheduler not found!');
} else {
    console.log('✅ Scheduler exists');
    console.log('Running:', scheduler.isRunning);
    console.log('lastScheduledTick:', scheduler.lastScheduledTick);
    console.log('Stats:', scheduler.stats);

    // Check pattern store
    const patternStore = scheduler.patternStore;
    console.log('\n=== PATTERN STORE ===');
    console.log('activePatternId:', patternStore.activePatternId);
    console.log('patterns:', patternStore.patterns);

    // Check if we can get pattern
    const activeId = patternStore.activePatternId;
    if (activeId) {
        const pattern = patternStore.patterns[activeId];
        console.log('\n=== ACTIVE PATTERN ===');
        console.log('Pattern:', pattern);
        console.log('Pattern data:', pattern?.data);

        if (pattern?.data) {
            Object.entries(pattern.data).forEach(([instId, notes]) => {
                console.log(`  ${instId}: ${notes ? notes.length : 0} notes`);
                if (notes && notes.length > 0) {
                    console.log('    First note:', notes[0]);
                }
            });
        } else {
            console.warn('⚠️ Pattern has no data!');
        }
    } else {
        console.warn('⚠️ No active pattern!');
    }

    // Check transport
    console.log('\n=== TRANSPORT ===');
    console.log('currentTick:', scheduler.transport?.currentTick);
    console.log('isPlaying:', scheduler.transport?.isPlaying);
    console.log('loop:', scheduler.transport?.loop);
    console.log('loopStartTick:', scheduler.transport?.loopStartTick);
    console.log('loopEndTick:', scheduler.transport?.loopEndTick);
    console.log('ticksPerStep:', scheduler.transport?.ticksPerStep);

    // Check scheduled events
    console.log('\n=== SCHEDULED EVENTS ===');
    console.log('scheduledEvents.size:', scheduler.scheduledEvents.size);
    if (scheduler.scheduledEvents.size > 0) {
        console.log('First 5 events:');
        let count = 0;
        scheduler.scheduledEvents.forEach((event, eventId) => {
            if (count < 5) {
                console.log(`  ${eventId}:`, event);
                count++;
            }
        });
    }

    // Check dirty patterns
    console.log('\n=== DIRTY PATTERNS ===');
    console.log('dirtyPatterns:', Array.from(scheduler.dirtyPatterns));

    // Manual window calculation
    console.log('\n=== MANUAL WINDOW TEST ===');
    const audioTime = scheduler.audioContext.currentTime;
    const windowStart = audioTime;
    const windowEnd = audioTime + scheduler.lookaheadTime;
    console.log('audioTime:', audioTime);
    console.log('windowStart:', windowStart);
    console.log('windowEnd:', windowEnd);

    // Try to manually call _computeNotesInWindow
    if (activeId && pattern?.data) {
        console.log('\n=== TESTING NOTE COMPUTATION ===');
        const windowStartTick = scheduler._timeToTick(windowStart);
        const windowEndTick = scheduler._timeToTick(windowEnd);
        console.log('windowStartTick:', windowStartTick);
        console.log('windowEndTick:', windowEndTick);

        try {
            const notes = scheduler._computeNotesInWindow(pattern, windowStartTick, windowEndTick);
            console.log('Computed notes:', notes.length);
            if (notes.length > 0) {
                console.log('First note:', notes[0]);
            } else {
                console.warn('⚠️ No notes computed! Check pattern.data structure');
            }
        } catch (e) {
            console.error('❌ Error computing notes:', e);
        }
    }
}

console.log('\n=== END DIAGNOSTICS ===');
