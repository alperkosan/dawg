/**
 * @fileoverview Integration tests for useArrangementStore
 * Tests the core arrangement state management.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useArrangementStore } from '@/store/useArrangementStore';

describe('useArrangementStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        useArrangementStore.setState({
            patterns: {},
            patternOrder: [],
            activePatternId: null,
            nextPatternNumber: 1,
        });
    });

    it('should have correct initial state', () => {
        const state = useArrangementStore.getState();
        expect(state.patterns).toEqual({});
        expect(state.patternOrder).toEqual([]);
    });

    it('should create a new pattern', () => {
        const { createPattern } = useArrangementStore.getState();
        const patternId = createPattern('Test Pattern');

        const state = useArrangementStore.getState();
        expect(state.patterns[patternId]).toBeDefined();
        expect(state.patterns[patternId].name).toBe('Test Pattern');
        expect(state.patternOrder).toContain(patternId);
    });

    it('should delete a pattern only if more than one exists', () => {
        const { createPattern, deletePattern } = useArrangementStore.getState();

        // Create two patterns
        const pattern1 = createPattern('Pattern 1');
        const pattern2 = createPattern('Pattern 2');

        // Delete one should work
        const result = useArrangementStore.getState().deletePattern(pattern1);
        expect(result).toBe(true);
        expect(useArrangementStore.getState().patterns[pattern1]).toBeUndefined();

        // Delete the last one should fail
        const result2 = useArrangementStore.getState().deletePattern(pattern2);
        expect(result2).toBe(false);
        expect(useArrangementStore.getState().patterns[pattern2]).toBeDefined();
    });

    it('should rename a pattern', () => {
        const { createPattern, renamePattern } = useArrangementStore.getState();
        const patternId = createPattern('Original Name');

        useArrangementStore.getState().renamePattern(patternId, 'New Name');

        const state = useArrangementStore.getState();
        expect(state.patterns[patternId].name).toBe('New Name');
    });

    it('should set pattern length', () => {
        const { createPattern, setPatternLength } = useArrangementStore.getState();
        const patternId = createPattern('Test');

        useArrangementStore.getState().setPatternLength(patternId, 128);

        const state = useArrangementStore.getState();
        expect(state.patterns[patternId].length).toBe(128);
    });

    it('should have arrangement track actions', () => {
        const state = useArrangementStore.getState();
        expect(typeof state.addArrangementTrack).toBe('function');
        expect(typeof state.removeArrangementTrack).toBe('function');
        expect(typeof state.updateArrangementTrack).toBe('function');
    });
});
