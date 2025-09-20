// =============================================================================
// PIANO ROLL FEATURE - MAIN ENTRY POINT
// =============================================================================

// Core component export
export { default as PianoRoll } from './components/core/PianoRoll';

// All UI components
export * from './components/ui';
export * from './components/core';

// Hooks
export * from './hooks';

// Store
export * from './store';

// Utils
export * from './utils';

// Services
export { pianoRollService, PianoRollService } from './services/PianoRollService';

// Configuration
export * from './config/defaultSettings';
export * from './config/keyboardMappings';
export * from './config/toolsConfig';
export * from './config/scalesConfig';

// Types (if using TypeScript)
export * from './types';

// Styles (import for side effects)
import './styles/index.css';

// =============================================================================
// CONVENIENCE EXPORTS FOR COMMON USE CASES
// =============================================================================

// Quick setup hook for basic piano roll integration
export { useBasicPianoRoll } from './hooks/integration/useBasicPianoRoll';

// Pre-configured piano roll variants
export { SimplePianoRoll } from './components/variants/SimplePianoRoll';
export { AdvancedPianoRoll } from './components/variants/AdvancedPianoRoll';

// =============================================================================
// VERSION AND METADATA
// =============================================================================

export const PIANO_ROLL_VERSION = '1.0.0';
export const PIANO_ROLL_FEATURES = [
  'multi-tool-editing',
  'keyboard-shortcuts',
  'touch-support',
  'audio-preview',
  'scale-highlighting',
  'ghost-notes',
  'velocity-editing',
  'quantization',
  'minimap-navigation',
  'context-menus',
  'accessibility',
  'performance-optimized'
];
