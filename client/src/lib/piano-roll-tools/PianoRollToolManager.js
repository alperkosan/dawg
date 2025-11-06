/**
 * PIANO ROLL TOOL MANAGER
 *
 * Centralized tool system for Piano Roll note manipulation
 * Supports: Paint Brush, Chopper, Strumizer, Arpeggiator
 * Keyboard shortcuts: Alt + [1-9] for tool selection
 */

export const TOOL_TYPES = {
  SELECT: 'select',           // Default selection tool
  PAINT_BRUSH: 'paintBrush',  // Draw notes
  CHOPPER: 'chopper',         // Slice/chop notes
  STRUMIZER: 'strumizer',     // Create strumming patterns
  ARPEGGIATOR: 'arpeggiator', // Create arpeggios
  ERASER: 'eraser',           // Erase notes
  FLAM: 'flam',               // Create flam effect
  RANDOMIZER: 'randomizer',   // Randomize note properties
  FLIP: 'flip',               // Flip notes horizontally/vertically
  SLIDE: 'slide'              // ✅ PHASE 3: Create slide connections between notes
};

export const TOOL_SHORTCUTS = {
  [TOOL_TYPES.SELECT]: 'v',         // Alt+V
  [TOOL_TYPES.PAINT_BRUSH]: 'b',    // Alt+B (Brush)
  [TOOL_TYPES.CHOPPER]: 'c',        // Alt+C (Chop)
  [TOOL_TYPES.STRUMIZER]: 's',      // Alt+S (Strum)
  [TOOL_TYPES.ARPEGGIATOR]: 'a',    // Alt+A (Arpeggio)
  [TOOL_TYPES.ERASER]: 'e',         // Alt+E (Erase)
  [TOOL_TYPES.FLAM]: 'f',           // Alt+F (Flam)
  [TOOL_TYPES.RANDOMIZER]: 'r',     // Alt+R (Randomize)
  [TOOL_TYPES.FLIP]: 'l',           // Alt+L (Flip - mirrored 'L')
  [TOOL_TYPES.SLIDE]: 'g'           // ✅ PHASE 3: Alt+G (Glide/Slide)
};

export const TOOL_INFO = {
  [TOOL_TYPES.SELECT]: {
    name: 'Select',
    icon: '⌖',
    description: 'Select and move notes',
    cursor: 'default'
  },
  [TOOL_TYPES.PAINT_BRUSH]: {
    name: 'Paint Brush',
    icon: '🖌️',
    description: 'Draw notes by clicking or dragging',
    cursor: 'crosshair'
  },
  [TOOL_TYPES.CHOPPER]: {
    name: 'Chopper',
    icon: '✂️',
    description: 'Slice selected notes into smaller pieces',
    cursor: 'cell'
  },
  [TOOL_TYPES.STRUMIZER]: {
    name: 'Strumizer',
    icon: '🎸',
    description: 'Create guitar-style strumming from chord',
    cursor: 'grab'
  },
  [TOOL_TYPES.ARPEGGIATOR]: {
    name: 'Arpeggiator',
    icon: '🎹',
    description: 'Generate arpeggio patterns from selected notes',
    cursor: 'copy'
  },
  [TOOL_TYPES.ERASER]: {
    name: 'Eraser',
    icon: '🧹',
    description: 'Erase notes by clicking',
    cursor: 'not-allowed'
  },
  [TOOL_TYPES.FLAM]: {
    name: 'Flam',
    icon: '⚡',
    description: 'Create quick note repetitions for realistic drums',
    cursor: 'pointer'
  },
  [TOOL_TYPES.RANDOMIZER]: {
    name: 'Randomizer',
    icon: '🎲',
    description: 'Randomize note timing, velocity, pitch, and duration',
    cursor: 'help'
  },
  [TOOL_TYPES.FLIP]: {
    name: 'Flip',
    icon: '↔️',
    description: 'Mirror notes horizontally or vertically',
    cursor: 'move'
  },
  [TOOL_TYPES.SLIDE]: {
    name: 'Slide',
    icon: '🔗',
    description: 'Create slide connections between notes (portamento)',
    cursor: 'crosshair'
  }
};

class PianoRollToolManager {
  constructor() {
    this.activeTool = TOOL_TYPES.SELECT;
    this.keyboardPianoModeActive = false; // ✅ Track keyboard piano mode
    this.toolSettings = {
      [TOOL_TYPES.PAINT_BRUSH]: {
        velocity: 0.8,
        duration: 1, // beats
        snap: true
      },
      [TOOL_TYPES.CHOPPER]: {
        divisions: 4, // Chop into 4 pieces
        preserveVelocity: true
      },
      [TOOL_TYPES.STRUMIZER]: {
        strumSpeed: 0.05, // Delay between notes in seconds
        direction: 'down', // 'up' or 'down'
        humanize: 0.2 // Randomization amount
      },
      [TOOL_TYPES.ARPEGGIATOR]: {
        pattern: 'up', // 'up', 'down', 'updown', 'random'
        octaves: 1,
        speed: 0.25, // Note duration in beats
        gate: 0.8 // Note length percentage
      },
      [TOOL_TYPES.FLAM]: {
        repeats: 3,
        spacing: 0.05,
        velocityDecay: 0.15,
        reverse: false
      },
      [TOOL_TYPES.RANDOMIZER]: {
        randomizeTiming: true,
        timingAmount: 0.1,
        randomizeVelocity: true,
        velocityAmount: 0.2,
        randomizePitch: false,
        pitchRange: 2,
        randomizeDuration: false,
        durationAmount: 0.2
      },
      [TOOL_TYPES.FLIP]: {
        direction: 'vertical', // 'horizontal', 'vertical', 'both'
        pivotMode: 'auto'
      }
    };
    this.listeners = new Set();
  }

  /**
   * Set active tool
   */
  setActiveTool(toolType) {
    if (!Object.values(TOOL_TYPES).includes(toolType)) {
      console.warn('Invalid tool type:', toolType);
      return;
    }

    this.activeTool = toolType;
    this._notifyListeners('tool-changed', { tool: toolType });
    console.log(`🎨 Active tool: ${TOOL_INFO[toolType].name}`);
  }

  /**
   * Get active tool
   */
  getActiveTool() {
    return this.activeTool;
  }

  /**
   * Get tool settings
   */
  getToolSettings(toolType) {
    return this.toolSettings[toolType] || {};
  }

  /**
   * Update tool settings
   */
  updateToolSettings(toolType, settings) {
    if (this.toolSettings[toolType]) {
      this.toolSettings[toolType] = {
        ...this.toolSettings[toolType],
        ...settings
      };
      this._notifyListeners('settings-changed', { tool: toolType, settings });
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyPress(e) {
    // ✅ IGNORE SHORTCUTS when keyboard piano mode is active
    if (this.keyboardPianoModeActive) {
      return false;
    }

    if (!e.altKey) return false;

    const key = e.key.toLowerCase();

    // Find tool by shortcut
    for (const [toolType, shortcut] of Object.entries(TOOL_SHORTCUTS)) {
      if (shortcut === key) {
        e.preventDefault();
        this.setActiveTool(toolType);
        return true;
      }
    }

    return false;
  }

  /**
   * ✅ SET KEYBOARD PIANO MODE
   * When active, tool shortcuts are disabled
   */
  setKeyboardPianoMode(active) {
    this.keyboardPianoModeActive = active;
  }

  /**
   * Subscribe to tool changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners
   */
  _notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Tool listener error:', error);
      }
    });
  }

  /**
   * Get cursor style for active tool
   */
  getCursor() {
    return TOOL_INFO[this.activeTool].cursor;
  }

  /**
   * Check if tool affects selection
   */
  requiresSelection(toolType = this.activeTool) {
    return [
      TOOL_TYPES.CHOPPER,
      TOOL_TYPES.STRUMIZER,
      TOOL_TYPES.ARPEGGIATOR
    ].includes(toolType);
  }
}

// Singleton instance
let toolManagerInstance = null;

export function getToolManager() {
  if (!toolManagerInstance) {
    toolManagerInstance = new PianoRollToolManager();
  }
  return toolManagerInstance;
}

export default PianoRollToolManager;
