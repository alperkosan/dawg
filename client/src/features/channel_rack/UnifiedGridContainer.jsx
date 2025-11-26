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
  patternLength = 256,
  onNoteToggle = null,
  onInstrumentClick = null,
  addButtonHeight = 0, // Height for add button row (default: 0, set by parent)
  isVisible = true,
  onExtendSteps = null,
}) => {
  const containerRef = useRef(null);
  const canvasContainerRef = useRef(null);

  // ⚡ PERFORMANCE: Use refs instead of state for scroll (no re-renders)
  const scrollXRef = useRef(0);
  const scrollYRef = useRef(0);

  // Viewport size still uses state (only changes on resize, not scroll)
  const [viewportWidth, setViewportWidth] = useState(1000);
  const [viewportHeight, setViewportHeight] = useState(600);

  // Calculate total content dimensions
  // ✅ FIX: Include add button height to match instruments list height
  // Grid doesn't render add button, but we need the same total height for scroll sync
  // Add button: 64px height + 4px margin-top = 68px total space
  const totalHeight = instruments.length * ROW_HEIGHT + addButtonHeight;
  const totalWidth = totalSteps * STEP_WIDTH;

  if (import.meta.env.DEV && window.verboseLogging) {
    console.log('📏 UnifiedGridContainer height calculation:', {
      instrumentCount: instruments.length,
      rowHeight: ROW_HEIGHT,
      instrumentsHeight: instruments.length * ROW_HEIGHT,
      addButtonHeight,
      totalHeight
    });
  }

  // Transform pattern data to notesData format
  const notesData = React.useMemo(() => {
    if (!activePattern) return {};
    return activePattern.data || {};
  }, [activePattern]);

  // ⚡ OPTIMIZED: Separate scroll and viewport tracking
  useEffect(() => {
    if (!isVisible) return;

    const scrollContainer = containerRef.current?.parentElement;
    if (!scrollContainer) return;

    // Handle scroll - just update refs (no setState, no re-render)
    const handleScroll = () => {
      scrollXRef.current = scrollContainer.scrollLeft;
      scrollYRef.current = scrollContainer.scrollTop;

      if (typeof onExtendSteps === 'function') {
        const viewportRightStep = (scrollContainer.scrollLeft + scrollContainer.clientWidth) / STEP_WIDTH;
        if (viewportRightStep > totalSteps - 64) {
          onExtendSteps(Math.ceil(viewportRightStep + 128));
        }
      }
    };

    // Handle viewport resize - update state (triggers re-render, but only on resize)
    const updateViewport = () => {
      const vpWidth = scrollContainer.clientWidth;
      const vpHeight = scrollContainer.clientHeight;
      setViewportWidth(vpWidth);
      setViewportHeight(vpHeight);

      if (import.meta.env.DEV && window.verboseLogging) {
        console.log('🔄 Channel Rack viewport resized:', {
          viewport: `${vpWidth}×${vpHeight}`,
          containerSize: `${totalWidth}×${totalHeight}`,
        });
      }
    };

    // Initial setup
    updateViewport();
    handleScroll(); // Initialize scroll refs

    // ✅ ResizeObserver for viewport changes
    const resizeObserver = new ResizeObserver(updateViewport);

    // Listen to scroll (updates refs only)
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    resizeObserver.observe(scrollContainer);

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [totalWidth, totalHeight, isVisible, totalSteps, onExtendSteps]);

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
          patternLength={patternLength}
          onNoteToggle={onNoteToggle}
          onInstrumentClick={onInstrumentClick}
          scrollXRef={scrollXRef}
          scrollYRef={scrollYRef}
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
          isVisible={isVisible}
        />
      </div>
    </div>
  );
});

UnifiedGridContainer.displayName = 'UnifiedGridContainer';

export default UnifiedGridContainer;
