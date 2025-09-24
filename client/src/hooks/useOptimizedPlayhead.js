// hooks/useOptimizedPlayhead.js
// High-Performance Playhead Hook - Uses PositionTracker and PlayheadRenderer

import { useRef, useEffect, useCallback } from 'react';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { PlayheadRenderer } from '../lib/core/PlayheadRenderer.js';
import { AudioContextService } from '../lib/services/AudioContextService';

export const useOptimizedPlayhead = (stepWidth = 16) => {
  const playheadRef = useRef(null);
  const rendererRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const { playbackState } = usePlaybackStore();

  // Initialize renderer when DOM is ready
  useEffect(() => {
    if (!playheadRef.current || !stepWidth) return;

    // Create renderer instance
    rendererRef.current = new PlayheadRenderer(playheadRef.current, stepWidth);

    console.log('🎯 useOptimizedPlayhead: Renderer initialized with stepWidth:', stepWidth);

    // Cleanup
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
        console.log('🎯 useOptimizedPlayhead: Renderer disposed');
      }
    };
  }, [stepWidth]);

  // Get current position from PositionTracker
  const getPositionCallback = useCallback(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    const playbackManager = audioEngine?.playbackManager;

    if (playbackManager?.positionTracker) {
      const position = playbackManager.positionTracker.getCurrentPosition();
      return position.stepFloat || 0;
    }

    return 0;
  }, []);

  // Handle playback state changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    console.log(`🎯 useOptimizedPlayhead: State changed to ${playbackState}`);

    switch (playbackState) {
      case 'playing':
        // Start smooth animation
        renderer.startAnimation(getPositionCallback);
        break;

      case 'stopped':
        // Stop animation and reset to 0
        renderer.stopAnimation();
        renderer.reset();

        // Auto-scroll to start
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
        break;

      case 'paused':
        // Stop animation but keep current position
        renderer.stopAnimation();
        break;
    }
  }, [playbackState, getPositionCallback]);

  // Update step width if changed
  useEffect(() => {
    if (rendererRef.current && stepWidth) {
      rendererRef.current.updateStepWidth(stepWidth);
    }
  }, [stepWidth]);

  // Auto-scroll during playback (optimized)
  useEffect(() => {
    if (playbackState !== 'playing' || !scrollContainerRef.current || !rendererRef.current) {
      return;
    }

    let rafId = null;

    const updateScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const currentStep = getPositionCallback();
      const playheadX = currentStep * stepWidth;
      const containerWidth = container.offsetWidth;
      const scrollLeft = container.scrollLeft;
      const playheadRightEdge = playheadX + stepWidth;

      // Auto-scroll if playhead is out of view
      if (playheadRightEdge > scrollLeft + containerWidth || playheadX < scrollLeft) {
        const targetScrollLeft = playheadX - containerWidth / 2;
        container.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: 'smooth'
        });
      }

      if (playbackState === 'playing') {
        rafId = requestAnimationFrame(updateScroll);
      }
    };

    rafId = requestAnimationFrame(updateScroll);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [playbackState, stepWidth, getPositionCallback]);

  // Manual position jump
  const jumpToPosition = useCallback((step) => {
    if (rendererRef.current) {
      rendererRef.current.setPosition(step);
      console.log(`🎯 useOptimizedPlayhead: Jumped to step ${step}`);
    }

    // Auto-scroll to new position
    if (scrollContainerRef.current) {
      const targetX = step * stepWidth;
      const containerWidth = scrollContainerRef.current.offsetWidth;
      const targetScrollLeft = targetX - containerWidth / 2;

      scrollContainerRef.current.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth'
      });
    }
  }, [stepWidth]);

  return {
    playheadRef,
    scrollContainerRef,
    jumpToPosition
  };
};