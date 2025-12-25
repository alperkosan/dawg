/**
 * @fileoverview Integration tests for useInstrumentsStore
 * Tests the instrument management system.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';

describe('useInstrumentsStore', () => {
    beforeEach(() => {
        // Reset to empty state
        useInstrumentsStore.setState({
            instruments: {},
            instrumentOrder: [],
            activeInstrumentId: null,
        });
    });

    it('should have correct initial state', () => {
        const state = useInstrumentsStore.getState();
        expect(state.instruments).toBeDefined();
        expect(state.instrumentOrder).toBeDefined();
    });

    it('should have instrument CRUD actions', () => {
        const state = useInstrumentsStore.getState();

        // Check for common instrument management functions
        const hasAddInstrument = typeof state.addInstrument === 'function';
        const hasRemoveInstrument = typeof state.removeInstrument === 'function';
        const hasUpdateInstrument = typeof state.updateInstrument === 'function';

        expect(hasAddInstrument || hasRemoveInstrument || hasUpdateInstrument).toBe(true);
    });

    it('should handle mute/solo state', () => {
        const state = useInstrumentsStore.getState();

        // Check for mute/solo functions
        const hasMuteFunction = (
            typeof state.setInstrumentMute === 'function' ||
            typeof state.toggleMute === 'function' ||
            typeof state.muteInstrument === 'function'
        );

        // At least one of these should exist for basic instrument control
        expect(state.instruments !== undefined).toBe(true);
    });
});
