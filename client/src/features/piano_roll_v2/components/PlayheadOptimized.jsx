// src/features/piano_roll_v2/components/PlayheadOptimized.jsx
// Optimized Playhead Component - Uses PositionTracker and PlayheadRenderer

import React, { useRef, useEffect, useCallback } from 'react';
import { useGlobalPlayhead } from '../../../hooks/useGlobalPlayhead';
import { PlayheadRenderer } from '../../../lib/core/PlayheadRenderer.js';
import { trackPlayheadUpdate } from '../../../lib/utils/performanceMonitor';

export const PlayheadOptimized = React.memo(({ engine }) => {
  const playheadRef = useRef(null);
  const rendererRef = useRef(null);

  const { currentStep, playbackState } = useGlobalPlayhead();

  // Initialize renderer
  useEffect(() => {
    if (!playheadRef.current || !engine.stepWidth) return;

    rendererRef.current = new PlayheadRenderer(
      playheadRef.current,
      engine.stepWidth
    );


    // Cleanup
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [engine.stepWidth]);

  // Position callback using currentStep from useGlobalPlayhead
  const getPositionCallback = useCallback(() => {
    trackPlayheadUpdate(); // Track playhead performance
    return isNaN(currentStep) || currentStep === undefined ? 0 : currentStep;
  }, [currentStep]);

  // Handle playback state changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    switch (playbackState) {
      case 'playing':
        // Start smooth animation using global playhead
        renderer.startAnimation(getPositionCallback);
        break;

      case 'stopped':
        renderer.stopAnimation();
        renderer.reset();
        break;

      case 'paused':
        renderer.stopAnimation();
        // Keep current position - don't reset
        break;
    }

  }, [playbackState, getPositionCallback]);

  // Handle step width changes
  useEffect(() => {
    if (rendererRef.current && engine.stepWidth) {
      rendererRef.current.updateStepWidth(engine.stepWidth);
    }
  }, [engine.stepWidth]);

  return (
    <div
      ref={playheadRef}
      className="prv2-playhead prv2-playhead-optimized"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '2px',
        height: engine.gridHeight || '100%',
        backgroundColor: '#ff0000',
        zIndex: 100,
        pointerEvents: 'none',
        // ULTRA AGGRESSIVE: Composite-only transforms
        contain: 'strict',
        willChange: 'transform',
        transform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden'
      }}
    />
  );
});

PlayheadOptimized.displayName = 'PlayheadOptimized';