/**
 * Smart Duration Predictor
 *
 * Predicts the next note's duration based on user context and workflow
 */

import { ActionType, PredictionReason } from './ActionTypes';

export class SmartDurationPredictor {
  /**
   * Calculate pattern end length from a start time
   * @param {number} startTime - Note start time in steps
   * @param {number} patternLength - Pattern length in steps (default 64)
   * @returns {number} Length from start to pattern end
   */
  calculatePatternEndLength(startTime, patternLength = 64) {
    return Math.max(1, patternLength - startTime);
  }

  /**
   * Calculate time since last action
   * @param {number} lastActionTime - Timestamp of last action
   * @returns {number} Milliseconds since last action
   */
  timeSince(lastActionTime) {
    if (!lastActionTime) return Infinity;
    return Date.now() - lastActionTime;
  }

  /**
   * Predict next note duration based on context
   * @param {Object} context - MIDIInputContext instance
   * @param {Object} newNoteData - { pitch, time, velocity }
   * @returns {Object} { visualLength, shouldBeOval, audioLength, reason }
   */
  predictNextNoteDuration(context, newNoteData) {
    const { lastAction, durationMemory, workflowStats, patternLength } = context;

    // RULE 1: Resize edilmiş notadan sonra - resize uzunluğunu kullan
    // ✅ Check durationMemory.wasResized instead of lastAction type
    // because other actions (like selection) can happen between resize and note creation
    if (
      durationMemory.wasResized &&
      durationMemory.lastResizeLength !== null &&
      durationMemory.lastResizeLength > 0
    ) {
      const length = durationMemory.lastResizeLength;

      console.log('🎯 Duration prediction: USER_RESIZED', {
        length,
        wasResized: durationMemory.wasResized
      });

      return {
        visualLength: length,
        shouldBeOval: false, // Resize edilmiş = user defined, oval değil
        audioLength: length,
        reason: PredictionReason.USER_RESIZED
      };
    }

    // ✅ RULE 2 REMOVED: Wheel no longer affects next note duration
    // Wheel only adjusts audio length of existing notes, not visual length

    // RULE 2: Quantize sonrası - quantize edilen uzunluğu koru
    if (
      lastAction?.type === ActionType.QUANTIZE_APPLIED &&
      this.timeSince(lastAction.time) < 3000 // 3 saniye içinde
    ) {
      const lastLength = durationMemory.visualLength || 1;

      console.log('🎯 Duration prediction: POST_QUANTIZE', {
        length: lastLength,
        timeSince: this.timeSince(lastAction.time)
      });

      return {
        visualLength: lastLength,
        shouldBeOval: durationMemory.isOval,
        audioLength: durationMemory.isOval
          ? this.calculatePatternEndLength(newNoteData.time, patternLength)
          : lastLength,
        reason: PredictionReason.POST_QUANTIZE
      };
    }

    // RULE 3: Sequence mode (hızlı melodi girişi)
    if (workflowStats.isSequenceMode && workflowStats.consecutiveNotes > 2) {
      const lastLength = durationMemory.visualLength || 1;

      console.log('🎯 Duration prediction: SEQUENCE_MODE', {
        length: lastLength,
        consecutiveNotes: workflowStats.consecutiveNotes
      });

      return {
        visualLength: lastLength,
        shouldBeOval: durationMemory.isOval,
        audioLength: durationMemory.isOval
          ? this.calculatePatternEndLength(newNoteData.time, patternLength)
          : lastLength,
        reason: PredictionReason.SEQUENCE_MODE
      };
    }

    // RULE 4: Paint mode - son paint nota uzunluğu
    if (context.currentMode === 'paint') {
      const lastLength = durationMemory.visualLength || 1;

      console.log('🎯 Duration prediction: PAINT_MODE', {
        length: lastLength
      });

      return {
        visualLength: lastLength,
        shouldBeOval: durationMemory.isOval,
        audioLength: durationMemory.isOval
          ? this.calculatePatternEndLength(newNoteData.time, patternLength)
          : lastLength,
        reason: PredictionReason.PAINT_MODE
      };
    }

    // RULE 5: Fallback - Son kullanılan ayarı koru
    const lastLength = durationMemory.visualLength || 1;

    console.log('🎯 Duration prediction: CONTINUE_LAST (fallback)', {
      length: lastLength,
      isOval: durationMemory.isOval
    });

    return {
      visualLength: lastLength,
      shouldBeOval: durationMemory.isOval,
      audioLength: durationMemory.isOval
        ? this.calculatePatternEndLength(newNoteData.time, patternLength)
        : lastLength,
      reason: PredictionReason.CONTINUE_LAST
    };
  }
}
