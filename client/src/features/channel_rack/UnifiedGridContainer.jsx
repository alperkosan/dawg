/**
 * 🎨 UNIFIED GRID CONTAINER - Integration wrapper for ChannelRack
 *
 * This component bridges ChannelRack's data/state with UnifiedGridCanvas.
 * It handles:
 * - Viewport size calculation (uses parent scroll from ChannelRack)
 * - Data transformation (instruments + notes)
 * - Event callbacks (note toggle, instrument click)
 *
 * Usage in ChannelRack:
 * ```jsx
 * <UnifiedGridContainer
 *   instruments={visibleInstruments}
 *   activePattern={activePattern}
 *   totalSteps={audioLoopLength}
 *   onNoteToggle={handleNoteToggle}
 * />
 * ```
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import UnifiedGridCanvas from './UnifiedGridCanvas';

const ROW_HEIGHT = 64;
const STEP_WIDTH = 16;

const UnifiedGridContainer = React.memo(({
  instruments = [],
  activePattern = null,
  totalSteps = 256,
  onNoteToggle = null,
  onInstrumentClick = null,
}) => {
  const containerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1000);
  const [viewportHeight, setViewportHeight] = useState(600);

  // Calculate total content dimensions
  const totalHeight = instruments.length * ROW_HEIGHT;
  const totalWidth = totalSteps * STEP_WIDTH;

  // Transform pattern data to notesData format
  const notesData = React.useMemo(() => {
    if (!activePattern) return {};
    return activePattern.data || {};
  }, [activePattern]);

  // Update viewport size and scroll position
  useEffect(() => {
    const updateViewportAndScroll = () => {
      // Parent is the scroll container (channel-rack-layout__grid-scroll-area)
      const scrollContainer = containerRef.current?.parentElement;
      if (!scrollContainer || !canvasContainerRef.current) return;

      // Update viewport dimensions
      const vpWidth = scrollContainer.clientWidth;
      const vpHeight = scrollContainer.clientHeight;
      setViewportWidth(vpWidth);
      setViewportHeight(vpHeight);

      // Update scroll position
      const scrollLeft = scrollContainer.scrollLeft;
      const scrollTop = scrollContainer.scrollTop;
      setScrollX(scrollLeft);
      setScrollY(scrollTop);

      // Canvas container size matches viewport (already set in inline style, but update for resize)
      // Note: Inline style in JSX handles initial size

      // 🐛 DEBUG: Log viewport and scroll info (1% sample)
      if (Math.random() < 0.01) {
        console.log('📊 Unified Canvas Update:', {
          viewport: `${vpWidth}×${vpHeight}`,
          scroll: `X:${scrollLeft} Y:${scrollTop}`,
          containerSize: `${totalWidth}×${totalHeight}`,
        });
      }
    };

    // Initial update
    updateViewportAndScroll();

    // Listen to parent scroll and window resize
    const scrollContainer = containerRef.current?.parentElement;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updateViewportAndScroll, { passive: true });
      window.addEventListener('resize', updateViewportAndScroll, { passive: true });

      return () => {
        scrollContainer.removeEventListener('scroll', updateViewportAndScroll);
        window.removeEventListener('resize', updateViewportAndScroll);
      };
    }
  }, [totalWidth, totalHeight]);

  return (
    <div
      ref={containerRef}
      className="unified-grid-container channel-rack-layout__grid-content"
      style={{
        position: 'relative',
        width: `${totalWidth}px`,
        height: `${totalHeight}px`,
      }}
    >
      {/* Canvas overlay - fixed to viewport, covering visible area */}
      <div
        ref={canvasContainerRef}
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          pointerEvents: 'auto',
          zIndex: 10,
          width: `${viewportWidth}px`,
          height: `${viewportHeight}px`,
        }}
      >
        <UnifiedGridCanvas
          instruments={instruments}
          notesData={notesData}
          totalSteps={totalSteps}
          onNoteToggle={onNoteToggle}
          onInstrumentClick={onInstrumentClick}
          scrollX={scrollX}
          scrollY={scrollY}
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
        />
      </div>
    </div>
  );
});

UnifiedGridContainer.displayName = 'UnifiedGridContainer';

export default UnifiedGridContainer;
