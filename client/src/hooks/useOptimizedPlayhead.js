// hooks/useOptimizedPlayhead.js
// High-Performance Playhead Hook - Uses PositionTracker and PlayheadRenderer

import { useRef, useEffect, useCallback } from 'react';
import { useGlobalPlayhead } from './useGlobalPlayhead';
import { PlayheadRenderer } from '../lib/core/PlayheadRenderer.js';

export const useOptimizedPlayhead = (stepWidth = 16) => {
  const playheadRef = useRef(null);
  const rendererRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const { currentStep, playbackState } = useGlobalPlayhead();


  // Initialize renderer when DOM is ready
  useEffect(() => {
    if (!playheadRef.current || !stepWidth) return;

    // Create renderer instance
    rendererRef.current = new PlayheadRenderer(playheadRef.current, stepWidth);

    // Cleanup
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [stepWidth]);

  // Use currentStep from global playhead - MUCH simpler!
  const getPositionCallback = useCallback(() => {
    const safeStep = isNaN(currentStep) || currentStep === undefined ? 0 : currentStep;
    return safeStep;
  }, [currentStep]);

  // Handle playback state changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    switch (playbackState) {
      case 'playing':
        // Start smooth animation
        renderer.startAnimation(getPositionCallback);
        break;

      case 'stopped':
        // Stop animation but keep current position (don't auto-reset)
        renderer.stopAnimation();

        // Set to current position from unified system
        const currentPosition = getPositionCallback();
        renderer.setPosition(currentPosition);

        console.log('🎯 useOptimizedPlayhead STOPPED: setting position to', currentPosition);

        // Auto-scroll to current position (not always to start)
        if (scrollContainerRef.current && currentPosition !== undefined) {
          const targetX = currentPosition * stepWidth;
          const containerWidth = scrollContainerRef.current.offsetWidth;
          const targetScrollLeft = targetX - containerWidth / 2;

          scrollContainerRef.current.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'smooth'
          });
        }
        break;

      case 'paused':
        // Stop animation but keep current position
        renderer.stopAnimation();
        break;
    }
  }, [playbackState, getPositionCallback, stepWidth]);

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