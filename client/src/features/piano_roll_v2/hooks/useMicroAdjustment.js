// hooks/useMicroAdjustment.js
// Shift+Wheel ile motor hassasiyetinde nota ayarlama sistemi

import { useCallback, useEffect, useRef } from 'react';
import { PrecisionGrid } from '../utils/precisionGrid';

export const useMicroAdjustment = (selectedNotes, onNotesUpdate, precisionGrid) => {
  const isAdjustingRef = useRef(false);
  const lastWheelTimeRef = useRef(0);
  const accumulatedDeltaRef = useRef(0);

  // Micro-adjustment sensitivity settings
  const WHEEL_SENSITIVITY = 0.5; // How much each wheel tick moves
  const ACCUMULATION_THRESHOLD = 10; // Minimum delta before applying changes
  const THROTTLE_TIME = 16; // ~60fps throttling

  /**
   * Handles shift+wheel micro-adjustment
   * @param {WheelEvent} event
   * @returns {boolean} Whether event was handled
   */
  const handleMicroAdjustment = useCallback((event) => {
    // Only handle if shift is pressed and notes are selected
    if (!event.shiftKey || !selectedNotes || selectedNotes.length === 0) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const now = performance.now();

    // Throttle wheel events for performance
    if (now - lastWheelTimeRef.current < THROTTLE_TIME) {
      accumulatedDeltaRef.current += event.deltaY;
      return true;
    }

    const totalDelta = accumulatedDeltaRef.current + event.deltaY;
    accumulatedDeltaRef.current = 0;
    lastWheelTimeRef.current = now;

    // Only apply changes if delta is significant enough
    if (Math.abs(totalDelta) < ACCUMULATION_THRESHOLD) {
      accumulatedDeltaRef.current = totalDelta;
      return true;
    }

    isAdjustingRef.current = true;

    // Calculate micro-adjustment in motor ticks
    const motorTickDelta = Math.sign(totalDelta) * WHEEL_SENSITIVITY;

    console.log(`🎵 Micro-adjusting ${selectedNotes.length} notes by ${motorTickDelta} motor ticks`);

    // Apply micro-adjustment to selected notes
    const adjustedNotes = selectedNotes.map(note => {
      const currentTicks = note._motorTicks || precisionGrid.noteToTicks(note);
      const newTicks = precisionGrid.snapToMicroGrid(currentTicks + motorTickDelta);

      // Ensure the note doesn't go negative
      const clampedTicks = Math.max(0, newTicks);

      return precisionGrid.updateNoteTiming(note, clampedTicks);
    });

    // Update notes with new timing
    onNotesUpdate(adjustedNotes);

    // Show micro-adjustment feedback
    showMicroAdjustmentFeedback(motorTickDelta, adjustedNotes.length);

    setTimeout(() => {
      isAdjustingRef.current = false;
    }, 100);

    return true;
  }, [selectedNotes, onNotesUpdate, precisionGrid]);

  /**
   * Shows visual feedback for micro-adjustment
   * @param {number} delta - Tick delta applied
   * @param {number} noteCount - Number of notes adjusted
   */
  const showMicroAdjustmentFeedback = useCallback((delta, noteCount) => {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.className = 'micro-adjustment-feedback';
    feedback.textContent = `${delta > 0 ? '+' : ''}${delta} ticks (${noteCount} notes)`;
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 255, 255, 0.9);
      color: black;
      padding: 8px 16px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      pointer-events: none;
      animation: microFeedback 0.8s ease-out forwards;
    `;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes microFeedback {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
        100% { opacity: 0; transform: translate(-50%, -60%) scale(1); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(feedback);

    // Clean up after animation
    setTimeout(() => {
      document.body.removeChild(feedback);
      document.head.removeChild(style);
    }, 800);
  }, []);

  /**
   * Event listener for wheel events on the piano roll
   */
  useEffect(() => {
    const handleWheel = (event) => {
      handleMicroAdjustment(event);
    };

    // Attach to document to catch all wheel events
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, [handleMicroAdjustment]);

  /**
   * Keyboard shortcut for toggling micro-adjustment mode
   */
  useEffect(() => {
    const handleKeyboard = (event) => {
      // Toggle micro-adjustment mode with Ctrl+Shift+M
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyM') {
        event.preventDefault();
        console.log('🎵 Micro-adjustment mode toggled');
        // Could toggle a state to show/hide motor precision grid
      }
    };

    document.addEventListener('keydown', handleKeyboard);

    return () => {
      document.removeEventListener('keydown', handleKeyboard);
    };
  }, []);

  /**
   * Quantize selected notes to different precision levels
   * @param {'ui'|'motor'|'micro'} precision - Target precision level
   */
  const quantizeNotes = useCallback((precision) => {
    if (!selectedNotes || selectedNotes.length === 0) return;

    console.log(`🎵 Quantizing ${selectedNotes.length} notes to ${precision} precision`);

    const quantizedNotes = selectedNotes.map(note => {
      const currentTicks = note._motorTicks || precisionGrid.noteToTicks(note);
      const snappedTicks = precisionGrid.smartSnap(currentTicks, { mode: precision });

      return precisionGrid.updateNoteTiming(note, snappedTicks);
    });

    onNotesUpdate(quantizedNotes);

    // Show quantization feedback
    showQuantizationFeedback(precision, quantizedNotes.length);
  }, [selectedNotes, onNotesUpdate, precisionGrid]);

  /**
   * Shows feedback for quantization operations
   * @param {string} precision - Precision level
   * @param {number} noteCount - Number of notes quantized
   */
  const showQuantizationFeedback = useCallback((precision, noteCount) => {
    const precisionLabels = {
      ui: '1/32 Grid',
      motor: 'Motor Ticks',
      micro: 'Micro Grid'
    };

    const feedback = document.createElement('div');
    feedback.className = 'quantization-feedback';
    feedback.textContent = `Quantized to ${precisionLabels[precision]} (${noteCount} notes)`;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(255, 165, 0, 0.9);
      color: black;
      padding: 8px 16px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      pointer-events: none;
      animation: quantizeFeedback 1.5s ease-out forwards;
    `;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes quantizeFeedback {
        0% { opacity: 1; transform: translateX(0); }
        80% { opacity: 1; transform: translateX(0); }
        100% { opacity: 0; transform: translateX(20px); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(feedback);

    setTimeout(() => {
      document.body.removeChild(feedback);
      document.head.removeChild(style);
    }, 1500);
  }, []);

  /**
   * Gets the current micro-adjustment status
   */
  const getMicroAdjustmentStatus = useCallback(() => {
    return {
      isActive: isAdjustingRef.current,
      selectedCount: selectedNotes?.length || 0,
      canAdjust: selectedNotes && selectedNotes.length > 0
    };
  }, [selectedNotes]);

  return {
    handleMicroAdjustment,
    quantizeNotes,
    getMicroAdjustmentStatus,
    isAdjusting: isAdjustingRef.current
  };
};