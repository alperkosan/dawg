/**
 * CANVAS INTERACTION CONFIGURATION
 *
 * Centralized configuration for all canvas interaction behaviors
 * Provides consistent, tweakable parameters for optimal UX
 */

export const CanvasInteractionConfig = {
  // =================== ZOOM ===================
  zoom: {
    min: 0.1,              // Minimum zoom level (10%)
    max: 10,               // Maximum zoom level (1000%)
    default: 1,            // Default zoom level (100%)
    wheelSensitivity: 0.001, // Mouse wheel zoom speed
    pinchSensitivity: 0.01,  // Pinch zoom speed
    smoothing: 0.15,       // Zoom animation smoothing (0-1)
    step: 1.2,             // Zoom step multiplier for buttons
  },

  // =================== SNAPPING ===================
  snap: {
    enabled: true,
    gridSizes: {
      '1/1': 4,   // 4 beats (1 bar)
      '1/2': 2,   // 2 beats
      '1/4': 1,   // 1 beat (default)
      '1/8': 0.5, // 1/2 beat
      '1/16': 0.25, // 1/4 beat
      '1/32': 0.125, // 1/8 beat
    },
    default: '1/4',
    threshold: 8, // Pixels threshold for snapping
  },

  // =================== DRAG & DROP ===================
  dragDrop: {
    dragThreshold: 5,        // Minimum pixels to start drag
    scrollEdgeSize: 50,      // Edge zone for auto-scroll (px)
    scrollSpeed: 10,         // Auto-scroll speed (px/frame)
    dropPreviewOpacity: 0.4, // Drop ghost opacity
    dropPreviewPulseSpeed: 1, // Pulse animation speed (seconds)
  },

  // =================== SELECTION ===================
  selection: {
    boxMinSize: 10,          // Minimum selection box size (px)
    clickTolerance: 3,       // Max movement for click vs drag (px)
    multiSelectKey: 'shift', // Key for multi-select (shift/ctrl)
    highlightDuration: 200,  // Selection highlight animation (ms)
  },

  // =================== MOUSE TRACKING ===================
  mouse: {
    trackingThrottle: 16,    // Mouse tracking throttle (ms) ~60fps
    hoverDelay: 100,         // Hover state delay (ms)
    clickTimeout: 300,       // Double-click detection (ms)
    cursorUpdateRate: 60,    // Cursor update frequency (fps)
  },

  // =================== PERFORMANCE (LOD) ===================
  lod: {
    enabled: true,
    levels: {
      // LOD 0: Full detail (zoom > 2x)
      high: {
        minZoom: 2,
        showWaveforms: true,
        showMiniPreviews: true,
        showAllLabels: true,
        gridDensity: 'full',
        animationQuality: 'high',
      },
      // LOD 1: Medium detail (0.5x - 2x)
      medium: {
        minZoom: 0.5,
        showWaveforms: false,
        showMiniPreviews: true,
        showAllLabels: true,
        gridDensity: 'medium',
        animationQuality: 'medium',
      },
      // LOD 2: Low detail (< 0.5x)
      low: {
        minZoom: 0,
        showWaveforms: false,
        showMiniPreviews: false,
        showAllLabels: false,
        gridDensity: 'sparse',
        animationQuality: 'low',
      },
    },
  },

  // =================== CLIP EDITING ===================
  clip: {
    minDuration: 0.25,       // Minimum clip duration (beats)
    resizeHandleWidth: 8,    // Resize handle width (px)
    fadeHandleWidth: 12,     // Fade in/out handle width (px)
    moveThreshold: 3,        // Minimum movement to trigger move (px)
    doubleClickEdit: true,   // Double-click to edit clip
  },

  // =================== PLAYHEAD ===================
  playhead: {
    width: 2,                // Playhead line width (px)
    magneticSnap: true,      // Snap to playhead when close
    snapDistance: 10,        // Snap distance (px)
    followDuringPlayback: true, // Auto-scroll during playback
    smoothFollow: 0.1,       // Playhead follow smoothing (0-1)
  },

  // =================== GRID ===================
  grid: {
    showGrid: true,
    showMinorLines: true,
    showMajorLines: true,
    majorLineInterval: 4,    // Major line every N beats
    fadeGridWhenZoomedOut: true,
    minZoomForGrid: 0.3,     // Hide grid below this zoom
  },

  // =================== ANIMATION ===================
  animation: {
    clipSelect: 150,         // Clip selection animation (ms)
    clipMove: 100,           // Clip move animation (ms)
    zoomTransition: 200,     // Zoom transition (ms)
    scrollSmoothing: 0.2,    // Scroll smoothing (0-1)
    easing: 'ease-out',      // CSS easing function
  },

  // =================== TOUCH SUPPORT ===================
  touch: {
    enabled: true,
    tapTimeout: 200,         // Single tap detection (ms)
    doubleTapTimeout: 300,   // Double tap detection (ms)
    longPressTimeout: 500,   // Long press detection (ms)
    swipeThreshold: 50,      // Minimum swipe distance (px)
    pinchThreshold: 10,      // Minimum pinch distance (px)
  },

  // =================== ACCESSIBILITY ===================
  accessibility: {
    keyboardNavigation: true,
    focusIndicator: true,
    announceChanges: false,  // Screen reader announcements
    highContrast: false,     // High contrast mode
    reducedMotion: false,    // Respect prefers-reduced-motion
  },
};

/**
 * Get current LOD level based on zoom
 */
export const getLODLevel = (zoom) => {
  if (!CanvasInteractionConfig.lod.enabled) {
    return CanvasInteractionConfig.lod.levels.high;
  }

  if (zoom >= CanvasInteractionConfig.lod.levels.high.minZoom) {
    return CanvasInteractionConfig.lod.levels.high;
  } else if (zoom >= CanvasInteractionConfig.lod.levels.medium.minZoom) {
    return CanvasInteractionConfig.lod.levels.medium;
  } else {
    return CanvasInteractionConfig.lod.levels.low;
  }
};

/**
 * Get grid snap value based on configuration
 */
export const getSnapValue = (snapMode) => {
  if (!CanvasInteractionConfig.snap.enabled || snapMode === 'off') {
    return null;
  }

  return CanvasInteractionConfig.snap.gridSizes[snapMode] ||
         CanvasInteractionConfig.snap.gridSizes[CanvasInteractionConfig.snap.default];
};

/**
 * Check if motion should be reduced
 */
export const shouldReduceMotion = () => {
  return CanvasInteractionConfig.accessibility.reducedMotion ||
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export default CanvasInteractionConfig;
