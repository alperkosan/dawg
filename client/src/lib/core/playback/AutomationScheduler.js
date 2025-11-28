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

export class AutomationScheduler {
    constructor(transport, audioEngine) {
        this.transport = transport;
        this.audioEngine = audioEngine;

        // ✅ PHASE 4: Real-time automation tracking
        this.activeAutomations = new Map(); // instrumentId -> automation update interval
        // ✅ FAZ 1: Optimized automation interval for smoother automation
        this.automationUpdateInterval = 10; // Update every 10ms (100Hz) - reduced from 50ms (20Hz)
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
            const eventTime = this.transport.stepsToSeconds(event.time || 0);

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
        const channel = this.audioEngine.mixerChannels.get(channelId);
        if (!channel) {
            console.warn(`AutomationScheduler: Mixer channel not found: ${channelId}`);
            return;
        }

        switch (parameter) {
            case 'volume':
            case 'gain':
                if (channel.gainNode) {
                    channel.gainNode.gain.setValueAtTime(
                        value,
                        this.transport.audioContext.currentTime
                    );
                }
                break;
            case 'pan':
                if (channel.panNode) {
                    channel.panNode.pan.setValueAtTime(
                        value,
                        this.transport.audioContext.currentTime
                    );
                }
                break;
            case 'mute':
                if (channel.setMute) {
                    channel.setMute(value);
                }
                break;
            case 'solo':
                if (channel.setSolo) {
                    channel.setSolo(value);
                }
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

        if (!lanes || lanes.length === 0) return;

        // Start update loop
        const updateAutomation = () => {
            const currentStep = this.transport.getCurrentStep();
            const instrument = this.audioEngine.instruments.get(instrumentId);

            if (!instrument || !this.transport.isPlaying) {
                this.stopRealtimeAutomation(instrumentId);
                return;
            }

            // Build automation params from all lanes
            const automationParams = {};

            // ✅ Default values for when automation ends
            const defaults = {
                7: 100,   // Volume - default to full (127 max, use 100 for ~80%)
                10: 64,   // Pan - default to center
                11: 127,  // Expression - default to full
                74: 64,   // Filter Cutoff - default to middle
                71: 0,    // Filter Resonance - default to none
                1: 0      // Mod Wheel - default to none
            };

            lanes.forEach(lane => {
                const value = lane.getValueAtTime(currentStep, 'linear');

                // Use default if automation has ended (value is null)
                const effectiveValue = value !== null ? value : defaults[lane.ccNumber];
                if (effectiveValue === undefined) return;

                // Map CC numbers to parameters
                switch (lane.ccNumber) {
                    case 7: // Volume
                        automationParams.volume = effectiveValue / 127;
                        break;
                    case 10: // Pan
                        automationParams.pan = (effectiveValue - 64) / 64;
                        break;
                    case 11: // Expression
                        automationParams.expression = effectiveValue / 127;
                        break;
                    case 74: // Filter Cutoff
                        automationParams.filterCutoff = effectiveValue;
                        break;
                    case 71: // Filter Resonance
                        automationParams.filterResonance = effectiveValue;
                        break;
                    case 1: // Mod Wheel
                        automationParams.modWheel = effectiveValue;
                        break;
                }
            });

            // Apply automation to instrument
            if (Object.keys(automationParams).length > 0 && instrument.applyAutomation) {
                instrument.applyAutomation(automationParams, this.transport.audioContext.currentTime);
            }
        };

        // Start interval
        const intervalId = setInterval(updateAutomation, this.automationUpdateInterval);
        this.activeAutomations.set(instrumentId, intervalId);

        console.log(`✅ Real-time automation started for ${instrumentId}`);
    }

    /**
     * ✅ PHASE 4: Stop real-time automation for instrument
     *
     * @param {string} instrumentId - Instrument ID
     */
    stopRealtimeAutomation(instrumentId) {
        const intervalId = this.activeAutomations.get(instrumentId);
        if (intervalId) {
            clearInterval(intervalId);
            this.activeAutomations.delete(instrumentId);
            console.log(`⏹️ Real-time automation stopped for ${instrumentId}`);
        }
    }

    /**
     * ✅ PHASE 4: Stop all real-time automations
     */
    stopAllRealtimeAutomations() {
        this.activeAutomations.forEach((intervalId, instrumentId) => {
            clearInterval(intervalId);
        });
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
