/**
 * Centralized Instrument System
 *
 * Export all instrument classes and factory
 */

// Factory (main entry point)
export { InstrumentFactory } from './InstrumentFactory.js';

// Base class
export { BaseInstrument } from './base/BaseInstrument.js';

// Sample instruments
export { MultiSampleInstrument } from './sample/MultiSampleInstrument.js';

// Synth instruments
export { VASynthInstrument } from './synth/VASynthInstrument.js';

// Loaders
export { SampleLoader } from './loaders/SampleLoader.js';
