/**
 * AutomationScheduler - Parameter Automation Scheduling
 *
 * Responsibilities:
 * - Schedule automation events for mixer, instruments, and effects
 * - Apply automation changes at precise timing
 * - Handle pattern and song-level automation
 * - Real-time automation from Piano Roll CC lanes
 *
 * Extracted from PlaybackManager for better modularity
 */

import { SampleAccurateTime } from '../utils/SampleAccurateTime.js'; // ✅ NEW: Sample-accurate timing

export class AutomationScheduler {
    constructor(transport, audioEngine) {
        this.transport = transport;
        this.audioEngine = audioEngine;

        // ✅ PHASE 4: Real-time automation tracking
        // instrumentId -> { patternId, lanes }
        this.activeAutomations = new Map();

        // ✅ OPTIMIZATION: Track last logged values to reduce log spam
        this._lastLoggedValues = new Map();

        // ✅ NEW: Bind to high-precision transport scheduler (Phase 2 Improvement)
        // This replaces the jittery setInterval polling
        this.transport.on('scheduler', (data) => this.onSchedule(data));
    }

    /**
     * ✅ NEW: High-precision scheduling callback
     * Called by NativeTransportSystem for every tick within the lookahead window.
     * 
     * @param {Object} data - { time, tick, lookahead }
     */
    onSchedule({ time, tick }) {
        if (this.activeAutomations.size === 0) return;

        // Convert current tick to steps (with sub-step precision if needed, but here it's per-tick)
        // ticksPerStep = ppq / 4
        const ticksPerStep = this.transport.ppq / 4;
        const currentStep = tick / ticksPerStep;

        this.activeAutomations.forEach((info, instrumentId) => {
            this.processRealtimeAutomation(instrumentId, info.lanes, currentStep, time);
        });
    }

    /**
     * Schedule pattern-level automation
     *
     * @param {Object} pattern - Pattern with automation data
     */
    schedulePatternAutomation(pattern) {
        if (!pattern || !pattern.automation) {
            return;
        }

        Object.entries(pattern.automation).forEach(([targetId, automationData]) => {
            this.scheduleAutomationEvents(targetId, automationData);
        });
    }

    /**
     * Schedule song-level automation
     *
     * @param {Object} arrangementData - Arrangement with automation
     */
    scheduleSongAutomation(arrangementData) {
        if (!arrangementData || !arrangementData.automation) {
            return;
        }

        Object.entries(arrangementData.automation).forEach(([targetId, automationData]) => {
            this.scheduleAutomationEvents(targetId, automationData);
        });
    }

    /**
     * Schedule automation events for a specific target
     *
     * @param {string} targetId - Target identifier (e.g., "mixer.channel1.volume")
     * @param {Array} automationData - Automation events
     */
    scheduleAutomationEvents(targetId, automationData) {
        if (!Array.isArray(automationData)) {
            return;
        }

        automationData.forEach(event => {
            const eventTimeRaw = this.transport.stepsToSeconds(event.time || 0);

            // ✅ NEW: Convert to sample-accurate time for professional precision
            const eventTime = SampleAccurateTime.toSampleAccurate(
                this.transport.audioContext,
                eventTimeRaw
            );

            this.transport.scheduleEvent(
                eventTime,
                () => {
                    this.applyAutomationEvent(targetId, event);
                },
                { type: 'automation', targetId, event }
            );
        });
    }

    /**
     * Apply automation event to target
     *
     * @param {string} targetId - Target identifier
     * @param {Object} event - Automation event { time, value, curve }
     */
    applyAutomationEvent(targetId, event) {
        // Parse target ID: "type.id.parameter"
        const [type, id, parameter] = targetId.split('.');

        switch (type) {
            case 'mixer':
                this.applyMixerAutomation(id, parameter, event.value);
                break;
            case 'instrument':
                this.applyInstrumentAutomation(id, parameter, event.value);
                break;
            case 'effect':
                this.applyEffectAutomation(id, parameter, event.value);
                break;
            default:
                console.warn(`AutomationScheduler: Unknown automation target type: ${type}`);
        }
    }

    /**
     * Apply mixer automation
     */
    applyMixerAutomation(channelId, parameter, value) {
        // ⚠️ REMOVED: mixerChannels - Replaced by MixerInsert system
        const insert = this.audioEngine.mixerInserts?.get(channelId);
        if (!insert) {
            console.warn(`AutomationScheduler: Mixer insert not found: ${channelId}`);
            return;
        }

        switch (parameter) {
            case 'volume':
            case 'gain':
                // ⚠️ REMOVED: mixerChannels - Replaced by MixerInsert system
                insert.setGain(value);
                break;
            case 'pan':
                // ⚠️ REMOVED: mixerChannels - Replaced by MixerInsert system
                insert.setPan(value);
                break;
            case 'mute':
                // ⚠️ REMOVED: mixerChannels - Replaced by MixerInsert system
                insert.setMute(value);
                break;
            case 'solo':
                // ⚠️ REMOVED: mixerChannels - Replaced by MixerInsert system
                insert.setSolo(value, false); // TODO: isAnySoloed parameter
                break;
            default:
                console.warn(`AutomationScheduler: Unknown mixer parameter: ${parameter}`);
        }
    }

    /**
     * Apply instrument automation
     */
    applyInstrumentAutomation(instrumentId, parameter, value) {
        const instrument = this.audioEngine.instruments.get(instrumentId);
        if (!instrument) {
            console.warn(`AutomationScheduler: Instrument not found: ${instrumentId}`);
            return;
        }

        // Check if instrument has updateParams method
        if (typeof instrument.updateParams === 'function') {
            instrument.updateParams({ [parameter]: value });
        } else if (typeof instrument.setParameter === 'function') {
            instrument.setParameter(parameter, value);
        } else {
            console.warn(`AutomationScheduler: Instrument ${instrumentId} doesn't support parameter updates`);
        }
    }

    /**
     * Apply effect automation
     */
    applyEffectAutomation(effectId, parameter, value) {
        const effect = this.audioEngine.effects.get(effectId);
        if (!effect) {
            console.warn(`AutomationScheduler: Effect not found: ${effectId}`);
            return;
        }

        // Check if effect has updateParams method
        if (typeof effect.updateParams === 'function') {
            effect.updateParams({ [parameter]: value });
        } else if (typeof effect.setParameter === 'function') {
            effect.setParameter(parameter, value);
        } else {
            console.warn(`AutomationScheduler: Effect ${effectId} doesn't support parameter updates`);
        }
    }

    /**
     * ✅ PHASE 4: Start real-time automation for instrument
     * Continuously reads automation lane values and applies to instrument
     *
     * @param {string} instrumentId - Instrument ID
     * @param {string} patternId - Pattern ID
     * @param {Array} lanes - Array of AutomationLane instances
     */
    startRealtimeAutomation(instrumentId, patternId, lanes) {
        // Clear existing automation for this instrument
        this.stopRealtimeAutomation(instrumentId);

        // ✅ PERFORMANCE: Filter out lanes without data points
        if (!lanes || lanes.length === 0) {
            return;
        }

        // Filter to only lanes with actual automation data
        const lanesWithData = lanes.filter(lane => {
            const points = lane.getPoints();
            return points && points.length > 0;
        });

        if (lanesWithData.length === 0) {
            // No lanes with data - skip automation entirely
            return;
        }

        // ✅ NEW: Store automation info instead of starting an interval
        this.activeAutomations.set(instrumentId, { patternId, lanes: lanesWithData });

        console.log(`✅ Real-time automation [LOOKAHEAD] started for ${instrumentId}`);
    }

    /**
     * ✅ NEW: Process automation for a specific time and step
     * This is called by onSchedule for every tick.
     */
    processRealtimeAutomation(instrumentId, lanes, currentStep, time) {
        const instrument = this.audioEngine.instruments.get(instrumentId);
        if (!instrument || !this.transport.isPlaying) {
            this.stopRealtimeAutomation(instrumentId);
            return;
        }

        const automationParams = {};
        const defaults = {
            7: 127, 10: 64, 11: 127, 74: 64, 71: 0, 1: 0
        };

        lanes.forEach(lane => {
            const interpolationMethod = lane.interpolation || 'linear';
            const value = lane.getValueAtTime(currentStep, interpolationMethod);
            const effectiveValue = value !== null ? value : defaults[lane.ccNumber];
            if (effectiveValue === undefined) return;

            switch (lane.ccNumber) {
                case 7: // Volume
                    automationParams.volume = effectiveValue / 127;
                    // ✅ DEBUG: Log volume automation only when value changes significantly (reduce spam)
                    // Track last logged value to avoid duplicate logs
                    const lastLoggedValue = this._lastLoggedValues?.get(`${instrumentId}.volume`);
                    const valueChanged = lastLoggedValue === undefined || Math.abs(effectiveValue - lastLoggedValue) >= 1; // Log if changed by 1 or more
                    if (valueChanged) {
                        if (!this._lastLoggedValues) this._lastLoggedValues = new Map();
                        this._lastLoggedValues.set(`${instrumentId}.volume`, effectiveValue);
                        // console.log(`🎚️ Volume automation [${instrumentId}]: step=${currentStep.toFixed(2)}, value=${effectiveValue}, normalized=${automationParams.volume.toFixed(3)}`);
                    }
                    break;
                case 10: automationParams.pan = (effectiveValue - 64) / 64; break;
                case 11: automationParams.expression = effectiveValue / 127; break;
                case 74: automationParams.filterCutoff = effectiveValue; break;
                case 71: automationParams.filterResonance = effectiveValue; break;
                case 1: automationParams.modWheel = effectiveValue; break;
            }
        });

        // Apply automation to instrument with sample-accurate time
        if (Object.keys(automationParams).length > 0 && instrument.applyAutomation) {
            instrument.applyAutomation(automationParams, time);
        }
    }

    /**
     * ✅ PHASE 4: Stop real-time automation for instrument
     *
     * @param {string} instrumentId - Instrument ID
     */
    stopRealtimeAutomation(instrumentId) {
        if (this.activeAutomations.has(instrumentId)) {
            this.activeAutomations.delete(instrumentId);
            console.log(`🛑 Real-time automation stopped for ${instrumentId}`);
            return true;
        }
        return false;
    }

    /**
     * ✅ PHASE 4: Stop all real-time automations
     */
    stopAllRealtimeAutomations() {
        this.activeAutomations.clear();
        console.log(`⏹️ All real-time automations stopped`);
    }

    /**
     * Clear all scheduled automation events
     */
    clear() {
        // Stop all real-time automations
        this.stopAllRealtimeAutomations();

        // Automation events are stored in transport.scheduledEvents
        // They will be cleared when transport clears all events
    }

    /**
     * Get automation statistics
     */
    getStats() {
        // Could track automation events count
        return {
            automationEventsActive: 0, // Placeholder
            realtimeAutomations: this.activeAutomations.size
        };
    }
}
