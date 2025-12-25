/**
 * Mixer Commands - Commands for mixer operations
 * 
 * These commands wrap mixer mutations for undo/redo support.
 * 
 * @module lib/core/commands/MixerCommands
 */

import { Command } from './CommandManager.js';

/**
 * Command: Change channel volume
 */
export class ChangeVolumeCommand extends Command {
    constructor(store, trackId, newVolume) {
        super('Change Volume');
        this.store = store;
        this.trackId = trackId;
        this.newVolume = newVolume;
        this.oldVolume = null;
    }

    execute() {
        const state = this.store.getState();

        // Store old value
        this.oldVolume = state.tracks?.[this.trackId]?.volume;

        // Apply new value
        if (typeof state.handleMixerParamChange === 'function') {
            state.handleMixerParamChange(this.trackId, 'volume', this.newVolume);
        }

        return true;
    }

    undo() {
        if (this.oldVolume === null) return false;

        const state = this.store.getState();
        if (typeof state.handleMixerParamChange === 'function') {
            state.handleMixerParamChange(this.trackId, 'volume', this.oldVolume);
        }

        return true;
    }

    getDescription() {
        return `Volume: ${this.trackId} ${this.oldVolume?.toFixed(2)} → ${this.newVolume?.toFixed(2)}`;
    }
}

/**
 * Command: Change channel pan
 */
export class ChangePanCommand extends Command {
    constructor(store, trackId, newPan) {
        super('Change Pan');
        this.store = store;
        this.trackId = trackId;
        this.newPan = newPan;
        this.oldPan = null;
    }

    execute() {
        const state = this.store.getState();

        this.oldPan = state.tracks?.[this.trackId]?.pan;

        if (typeof state.handleMixerParamChange === 'function') {
            state.handleMixerParamChange(this.trackId, 'pan', this.newPan);
        }

        return true;
    }

    undo() {
        if (this.oldPan === null) return false;

        const state = this.store.getState();
        if (typeof state.handleMixerParamChange === 'function') {
            state.handleMixerParamChange(this.trackId, 'pan', this.oldPan);
        }

        return true;
    }

    getDescription() {
        return `Pan: ${this.trackId} ${this.oldPan?.toFixed(2)} → ${this.newPan?.toFixed(2)}`;
    }
}

/**
 * Command: Toggle channel mute
 */
export class ToggleMuteCommand extends Command {
    constructor(store, trackId) {
        super('Toggle Mute');
        this.store = store;
        this.trackId = trackId;
        this.wasMuted = null;
    }

    execute() {
        const state = this.store.getState();

        this.wasMuted = state.tracks?.[this.trackId]?.mute;

        if (typeof state.toggleMute === 'function') {
            state.toggleMute(this.trackId);
        }

        return true;
    }

    undo() {
        // Toggle again to revert
        const state = this.store.getState();
        if (typeof state.toggleMute === 'function') {
            state.toggleMute(this.trackId);
        }

        return true;
    }

    getDescription() {
        return `${this.wasMuted ? 'Unmute' : 'Mute'}: ${this.trackId}`;
    }
}

/**
 * Command: Toggle channel solo
 */
export class ToggleSoloCommand extends Command {
    constructor(store, trackId) {
        super('Toggle Solo');
        this.store = store;
        this.trackId = trackId;
        this.wasSoloed = null;
    }

    execute() {
        const state = this.store.getState();

        this.wasSoloed = state.tracks?.[this.trackId]?.solo;

        if (typeof state.toggleSolo === 'function') {
            state.toggleSolo(this.trackId);
        }

        return true;
    }

    undo() {
        const state = this.store.getState();
        if (typeof state.toggleSolo === 'function') {
            state.toggleSolo(this.trackId);
        }

        return true;
    }

    getDescription() {
        return `${this.wasSoloed ? 'Unsolo' : 'Solo'}: ${this.trackId}`;
    }
}

/**
 * Command: Add effect to channel
 */
export class AddEffectCommand extends Command {
    constructor(store, trackId, effectType, settings = {}) {
        super('Add Effect');
        this.store = store;
        this.trackId = trackId;
        this.effectType = effectType;
        this.settings = settings;
        this.addedEffectId = null;
    }

    execute() {
        const state = this.store.getState();

        if (typeof state.handleMixerEffectAdd === 'function') {
            this.addedEffectId = state.handleMixerEffectAdd(this.trackId, this.effectType, this.settings);
        }

        return this.addedEffectId;
    }

    undo() {
        if (!this.addedEffectId) return false;

        const state = this.store.getState();
        if (typeof state.handleMixerEffectRemove === 'function') {
            state.handleMixerEffectRemove(this.trackId, this.addedEffectId);
        }

        return true;
    }

    getDescription() {
        return `Add ${this.effectType} to ${this.trackId}`;
    }
}

/**
 * Command: Remove effect from channel
 */
export class RemoveEffectCommand extends Command {
    constructor(store, trackId, effectId) {
        super('Remove Effect');
        this.store = store;
        this.trackId = trackId;
        this.effectId = effectId;
        this.removedEffect = null;
        this.effectIndex = null;
    }

    execute() {
        const state = this.store.getState();

        // Store effect data for undo
        const track = state.tracks?.[this.trackId];
        if (track?.effects) {
            this.effectIndex = track.effects.findIndex(e => e.id === this.effectId);
            this.removedEffect = track.effects[this.effectIndex];
        }

        if (typeof state.handleMixerEffectRemove === 'function') {
            state.handleMixerEffectRemove(this.trackId, this.effectId);
        }

        return true;
    }

    undo() {
        if (!this.removedEffect) return false;

        const state = this.store.getState();

        // Re-add the effect
        if (typeof state.handleMixerEffectAdd === 'function') {
            state.handleMixerEffectAdd(
                this.trackId,
                this.removedEffect.type,
                this.removedEffect.settings
            );
        }

        return true;
    }

    getDescription() {
        return `Remove ${this.removedEffect?.type || 'effect'} from ${this.trackId}`;
    }
}

/**
 * Command: Change effect parameter
 */
export class ChangeEffectParamCommand extends Command {
    constructor(store, trackId, effectId, param, newValue) {
        super('Change Effect');
        this.store = store;
        this.trackId = trackId;
        this.effectId = effectId;
        this.param = param;
        this.newValue = newValue;
        this.oldValue = null;
    }

    execute() {
        const state = this.store.getState();

        // Find current value
        const track = state.tracks?.[this.trackId];
        const effect = track?.effects?.find(e => e.id === this.effectId);
        this.oldValue = effect?.settings?.[this.param];

        if (typeof state.handleMixerEffectChange === 'function') {
            state.handleMixerEffectChange(this.trackId, this.effectId, this.param, this.newValue);
        }

        return true;
    }

    undo() {
        if (this.oldValue === undefined) return false;

        const state = this.store.getState();
        if (typeof state.handleMixerEffectChange === 'function') {
            state.handleMixerEffectChange(this.trackId, this.effectId, this.param, this.oldValue);
        }

        return true;
    }

    getDescription() {
        return `${this.param}: ${this.oldValue} → ${this.newValue}`;
    }
}

/**
 * Command: Reorder effects
 */
export class ReorderEffectCommand extends Command {
    constructor(store, trackId, sourceIndex, destIndex) {
        super('Reorder Effects');
        this.store = store;
        this.trackId = trackId;
        this.sourceIndex = sourceIndex;
        this.destIndex = destIndex;
    }

    execute() {
        const state = this.store.getState();

        if (typeof state.reorderEffect === 'function') {
            state.reorderEffect(this.trackId, this.sourceIndex, this.destIndex);
        }

        return true;
    }

    undo() {
        // Reverse the reorder
        const state = this.store.getState();
        if (typeof state.reorderEffect === 'function') {
            state.reorderEffect(this.trackId, this.destIndex, this.sourceIndex);
        }

        return true;
    }

    getDescription() {
        return `Reorder effects: ${this.sourceIndex} → ${this.destIndex}`;
    }
}
