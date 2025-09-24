// src/features/piano_roll_v2/components/PlayheadOptimized.jsx
// Optimized Playhead Component - Uses PositionTracker and PlayheadRenderer

import React, { useRef, useEffect } from 'react';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { PlayheadRenderer } from '../../../lib/core/PlayheadRenderer.js';
import { AudioContextService } from '../../../lib/services/AudioContextService';

export const PlayheadOptimized = React.memo(({ engine }) => {
  const playheadRef = useRef(null);
  const rendererRef = useRef(null);

  const { playbackState } = usePlaybackStore();

  // Initialize renderer
  useEffect(() => {
    if (!playheadRef.current || !engine.stepWidth) return;

    rendererRef.current = new PlayheadRenderer(
      playheadRef.current,
      engine.stepWidth
    );

    console.log('🎯 PlayheadOptimized: Renderer initialized');

    // Cleanup
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [engine.stepWidth]);

  // Handle playback state changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    switch (playbackState) {
      case 'playing':
        // Start animation loop with position callback
        renderer.startAnimation(() => {
          const audioEngine = AudioContextService.getAudioEngine();
          const playbackManager = audioEngine?.playbackManager;

          if (playbackManager?.positionTracker) {
            const position = playbackManager.positionTracker.getCurrentPosition();
            return position.stepFloat;
          }

          return 0;
        });
        break;

      case 'stopped':
        renderer.stopAnimation();
        renderer.reset();
        console.log('🎯 PlayheadOptimized: Reset to position 0');
        break;

      case 'paused':
        renderer.stopAnimation();
        // Keep current position - don't reset
        break;
    }

    console.log(`🎯 PlayheadOptimized: State changed to ${playbackState}`);
  }, [playbackState]);

  // Handle step width changes
  useEffect(() => {
    if (rendererRef.current && engine.stepWidth) {
      rendererRef.current.updateStepWidth(engine.stepWidth);
    }
  }, [engine.stepWidth]);

  return (
    <div
      ref={playheadRef}
      className="prv2-playhead-optimized"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '2px',
        height: engine.gridHeight || '100%',
        backgroundColor: '#ff0000',
        zIndex: 100,
        pointerEvents: 'none',
        // Optimize for performance
        willChange: 'transform',
        backfaceVisibility: 'hidden'
      }}
    />
  );
});

PlayheadOptimized.displayName = 'PlayheadOptimized';