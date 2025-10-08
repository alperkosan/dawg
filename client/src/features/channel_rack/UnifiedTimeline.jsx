// features/channel_rack/UnifiedTimeline.jsx
/**
 * 🎯 UNIFIED TIMELINE FOR CHANNEL RACK
 *
 * Uses the global TimelineController for consistent behavior
 * Replaces old InteractiveTimeline component
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getTimelineController } from '@/lib/core/TimelineControllerSingleton';

const UnifiedTimeline = React.memo(({
  loopLength,
  currentPosition = 0,
  onPositionChange = null,
}) => {
  const timelineRef = useRef(null);
  const playheadRef = useRef(null);

  const [isRegistered, setIsRegistered] = useState(false);
  const [localGhostPosition, setLocalGhostPosition] = useState(null);

  const STEP_WIDTH = 16;
  const totalBars = Math.ceil(loopLength / 16);

  // ✅ REGISTER TIMELINE with TimelineController
  useEffect(() => {
    if (!timelineRef.current) return;

    try {
      const timelineController = getTimelineController();

      // Stable callback reference with animation control
      const handlePositionChange = (position, ghostPosition) => {
        // ⚡ Get interaction state from TimelineController
        let shouldAnimate = true;
        try {
          const timelineController = getTimelineController();
          const state = timelineController.getState();

          // Disable transition during seek/scrub for instant feedback
          shouldAnimate = !(
            state.interactionMode === 'seek' ||
            state.interactionMode === 'scrub' ||
            state.isScrubbing
          );
        } catch (e) {
          // TimelineController not available, use default
        }

        // ✅ Update ONLY main playhead position (NOT ghost)
        if (playheadRef.current) {
          const pixelX = position * STEP_WIDTH;

          if (shouldAnimate) {
            // ✅ Smooth animation during normal playback
            playheadRef.current.style.transition = 'transform 0.1s linear';
          } else {
            // ⚡ Instant update during seek/scrub
            playheadRef.current.style.transition = 'none';
          }

          playheadRef.current.style.transform = `translateX(${pixelX}px)`;
        }

        // ✅ Ghost playhead is SEPARATE - updated by hover events only
        // Don't update ghost from position changes!

        // Notify parent component
        if (onPositionChange) {
          onPositionChange(position);
        }
      };

      // ✅ Separate callback for ghost position updates
      const handleGhostPositionChange = (ghostPosition) => {
        // ✅ Only update state if value actually changed (prevents unnecessary re-renders)
        setLocalGhostPosition(prev => {
          if (prev === ghostPosition) return prev; // No change, no re-render
          return ghostPosition;
        });
      };

      // ✅ Custom position calculation accounting for scroll
      const calculatePosition = (mouseX, mouseY) => {
        // Get timeline scroll offset
        const scrollLeft = timelineRef.current?.scrollLeft || 0;

        // Account for scroll
        const adjustedX = mouseX + scrollLeft;

        // Convert to step
        const step = Math.floor(adjustedX / STEP_WIDTH);
        return Math.max(0, Math.min(loopLength - 1, step));
      };

      // Register this timeline
      timelineController.registerTimeline('channel-rack-timeline', {
        element: timelineRef.current,
        stepWidth: STEP_WIDTH,
        totalSteps: loopLength,
        onPositionChange: handlePositionChange, // ✅ Main playhead updates
        onGhostPositionChange: handleGhostPositionChange, // ✅ Ghost playhead updates (separate!)
        enableGhostPosition: true,
        enableRangeSelection: false,
        calculatePosition // ✅ Custom calculation with scroll offset
      });

      setIsRegistered(true);
      console.log('✅ Channel Rack timeline registered');

      // Cleanup on unmount ONLY
      return () => {
        timelineController.unregisterTimeline('channel-rack-timeline');
        console.log('🧹 Channel Rack timeline cleanup');
      };
    } catch (error) {
      console.error('Failed to register Channel Rack timeline:', error);
    }
    // ✅ FIX: Empty dependency array - only register once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // ✅ SEPARATE EFFECT: Update loop length if it changes
  useEffect(() => {
    try {
      const timelineController = getTimelineController();
      const timeline = timelineController.timelines.get('channel-rack-timeline');
      if (timeline) {
        timeline.totalSteps = loopLength;
      }
    } catch (error) {
      // Ignore if not initialized yet
    }
  }, [loopLength]);

  // ✅ RENDER MARKERS (bars and beats)
  const renderMarkers = useCallback(() => {
    const markers = [];

    for (let i = 0; i < totalBars; i++) {
      const barX = i * (STEP_WIDTH * 16);

      // Bar marker
      markers.push(
        <div
          key={`bar-${i}`}
          className="timeline__marker timeline__marker--bar"
          style={{ left: `${barX}px` }}
        >
          <span className="timeline__marker-label">{i + 1}</span>
        </div>
      );

      // Beat markers (3 beats per bar, 4th beat is next bar)
      for (let j = 1; j < 4; j++) {
        const beatX = barX + (j * STEP_WIDTH * 4);
        markers.push(
          <div
            key={`beat-${i}-${j}`}
            className="timeline__marker timeline__marker--beat"
            style={{ left: `${beatX}px` }}
          />
        );
      }
    }

    return markers;
  }, [totalBars]);

  // ✅ Calculate position info for tooltip
  const getPositionInfo = useCallback((step) => {
    const bar = Math.floor(step / 16) + 1;
    const beat = Math.floor((step % 16) / 4) + 1;
    const tick = (step % 4) + 1;
    return `${bar}:${beat}:${tick}`;
  }, []);

  return (
    <div className="timeline">
      <div
        ref={timelineRef}
        className="timeline__track"
        style={{
          width: loopLength * STEP_WIDTH,
          height: '100%',
          cursor: 'col-resize', // ✅ Visual feedback: resize cursor
          userSelect: 'none',
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 100,
          background: 'transparent',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}
      >
        {/* Bar and beat markers */}
        {renderMarkers()}

        {/* ✅ Ghost playhead with hover indicator */}
        {localGhostPosition !== null && (
          <>
              {/* Vertical ghost playhead line */}
              <div
                style={{
                  position: 'absolute',
                  left: `${localGhostPosition * STEP_WIDTH}px`,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  backgroundColor: 'rgba(0, 255, 136, 0.5)',
                  boxShadow: '0 0 6px rgba(0, 255, 136, 0.4)',
                  pointerEvents: 'none',
                  zIndex: 98
                }}
              />
              {/* Step highlight background */}
              <div
                style={{
                  position: 'absolute',
                  left: `${localGhostPosition * STEP_WIDTH}px`,
                  top: 0,
                  bottom: 0,
                  width: `${STEP_WIDTH}px`,
                  backgroundColor: 'rgba(0, 255, 136, 0.08)',
                  pointerEvents: 'none',
                  zIndex: 1
                }}
              />
              {/* Position tooltip */}
              <div
                style={{
                  position: 'absolute',
                  left: `${localGhostPosition * STEP_WIDTH}px`,
                  top: '-24px',
                  transform: 'translateX(-50%)',
                  padding: '2px 6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  color: '#00ff88',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  borderRadius: '3px',
                  pointerEvents: 'none',
                  zIndex: 101,
                  whiteSpace: 'nowrap',
                border: '1px solid rgba(0, 255, 136, 0.3)'
              }}
            >
              {getPositionInfo(localGhostPosition)}
            </div>
          </>
        )}

        {/* Ghost playhead (hover indicator) - Rendered via state localGhostPosition above */}

        {/* Main playhead */}
        <div
          ref={playheadRef}
          className="timeline__playhead timeline__playhead--main"
          style={{
            transform: `translateX(${currentPosition * STEP_WIDTH}px)`,
            transition: 'transform 0.1s linear', // ✅ Initial transition (will be controlled by callback)
            pointerEvents: 'none',
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0, // ✅ Important: start from left
            width: '2px',
            backgroundColor: 'var(--zenith-accent-cool)',
            boxShadow: '0 0 8px var(--zenith-accent-cool)',
            zIndex: 99,
            willChange: 'transform' // ✅ Performance hint
          }}
          title={getPositionInfo(currentPosition)}
        >
          {/* Playhead arrow indicator */}
          <div
            style={{
              position: 'absolute',
              top: '-2px',
              left: '-3px',
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '6px solid var(--zenith-accent-cool)',
              filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))'
            }}
          />
        </div>
      </div>

      {/* Status indicator (for debugging) */}
      {!isRegistered && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          background: 'rgba(255,0,0,0.3)',
          padding: '2px 4px',
          fontSize: '10px',
          pointerEvents: 'none'
        }}>
          Timeline not registered
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // ✅ Custom comparison - only re-render if these props actually change
  return (
    prevProps.loopLength === nextProps.loopLength &&
    prevProps.currentPosition === nextProps.currentPosition &&
    prevProps.onPositionChange === nextProps.onPositionChange
  );
});

UnifiedTimeline.displayName = 'UnifiedTimeline';

export default UnifiedTimeline;
