/**
 * Workflow Detector
 *
 * Detects user workflow patterns (sequence, rhythm, chord, etc.)
 * based on action history
 */

import { ActionType, WorkflowMode } from './ActionTypes';

export class WorkflowDetector {
  /**
   * Group values by proximity
   * @param {number[]} values - Values to group
   * @param {number} tolerance - Proximity tolerance
   * @returns {number[][]} Groups of proximate values
   */
  groupByProximity(values, tolerance) {
    if (values.length === 0) return [];

    const groups = [];
    const sorted = [...values].sort((a, b) => a - b);

    let currentGroup = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] <= tolerance) {
        currentGroup.push(sorted[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [sorted[i]];
      }
    }
    groups.push(currentGroup);

    return groups;
  }

  /**
   * Detect current workflow based on action history
   * @param {Object} context - MIDIInputContext instance
   * @returns {Object} { mode, isActive, confidence }
   */
  detectWorkflow(context) {
    const { actionHistory } = context;
    const recentActions = actionHistory.slice(-5); // Son 5 işlem

    // Sadece note creation action'larını al
    const noteCreations = recentActions.filter((a) =>
      a.type.startsWith('note:created')
    );

    // En az 3 nota gerekli
    if (noteCreations.length < 3) {
      return {
        mode: WorkflowMode.DEFAULT,
        isActive: false,
        confidence: 0
      };
    }

    // ═══════════════════════════════════════════════════════════
    // SEQUENCE MODE: Hızlı peş peşe nota girişi (melodi)
    // ═══════════════════════════════════════════════════════════
    const intervals = [];
    for (let i = 1; i < noteCreations.length; i++) {
      intervals.push(noteCreations[i].time - noteCreations[i - 1].time);
    }

    if (intervals.length > 0) {
      const avgInterval =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // Ortalama 500ms'den hızlıysa sequence mode
      if (avgInterval < 500) {
        return {
          mode: WorkflowMode.SEQUENCE,
          isActive: true,
          confidence: 0.9,
          avgInterval
        };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // RHYTHM MODE: Aynı pitch, farklı zamanlar (davul pattern)
    // ═══════════════════════════════════════════════════════════
    const pitches = noteCreations
      .map((a) => a.data?.pitch)
      .filter((p) => p !== undefined);
    const uniquePitches = new Set(pitches);

    if (uniquePitches.size === 1 && pitches.length >= 3) {
      return {
        mode: WorkflowMode.RHYTHM,
        isActive: true,
        confidence: 0.85,
        pitch: pitches[0]
      };
    }

    // ═══════════════════════════════════════════════════════════
    // CHORD MODE: Farklı pitch, aynı/yakın zaman (chord stack)
    // ═══════════════════════════════════════════════════════════
    const times = noteCreations
      .map((a) => a.data?.time)
      .filter((t) => t !== undefined);

    if (times.length >= 2) {
      const timeGroups = this.groupByProximity(times, 0.25); // 0.25 step tolerance

      // Eğer birden fazla nota aynı zamanda (±0.25 step) oluşturulmuşsa
      if (timeGroups.some((group) => group.length >= 2)) {
        return {
          mode: WorkflowMode.CHORD,
          isActive: true,
          confidence: 0.8,
          groupCount: timeGroups.length
        };
      }
    }

    // ═══════════════════════════════════════════════════════════
    // ARRANGE MODE: Çok fazla move/delete işlemi (organize ediyor)
    // ═══════════════════════════════════════════════════════════
    const moveActions = recentActions.filter(
      (a) => a.type === ActionType.NOTE_MOVED || a.type === ActionType.NOTE_DELETED
    );

    if (moveActions.length >= 3 && moveActions.length > noteCreations.length) {
      return {
        mode: WorkflowMode.ARRANGE,
        isActive: true,
        confidence: 0.7
      };
    }

    // Default: Workflow tespit edilemedi
    return {
      mode: WorkflowMode.DEFAULT,
      isActive: false,
      confidence: 0
    };
  }

  /**
   * Detect if user is in fast entry mode (sequence)
   * @param {Object} context - MIDIInputContext instance
   * @returns {boolean} True if fast entry detected
   */
  isFastEntry(context) {
    const workflow = this.detectWorkflow(context);
    return workflow.mode === WorkflowMode.SEQUENCE && workflow.isActive;
  }

  /**
   * Detect if user is building chords
   * @param {Object} context - MIDIInputContext instance
   * @returns {boolean} True if chord building detected
   */
  isChordBuilding(context) {
    const workflow = this.detectWorkflow(context);
    return workflow.mode === WorkflowMode.CHORD && workflow.isActive;
  }
}
