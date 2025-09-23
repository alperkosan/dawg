// lib/interfaces/TimelineSelectionAPI.js
// DAWG - Timeline Selection Interface for Manual Loop Control

export class TimelineSelectionAPI {
  constructor(audioEngine, eventBus) {
    this.engine = audioEngine;
    this.eventBus = eventBus;
    
    // Selection state
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isSelecting = false;
    this.scrubbing = false;
    
    // Timeline properties
    this.pixelsPerStep = 8; // Default grid resolution
    this.snapToGrid = true;
    this.snapValue = 1; // Snap to steps by default
    
    console.log('Timeline Selection API initialized');
  }

  // =================== SELECTION MANAGEMENT ===================

  /**
   * Start a new selection at given step
   * @param {number} step - Starting step position
   */
  startSelection(step) {
    const snappedStep = this.snapToGrid ? this.snapToStep(step) : step;
    
    this.selectionStart = snappedStep;
    this.selectionEnd = snappedStep;
    this.isSelecting = true;
    
    this.eventBus.emit('selectionStart', {
      start: this.selectionStart,
      step: snappedStep
    });
    
    console.log(`Timeline selection started at step ${snappedStep}`);
    return snappedStep;
  }

  /**
   * Update selection end point while dragging
   * @param {number} step - Current drag position
   */
  updateSelection(step) {
    if (!this.isSelecting) return null;
    
    const snappedStep = this.snapToGrid ? this.snapToStep(step) : step;
    this.selectionEnd = Math.max(this.selectionStart, snappedStep);
    
    const selectionData = {
      start: Math.min(this.selectionStart, this.selectionEnd),
      end: Math.max(this.selectionStart, this.selectionEnd),
      length: Math.abs(this.selectionEnd - this.selectionStart)
    };
    
    this.eventBus.emit('selectionUpdate', selectionData);
    
    return selectionData;
  }

  /**
   * Finish selection and optionally apply as loop
   * @param {boolean} setAsLoop - Whether to set selection as loop points
   */
  endSelection(setAsLoop = false) {
    if (!this.isSelecting) return null;
    
    this.isSelecting = false;
    
    const finalSelection = {
      start: Math.min(this.selectionStart, this.selectionEnd),
      end: Math.max(this.selectionStart, this.selectionEnd),
      length: Math.abs(this.selectionEnd - this.selectionStart)
    };
    
    if (setAsLoop && finalSelection.length > 0) {
      this.setLoopFromSelection();
    }
    
    this.eventBus.emit('selectionEnd', finalSelection);
    
    console.log(`Timeline selection ended: ${finalSelection.start} -> ${finalSelection.end} steps`);
    return finalSelection;
  }

  /**
   * Clear current selection
   */
  clearSelection() {
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isSelecting = false;
    
    this.eventBus.emit('selectionClear');
    console.log('Timeline selection cleared');
  }

  // =================== LOOP MANAGEMENT ===================

  /**
   * Set loop points from current selection
   */
  setLoopFromSelection() {
    if (!this.hasSelection()) {
      console.warn('No selection to set as loop');
      return false;
    }
    
    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);
    
    // Update engine loop points
    if (this.engine.playbackManager) {
      this.engine.playbackManager.setLoopPoints(start, end);
      this.engine.playbackManager.setLoopEnabled(true);
      
      console.log(`Loop set from selection: ${start} -> ${end} steps`);
      
      this.eventBus.emit('loopSetFromSelection', {
        start,
        end,
        length: end - start
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Get current loop points from engine
   */
  getCurrentLoop() {
    if (this.engine.playbackManager) {
      return this.engine.playbackManager.getLoopInfo();
    }
    return null;
  }

  /**
   * Select current loop range
   */
  selectCurrentLoop() {
    const loop = this.getCurrentLoop();
    if (loop) {
      this.selectionStart = loop.start;
      this.selectionEnd = loop.end;
      
      this.eventBus.emit('selectionSet', {
        start: loop.start,
        end: loop.end,
        length: loop.length
      });
      
      console.log(`Selection set to current loop: ${loop.start} -> ${loop.end}`);
      return true;
    }
    return false;
  }

  // =================== TIMELINE SCRUBBING ===================

  /**
   * Start timeline scrubbing (drag playhead)
   * @param {number} step - Initial scrub position
   */
  startScrub(step) {
    const snappedStep = this.snapToGrid ? this.snapToStep(step) : step;
    this.scrubbing = true;
    
    // Pause playback during scrub
    const wasPlaying = this.engine.playbackManager?.isPlaying;
    if (wasPlaying) {
      this.engine.pause();
    }
    
    // Jump to scrub position
    this.engine.playbackManager?.jumpToStep(snappedStep);
    
    this.eventBus.emit('scrubStart', {
      step: snappedStep,
      wasPlaying
    });
    
    console.log(`Timeline scrub started at step ${snappedStep}`);
    return snappedStep;
  }

  /**
   * Update scrub position
   * @param {number} step - New scrub position
   */
  updateScrub(step) {
    if (!this.scrubbing) return null;
    
    const snappedStep = this.snapToGrid ? this.snapToStep(step) : step;
    
    // Update playhead position
    this.engine.playbackManager?.jumpToStep(snappedStep);
    
    this.eventBus.emit('scrubUpdate', {
      step: snappedStep
    });
    
    return snappedStep;
  }

  /**
   * End scrubbing
   * @param {boolean} resumePlayback - Whether to resume playback if it was playing
   */
  endScrub(resumePlayback = false) {
    if (!this.scrubbing) return;
    
    this.scrubbing = false;
    
    // Resume playback if it was playing before scrub
    if (resumePlayback && this.engine.playbackManager) {
      this.engine.resume();
    }
    
    this.eventBus.emit('scrubEnd', {
      resumedPlayback: resumePlayback
    });
    
    console.log('Timeline scrub ended');
  }

  // =================== NAVIGATION HELPERS ===================

  /**
   * Jump to specific step
   * @param {number} step - Target step
   */
  jumpToStep(step) {
    const snappedStep = this.snapToGrid ? this.snapToStep(step) : step;
    
    if (this.engine.playbackManager) {
      this.engine.playbackManager.jumpToStep(snappedStep);
      
      this.eventBus.emit('jumpToStep', {
        step: snappedStep
      });
      
      console.log(`Jumped to step ${snappedStep}`);
      return snappedStep;
    }
    
    return null;
  }

  /**
   * Jump to specific bar
   * @param {number} bar - Target bar (1-based)
   */
  jumpToBar(bar) {
    const stepsPerBar = 16; // 4/4 time, 16 steps per bar
    const step = (bar - 1) * stepsPerBar;
    return this.jumpToStep(step);
  }

  /**
   * Jump to percentage of pattern/song
   * @param {number} percent - Percentage (0-100)
   */
  jumpToPercent(percent) {
    const loop = this.getCurrentLoop();
    if (loop) {
      const step = Math.floor((loop.end * percent) / 100);
      return this.jumpToStep(step);
    }
    return null;
  }

  // =================== GRID SNAPPING ===================

  /**
   * Snap value to grid
   * @param {number} step - Raw step value
   * @returns {number} - Snapped step value
   */
  snapToStep(step) {
    return Math.round(step / this.snapValue) * this.snapValue;
  }

  /**
   * Set grid snap settings
   * @param {boolean} enabled - Enable grid snapping
   * @param {number} snapValue - Grid snap value (steps)
   */
  setGridSnap(enabled, snapValue = 1) {
    this.snapToGrid = enabled;
    this.snapValue = Math.max(0.25, snapValue); // Minimum 1/4 step
    
    console.log(`Grid snap: ${enabled ? 'enabled' : 'disabled'}, value: ${this.snapValue}`);
  }

  /**
   * Set timeline zoom level
   * @param {number} pixelsPerStep - Pixels per step for zoom calculation
   */
  setZoom(pixelsPerStep) {
    this.pixelsPerStep = Math.max(1, pixelsPerStep);
    
    // Adjust snap sensitivity based on zoom
    if (this.pixelsPerStep < 4) {
      this.snapValue = 4; // Snap to every 4 steps when zoomed out
    } else if (this.pixelsPerStep > 16) {
      this.snapValue = 0.25; // Snap to 1/4 steps when zoomed in
    } else {
      this.snapValue = 1; // Default step snapping
    }
    
    this.eventBus.emit('zoomChange', {
      pixelsPerStep: this.pixelsPerStep,
      snapValue: this.snapValue
    });
  }

  // =================== UTILITY METHODS ===================

  /**
   * Check if there's an active selection
   * @returns {boolean}
   */
  hasSelection() {
    return this.selectionStart !== null && this.selectionEnd !== null;
  }

  /**
   * Get current selection info
   * @returns {Object|null}
   */
  getSelection() {
    if (!this.hasSelection()) return null;
    
    return {
      start: Math.min(this.selectionStart, this.selectionEnd),
      end: Math.max(this.selectionStart, this.selectionEnd),
      length: Math.abs(this.selectionEnd - this.selectionStart),
      isSelecting: this.isSelecting
    };
  }

  /**
   * Get timeline state for UI
   * @returns {Object}
   */
  getTimelineState() {
    const loop = this.getCurrentLoop();
    const selection = this.getSelection();
    const position = this.engine.playbackManager?.getCurrentPosition() || 0;
    
    return {
      currentPosition: position,
      loop: loop,
      selection: selection,
      scrubbing: this.scrubbing,
      snapToGrid: this.snapToGrid,
      snapValue: this.snapValue,
      zoom: this.pixelsPerStep
    };
  }

  /**
   * Convert pixel position to step (for mouse interactions)
   * @param {number} pixelX - Pixel position
   * @param {number} timelineWidth - Total timeline width
   * @param {number} totalSteps - Total pattern/song length in steps
   */
  pixelToStep(pixelX, timelineWidth, totalSteps) {
    const percent = Math.max(0, Math.min(1, pixelX / timelineWidth));
    return Math.floor(percent * totalSteps);
  }

  /**
   * Convert step to pixel position (for rendering)
   * @param {number} step - Step position
   * @param {number} timelineWidth - Total timeline width
   * @param {number} totalSteps - Total pattern/song length in steps
   */
  stepToPixel(step, timelineWidth, totalSteps) {
    const percent = step / totalSteps;
    return percent * timelineWidth;
  }

  // =================== EVENT SUBSCRIPTIONS ===================

  /**
   * Subscribe to timeline events
   * @param {string} event - Event name
   * @param {function} callback - Event callback
   */
  on(event, callback) {
    this.eventBus.on(event, callback);
  }

  /**
   * Unsubscribe from timeline events
   * @param {string} event - Event name
   * @param {function} callback - Event callback
   */
  off(event, callback) {
    this.eventBus.off(event, callback);
  }

  // =================== CLEANUP ===================

  /**
   * Dispose timeline API and clean up
   */
  dispose() {
    this.clearSelection();
    this.scrubbing = false;
    this.eventBus.removeAllListeners();
    
    console.log('Timeline Selection API disposed');
  }
}

// Export for AudioContextService integration
export default TimelineSelectionAPI;