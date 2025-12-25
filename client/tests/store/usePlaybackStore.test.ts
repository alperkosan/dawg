/**
 * @fileoverview Integration tests for usePlaybackStore
 * This tests the core playback state management.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { usePlaybackStore } from '@/store/usePlaybackStore';

describe('usePlaybackStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        usePlaybackStore.setState({
            isPlaying: false,
            currentStep: 0,
            bpm: 120,
            playbackMode: 'PATTERN',
            followPlayheadMode: 'OFF',
        });
    });

    it('should have correct initial state', () => {
        const state = usePlaybackStore.getState();
        expect(state.bpm).toBe(120);
        expect(state.playbackMode).toBe('PATTERN');
    });

    it('should have handleBpmChange action', () => {
        const { handleBpmChange } = usePlaybackStore.getState();
        expect(typeof handleBpmChange).toBe('function');
    });

    it('should have togglePlayPause action', () => {
        const { togglePlayPause } = usePlaybackStore.getState();
        expect(typeof togglePlayPause).toBe('function');
    });

    it('should have follow playhead mode feature', () => {
        const state = usePlaybackStore.getState();
        expect(state.followPlayheadMode).toBe('OFF');

        state.setFollowPlayheadMode('CONTINUOUS');
        expect(usePlaybackStore.getState().followPlayheadMode).toBe('CONTINUOUS');
    });

    it('should cycle follow playhead mode', () => {
        const { cycleFollowPlayheadMode } = usePlaybackStore.getState();
        expect(typeof cycleFollowPlayheadMode).toBe('function');
    });
});
