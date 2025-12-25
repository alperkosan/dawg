/**
 * @fileoverview Integration tests for useMixerStore
 * Tests the mixer channel management.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useMixerStore } from '@/store/useMixerStore';

describe('useMixerStore', () => {
    it('should have mixer state', () => {
        const state = useMixerStore.getState();
        expect(state).toBeDefined();
    });

    it('should have mixer parameter change function', () => {
        const state = useMixerStore.getState();
        expect(typeof state.handleMixerParamChange).toBe('function');
    });

    it('should have mute/solo/mono toggle functions', () => {
        const state = useMixerStore.getState();
        expect(typeof state.toggleMute).toBe('function');
        expect(typeof state.toggleSolo).toBe('function');
        expect(typeof state.toggleMono).toBe('function');
    });

    it('should have track management functions', () => {
        const state = useMixerStore.getState();
        expect(typeof state.addTrack).toBe('function');
        expect(typeof state.removeTrack).toBe('function');
        expect(typeof state.setTrackName).toBe('function');
        expect(typeof state.setTrackColor).toBe('function');
    });

    it('should have effect management functions', () => {
        const state = useMixerStore.getState();
        expect(typeof state.handleMixerEffectAdd).toBe('function');
        expect(typeof state.handleMixerEffectRemove).toBe('function');
        expect(typeof state.handleMixerEffectChange).toBe('function');
        expect(typeof state.handleMixerEffectToggle).toBe('function');
        expect(typeof state.reorderEffect).toBe('function');
    });

    it('should have send/routing functions', () => {
        const state = useMixerStore.getState();
        expect(typeof state.addSend).toBe('function');
        expect(typeof state.removeSend).toBe('function');
        expect(typeof state.updateSendLevel).toBe('function');
        expect(typeof state.routeToTrack).toBe('function');
    });

    it('should have level meter functions', () => {
        const state = useMixerStore.getState();
        expect(typeof state.updateLevelMeterData).toBe('function');
        expect(typeof state.batchUpdateLevels).toBe('function');
        expect(typeof state.resetLevelMeters).toBe('function');
    });
});
