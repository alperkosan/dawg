/**
 * MIDI Input Action Types
 *
 * Defines all possible user actions in the piano roll
 * for context-aware note duration prediction
 */

export const ActionType = {
  // Note creation
  NOTE_CREATED_CLICK: 'note:created:click',
  NOTE_CREATED_PAINT: 'note:created:paint',
  NOTE_CREATED_KEYBOARD: 'note:created:keyboard',
  NOTE_CREATED_DUPLICATE: 'note:created:duplicate',
  NOTE_CREATED_PASTE: 'note:created:paste',

  // Note modification
  NOTE_RESIZED: 'note:resized',
  NOTE_MOVED: 'note:moved',
  NOTE_DELETED: 'note:deleted',
  NOTE_VELOCITY_CHANGED: 'note:velocity:changed',
  NOTE_LENGTH_WHEELED: 'note:length:wheeled',
  NOTE_TRANSPOSED: 'note:transposed',
  NOTE_MUTED: 'note:muted',
  NOTE_TOGGLED_MUTE: 'note:toggled:mute',
  NOTE_UNMUTED: 'note:unmuted',

  // Selection
  NOTE_SELECTED: 'note:selected',
  NOTE_CLICKED: 'note:clicked',
  SELECTION_CLEARED: 'selection:cleared',

  // Editing operations
  QUANTIZE_APPLIED: 'quantize:applied',
  SLICE_PERFORMED: 'slice:performed',

  // Mode changes
  MODE_CHANGED: 'mode:changed',
  TOOL_CHANGED: 'tool:changed',

  // Timing
  IDLE: 'idle' // 2+ seconds no action
};

/**
 * Workflow modes detected by the system
 */
export const WorkflowMode = {
  DEFAULT: 'default',      // Normal editing
  SEQUENCE: 'sequence',    // Fast melody input
  RHYTHM: 'rhythm',        // Same pitch, different times
  CHORD: 'chord',          // Different pitches, same time
  PAINT: 'paint',          // Continuous painting
  ARRANGE: 'arrange'       // Moving/organizing notes
};

/**
 * Prediction reasons for debugging and UI feedback
 */
export const PredictionReason = {
  USER_RESIZED: 'user_resized',           // Following user's resize
  USER_WHEELED: 'user_wheeled',           // Following wheel adjustment
  SEQUENCE_MODE: 'sequence_mode',         // Fast entry detected
  PAINT_MODE: 'paint_mode',               // Paint mode active
  DEFAULT_OVAL: 'default_oval',           // Default oval note
  CONTINUE_LAST: 'continue_last',         // Continue last pattern
  EXPLICIT: 'explicit',                   // Explicitly provided
  POST_QUANTIZE: 'post_quantize',         // After quantize operation
  POST_TRANSPOSE: 'post_transpose'        // After transpose operation
};

/**
 * Human-readable labels for prediction reasons
 */
export const PredictionReasonLabels = {
  [PredictionReason.USER_RESIZED]: '↔️ Following your resize',
  [PredictionReason.USER_WHEELED]: '🎚️ Using wheel-adjusted length',
  [PredictionReason.SEQUENCE_MODE]: '🎵 Sequence mode detected',
  [PredictionReason.PAINT_MODE]: '🖌️ Paint mode active',
  [PredictionReason.DEFAULT_OVAL]: '⭕ Default (extends to pattern end)',
  [PredictionReason.CONTINUE_LAST]: '↩️ Continuing last pattern',
  [PredictionReason.EXPLICIT]: '📌 Explicit length',
  [PredictionReason.POST_QUANTIZE]: '⚡ Post-quantize',
  [PredictionReason.POST_TRANSPOSE]: '🎼 Post-transpose'
};
