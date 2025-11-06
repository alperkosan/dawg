/**
 * MIDI Input Context Manager
 *
 * Manages context-aware note duration prediction and workflow detection
 * for intelligent MIDI input in the piano roll
 *
 * @version 1.0.0
 * @date 2025-11-03
 */

import { ActionType, WorkflowMode } from './ActionTypes';
import { SmartDurationPredictor } from './SmartDurationPredictor';
import { WorkflowDetector } from './WorkflowDetector';

export class MIDIInputContext {
  constructor() {
    // ═══════════════════════════════════════════════════════════
    // Action Tracking
    // ═══════════════════════════════════════════════════════════
    this.lastAction = null; // Last user action
    this.lastActionTime = 0; // Timestamp of last action
    this.actionHistory = []; // Last 20 actions

    // ═══════════════════════════════════════════════════════════
    // Current Mode & Intent
    // ═══════════════════════════════════════════════════════════
    this.currentMode = WorkflowMode.DEFAULT; // Detected workflow mode
    this.noteCreationIntent = null; // oval | custom | pattern

    // ═══════════════════════════════════════════════════════════
    // Smart Duration Memory
    // ═══════════════════════════════════════════════════════════
    this.durationMemory = {
      visualLength: 1, // Last used visual length
      isOval: true, // Was last note oval?
      wasResized: false, // Was last note manually resized?
      userDefinedLength: null, // User's explicitly chosen length
      lastResizeLength: null // Length from last resize operation
    };

    // ═══════════════════════════════════════════════════════════
    // Workflow Statistics
    // ═══════════════════════════════════════════════════════════
    this.workflowStats = {
      consecutiveNotes: 0, // Consecutive notes added
      averageInterval: 0, // Average time between notes
      lastPitchDirection: null, // up | down | same
      isSequenceMode: false // Fast melody entry?
    };

    // ═══════════════════════════════════════════════════════════
    // Pattern Context
    // ═══════════════════════════════════════════════════════════
    this.patternLength = 64; // Current pattern length (default)

    // ═══════════════════════════════════════════════════════════
    // Helper Instances
    // ═══════════════════════════════════════════════════════════
    this.durationPredictor = new SmartDurationPredictor();
    this.workflowDetector = new WorkflowDetector();

    console.log('✨ MIDIInputContext initialized');
  }

  /**
   * Record a user action
   * @param {string} type - Action type from ActionType enum
   * @param {Object} data - Action-specific data
   */
  recordAction(type, data = {}) {
    const action = {
      type,
      time: Date.now(),
      data
    };

    this.lastAction = action;
    this.lastActionTime = action.time;
    this.actionHistory.push(action);

    // Keep only last 20 actions
    if (this.actionHistory.length > 20) {
      this.actionHistory.shift();
    }

    // Update workflow stats
    this.updateWorkflowStats(action);

    // Detect workflow
    const workflow = this.workflowDetector.detectWorkflow(this);
    if (workflow.isActive) {
      this.currentMode = workflow.mode;
      console.log('🎯 Workflow detected:', workflow.mode, `(${(workflow.confidence * 100).toFixed(0)}% confidence)`);
    } else {
      this.currentMode = WorkflowMode.DEFAULT;
    }

    console.log('📝 Action recorded:', type, data);
  }

  /**
   * Update workflow statistics based on action
   * @param {Object} action - The action that was performed
   */
  updateWorkflowStats(action) {
    // Track consecutive note creations
    if (action.type.startsWith('note:created')) {
      this.workflowStats.consecutiveNotes++;

      // Calculate average interval
      const recentCreations = this.actionHistory
        .filter((a) => a.type.startsWith('note:created'))
        .slice(-5);

      if (recentCreations.length >= 2) {
        const intervals = [];
        for (let i = 1; i < recentCreations.length; i++) {
          intervals.push(recentCreations[i].time - recentCreations[i - 1].time);
        }
        this.workflowStats.averageInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;

        // Sequence mode if average < 500ms
        this.workflowStats.isSequenceMode =
          this.workflowStats.averageInterval < 500;
      }

      // Track pitch direction
      if (recentCreations.length >= 2) {
        const lastPitch =
          recentCreations[recentCreations.length - 1].data?.pitch;
        const prevPitch =
          recentCreations[recentCreations.length - 2].data?.pitch;

        if (lastPitch !== undefined && prevPitch !== undefined) {
          if (lastPitch > prevPitch) {
            this.workflowStats.lastPitchDirection = 'up';
          } else if (lastPitch < prevPitch) {
            this.workflowStats.lastPitchDirection = 'down';
          } else {
            this.workflowStats.lastPitchDirection = 'same';
          }
        }
      }
    } else {
      // Reset consecutive count if not creating notes
      this.workflowStats.consecutiveNotes = 0;
    }
  }

  /**
   * Update duration memory after note creation/modification
   * @param {Object} noteData - { length, visualLength, wasResized, wasWheeled }
   */
  updateDurationMemory(noteData) {
    const { length, visualLength, wasResized, wasWheeled } = noteData;

    this.durationMemory = {
      visualLength: visualLength !== undefined ? visualLength : length,
      isOval: visualLength !== undefined && visualLength < length,
      wasResized: wasResized || false,
      userDefinedLength:
        wasResized || wasWheeled
          ? visualLength
          : this.durationMemory.userDefinedLength,
      lastResizeLength: wasResized ? visualLength : null
    };

    console.log('💾 Duration memory updated:', this.durationMemory);
  }

  /**
   * Get predicted duration for next note
   * @param {Object} newNoteData - { pitch, time, velocity }
   * @returns {Object} { visualLength, shouldBeOval, audioLength, reason }
   */
  getNextNoteDuration(newNoteData) {
    return this.durationPredictor.predictNextNoteDuration(this, newNoteData);
  }

  /**
   * Set pattern length (for oval note calculations)
   * @param {number} length - Pattern length in steps
   */
  setPatternLength(length) {
    this.patternLength = length;
    console.log('📏 Pattern length set:', length);
  }

  /**
   * Reset context to default state
   */
  reset() {
    this.currentMode = WorkflowMode.DEFAULT;
    this.workflowStats.consecutiveNotes = 0;
    this.workflowStats.isSequenceMode = false;
    this.durationMemory = {
      visualLength: 1,
      isOval: true,
      wasResized: false,
      userDefinedLength: null,
      lastResizeLength: null
    };
    console.log('🔄 MIDIInputContext reset to default');
  }

  // ✅ Idle timer removed - no automatic reset to default

  /**
   * Get current workflow mode
   * @returns {string} Current workflow mode
   */
  getCurrentMode() {
    return this.currentMode;
  }

  /**
   * Get workflow statistics
   * @returns {Object} Workflow stats
   */
  getWorkflowStats() {
    return { ...this.workflowStats };
  }

  /**
   * Get action history
   * @returns {Array} Recent actions
   */
  getActionHistory() {
    return [...this.actionHistory];
  }

  /**
   * Cleanup (call when component unmounts)
   */
  destroy() {
    // ✅ Idle timer removed - no cleanup needed
    console.log('🧹 MIDIInputContext destroyed');
  }
}

// ═══════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════
export const midiInputContext = new MIDIInputContext();
