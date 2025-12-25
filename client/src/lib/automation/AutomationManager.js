/**
 * AutomationManager - Centralized Automation Management
 *
 * Features:
 * - Lane creation & management
 * - Default lane presets
 * - Lane templates
 * - MIDI CC learn
 * - Parameter binding
 *
 * Architecture:
 * - Singleton pattern
 * - Event-driven
 * - Store integration
 */

import { AutomationLane } from '@/features/piano_roll_v7/types/AutomationLane';
import { getMIDIDeviceManager } from '@/lib/midi/MIDIDeviceManager';
import { useArrangementStore } from '@/store/useArrangementStore';

// ═══════════════════════════════════════════════════════════
// LANE PRESETS
// ═══════════════════════════════════════════════════════════

export const LANE_PRESETS = {
    // Essential mixing controls
    VOLUME: { ccNumber: 7, name: 'Volume', color: '#10b981' },
    PAN: { ccNumber: 10, name: 'Pan', color: '#3b82f6' },
    EXPRESSION: { ccNumber: 11, name: 'Expression', color: '#8b5cf6' },

    // Modulation
    MOD_WHEEL: { ccNumber: 1, name: 'Mod Wheel', color: '#f59e0b' },
    PITCH_BEND: { ccNumber: 'pitchBend', name: 'Pitch Bend', color: '#4A90E2' },
    AFTERTOUCH: { ccNumber: 'aftertouch', name: 'Aftertouch', color: '#E24A4A' },

    // Performance controls
    SUSTAIN: { ccNumber: 64, name: 'Sustain Pedal', color: '#ec4899' },
    PORTAMENTO: { ccNumber: 5, name: 'Portamento', color: '#06b6d4' },

    // Effects
    REVERB: { ccNumber: 91, name: 'Reverb', color: '#84cc16' },
    CHORUS: { ccNumber: 93, name: 'Chorus', color: '#a855f7' },
    DELAY: { ccNumber: 94, name: 'Delay', color: '#14b8a6' },

    // Filter
    CUTOFF: { ccNumber: 74, name: 'Filter Cutoff', color: '#f97316' },
    RESONANCE: { ccNumber: 71, name: 'Filter Resonance', color: '#ef4444' },

    // Envelope
    ATTACK: { ccNumber: 73, name: 'Attack Time', color: '#eab308' },
    RELEASE: { ccNumber: 72, name: 'Release Time', color: '#facc15' }
};

// Preset categories
export const LANE_CATEGORIES = {
    MIXING: ['VOLUME', 'PAN', 'EXPRESSION'],
    MODULATION: ['MOD_WHEEL', 'PITCH_BEND', 'AFTERTOUCH'],
    PERFORMANCE: ['SUSTAIN', 'PORTAMENTO'],
    EFFECTS: ['REVERB', 'CHORUS', 'DELAY'],
    FILTER: ['CUTOFF', 'RESONANCE'],
    ENVELOPE: ['ATTACK', 'RELEASE']
};

// ═══════════════════════════════════════════════════════════
// AUTOMATION MANAGER
// ═══════════════════════════════════════════════════════════

export class AutomationManager {
    constructor() {
        this.state = {
            // Active lanes per pattern/instrument
            activeLanes: new Map(), // patternId.instrumentId -> [AutomationLane]

            // MIDI learn state
            isLearning: false,
            learningTarget: null, // { patternId, instrumentId, ccNumber }

            // Listeners
            listeners: new Set()
        };

        // Default lanes (always available)
        this.defaultLanes = [
            LANE_PRESETS.MOD_WHEEL,
            LANE_PRESETS.PITCH_BEND,
            LANE_PRESETS.VOLUME,
            LANE_PRESETS.PAN
        ];

        // Setup MIDI device listener for MIDI learn
        this.setupMIDIListener();
    }

    /**
     * Setup MIDI device listener
     */
    setupMIDIListener() {
        const midiManager = getMIDIDeviceManager();

        // Subscribe to all MIDI events
        midiManager.subscribe((event) => {
            // Only handle Control Change messages during MIDI learn
            if (this.state.isLearning && event.type === 'controlChange') {
                this.handleMIDILearn(event.controller, event.value);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // LANE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    /**
     * Get or create lane key
     */
    getLaneKey(patternId, instrumentId) {
        return `${patternId}.${instrumentId}`;
    }

    /**
     * Initialize lanes for pattern/instrument
     */
    initializeLanes(patternId, instrumentId, existingLanes = null) {
        const key = this.getLaneKey(patternId, instrumentId);

        if (existingLanes) {
            // Restore from saved data
            const lanes = existingLanes.map(laneData => {
                if (laneData instanceof AutomationLane) {
                    return laneData;
                }
                return AutomationLane.fromJSON(laneData);
            });
            this.state.activeLanes.set(key, lanes);
            return lanes;
        }

        // Create default lanes
        const lanes = this.defaultLanes.map(preset =>
            new AutomationLane(preset.ccNumber, preset.name)
        );

        this.state.activeLanes.set(key, lanes);
        this.notifyListeners({ type: 'lanesInitialized', key, lanes });

        return lanes;
    }

    /**
     * Get active lanes for pattern/instrument
     */
    getLanes(patternId, instrumentId) {
        const key = this.getLaneKey(patternId, instrumentId);
        return this.state.activeLanes.get(key) || [];
    }

    /**
     * Set lanes for pattern/instrument (used for sync from Piano Roll)
     */
    setLanes(patternId, instrumentId, lanes) {
        const key = this.getLaneKey(patternId, instrumentId);
        this.state.activeLanes.set(key, lanes);

        // ✅ CRITICAL: Also update pattern store for PlaybackManager
        // PlaybackManager reads from pattern.ccLanes during playback
        // ✅ FIX: Use queueMicrotask to avoid React render-phase state updates
        const ccLanesData = lanes.map(lane => lane.toJSON ? lane.toJSON() : lane);
        queueMicrotask(() => {
            useArrangementStore.getState().updatePatternCCLanes(patternId, ccLanesData);
        });

        this.notifyListeners({ type: 'lanesSet', key, lanes, patternId, instrumentId });
    }

    /**
     * Add lane from preset
     */
    addLaneFromPreset(patternId, instrumentId, presetKey) {
        const preset = LANE_PRESETS[presetKey];
        if (!preset) {
            console.warn('Unknown preset:', presetKey);
            return null;
        }

        return this.addLane(patternId, instrumentId, preset.ccNumber, preset.name);
    }

    /**
     * Add custom lane
     */
    addLane(patternId, instrumentId, ccNumber, name = null) {
        const key = this.getLaneKey(patternId, instrumentId);
        const lanes = this.getLanes(patternId, instrumentId);

        // Check if lane already exists
        const existing = lanes.find(lane => lane.ccNumber === ccNumber);
        if (existing) {
            console.warn('Lane already exists:', ccNumber);
            return existing;
        }

        // Create new lane
        const newLane = new AutomationLane(ccNumber, name);
        lanes.push(newLane);

        this.state.activeLanes.set(key, lanes);
        this.notifyListeners({ type: 'laneAdded', key, lane: newLane });

        console.log(`✅ Added lane: ${newLane.name} (${ccNumber})`);
        return newLane;
    }

    /**
     * Remove lane
     */
    removeLane(patternId, instrumentId, ccNumber) {
        const key = this.getLaneKey(patternId, instrumentId);
        const lanes = this.getLanes(patternId, instrumentId);

        const index = lanes.findIndex(lane => lane.ccNumber === ccNumber);
        if (index === -1) {
            console.warn('Lane not found:', ccNumber);
            return false;
        }

        const removed = lanes.splice(index, 1)[0];
        this.state.activeLanes.set(key, lanes);
        this.notifyListeners({ type: 'laneRemoved', key, lane: removed });

        console.log(`🗑 Removed lane: ${removed.name}`);
        return true;
    }

    /**
     * Toggle lane visibility
     */
    toggleLaneVisibility(patternId, instrumentId, ccNumber) {
        const lanes = this.getLanes(patternId, instrumentId);
        const lane = lanes.find(l => l.ccNumber === ccNumber);

        if (!lane) {
            console.warn('Lane not found:', ccNumber);
            return false;
        }

        lane.visible = !lane.visible;
        this.notifyListeners({ type: 'laneVisibilityChanged', lane });

        return lane.visible;
    }

    /**
     * Get available presets (not already added)
     */
    getAvailablePresets(patternId, instrumentId) {
        const lanes = this.getLanes(patternId, instrumentId);
        const existingCC = new Set(lanes.map(l => l.ccNumber));

        return Object.entries(LANE_PRESETS)
            .filter(([key, preset]) => !existingCC.has(preset.ccNumber))
            .map(([key, preset]) => ({ key, ...preset }));
    }

    // ═══════════════════════════════════════════════════════════
    // MIDI LEARN
    // ═══════════════════════════════════════════════════════════

    /**
     * Start MIDI learn mode
     */
    startMIDILearn(patternId, instrumentId) {
        this.state.isLearning = true;
        this.state.learningTarget = { patternId, instrumentId };

        console.log('🎹 MIDI Learn: Move a controller...');
        this.notifyListeners({ type: 'learnStarted' });
    }

    /**
     * Handle MIDI CC message during learn
     */
    handleMIDILearn(ccNumber, value) {
        if (!this.state.isLearning) return false;

        const { patternId, instrumentId } = this.state.learningTarget;

        // Add lane for this CC
        this.addLane(patternId, instrumentId, ccNumber);

        // Stop learning
        this.stopMIDILearn();

        console.log(`✅ Learned: CC${ccNumber}`);
        return true;
    }

    /**
     * Stop MIDI learn mode
     */
    stopMIDILearn() {
        this.state.isLearning = false;
        this.state.learningTarget = null;

        this.notifyListeners({ type: 'learnStopped' });
    }

    // ═══════════════════════════════════════════════════════════
    // LANE TEMPLATES
    // ═══════════════════════════════════════════════════════════

    /**
     * Get template by category
     */
    getTemplate(categoryKey) {
        const presetKeys = LANE_CATEGORIES[categoryKey];
        if (!presetKeys) return [];

        return presetKeys.map(key => LANE_PRESETS[key]);
    }

    /**
     * Apply template to pattern/instrument
     */
    applyTemplate(patternId, instrumentId, categoryKey) {
        const template = this.getTemplate(categoryKey);
        const added = [];

        for (const preset of template) {
            const lane = this.addLane(patternId, instrumentId, preset.ccNumber, preset.name);
            if (lane) added.push(lane);
        }

        console.log(`📋 Applied template: ${categoryKey} (${added.length} lanes)`);
        return added;
    }

    // ═══════════════════════════════════════════════════════════
    // SERIALIZATION
    // ═══════════════════════════════════════════════════════════

    /**
     * Serialize lanes for storage
     */
    serializeLanes(patternId, instrumentId) {
        const lanes = this.getLanes(patternId, instrumentId);
        return lanes.map(lane => lane.toJSON());
    }

    /**
     * Deserialize lanes from storage
     */
    deserializeLanes(patternId, instrumentId, lanesData) {
        return this.initializeLanes(patternId, instrumentId, lanesData);
    }

    // ═══════════════════════════════════════════════════════════
    // EVENT SYSTEM
    // ═══════════════════════════════════════════════════════════

    /**
     * Subscribe to automation events
     */
    subscribe(listener) {
        this.state.listeners.add(listener);
        return () => this.state.listeners.delete(listener);
    }

    /**
     * Notify listeners
     * ✅ Use queueMicrotask to avoid React render-phase state updates
     */
    notifyListeners(event) {
        queueMicrotask(() => {
            this.state.listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (error) {
                    console.error('AutomationManager listener error:', error);
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════

    /**
     * Get preset by CC number
     */
    getPresetByCC(ccNumber) {
        return Object.values(LANE_PRESETS).find(p => p.ccNumber === ccNumber);
    }

    /**
     * Get all presets
     */
    getAllPresets() {
        return Object.entries(LANE_PRESETS).map(([key, preset]) => ({
            key,
            ...preset
        }));
    }

    /**
     * Get categories
     */
    getCategories() {
        return Object.keys(LANE_CATEGORIES);
    }

    /**
     * Clear all lanes
     */
    clearLanes(patternId, instrumentId) {
        const key = this.getLaneKey(patternId, instrumentId);
        this.state.activeLanes.delete(key);
        this.notifyListeners({ type: 'lanesCleared', key });
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            totalPatterns: this.state.activeLanes.size,
            totalLanes: Array.from(this.state.activeLanes.values())
                .reduce((sum, lanes) => sum + lanes.length, 0),
            isLearning: this.state.isLearning
        };
    }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════

let instance = null;

export function getAutomationManager() {
    if (!instance) {
        instance = new AutomationManager();
    }
    return instance;
}

export default getAutomationManager;
