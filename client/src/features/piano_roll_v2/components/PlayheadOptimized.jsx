// src/features/piano_roll_v2/components/PlayheadOptimized.jsx
import React, { useRef, useEffect, useCallback } from 'react';
import { useGlobalPlayhead } from '../../../hooks/useGlobalPlayhead';
import { PlayheadRenderer } from '../../../lib/core/PlayheadRenderer.js';
import { trackPlayheadUpdate } from '../../../lib/utils/performanceMonitor';

export const PlayheadOptimized = React.memo(({ engine }) => {
  const playheadRef = useRef(null);
  const rendererRef = useRef(null);
  const { currentStep, playbackState } = useGlobalPlayhead();

  useEffect(() => {
    if (playheadRef.current && engine.stepWidth) {
      rendererRef.current = new PlayheadRenderer(playheadRef.current, engine.stepWidth);
    }
    return () => rendererRef.current?.dispose();
  }, [engine.stepWidth]);

  const getPositionCallback = useCallback(() => {
    trackPlayheadUpdate();
    return currentStep;
  }, [currentStep]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (playbackState === 'playing') renderer.startAnimation(getPositionCallback);
    else renderer.stopAnimation();
    
    if (playbackState === 'stopped') renderer.reset();

  }, [playbackState, getPositionCallback]);

  // Zoom değiştikçe step genişliğini güncelle
  useEffect(() => {
    rendererRef.current?.updateStepWidth(engine.stepWidth);
  }, [engine.stepWidth]);

  return (
    <div
      ref={playheadRef}
      className="prv2-playhead"
      style={{ height: engine.gridHeight || '100%' }}
    />
  );
});