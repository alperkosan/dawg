/**
 * AutomationScheduler - Parameter Automation Scheduling
 *
 * Responsibilities:
 * - Schedule automation events for mixer, instruments, and effects
 * - Apply automation changes at precise timing
 * - Handle pattern and song-level automation
 *
 * Extracted from PlaybackManager for better modularity
 */

export class AutomationScheduler {
    constructor(transport, audioEngine) {
        this.transport = transport;
        this.audioEngine = audioEngine;
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
     * Clear all scheduled automation events
     */
    clear() {
        // Automation events are stored in transport.scheduledEvents
        // They will be cleared when transport clears all events
    }

    /**
     * Get automation statistics
     */
    getStats() {
        // Could track automation events count
        return {
            automationEventsActive: 0 // Placeholder
        };
    }
}
