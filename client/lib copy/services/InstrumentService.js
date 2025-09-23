// lib/services/InstrumentService.js - ENHANCED FOR NATIVE ENGINE
// DAWG - Enhanced Instrument Service - Native AudioWorklet Integration

import { AudioContextService } from './AudioContextService';
import { useInstrumentsStore } from '../../src/store/useInstrumentsStore';
import { useMixerStore } from '../../src/store/useMixerStore';
import { v4 as uuidv4 } from 'uuid';
import { MIXER_TRACK_TYPES, INSTRUMENT_TYPES } from '../../src/config/constants';

export class InstrumentService {
  
  /**
   * Creates a new sample instrument from an uploaded/selected sample file
   * @param {Object} sample - Sample file object with name and url
   * @returns {Object|null} - Created instrument object or null if failed
   */
  static createInstrumentFromSample(sample) {
    const engine = AudioContextService.getAudioEngine();
    if (!engine) {
      console.error('❌ Audio engine not available');
      return null;
    }

    const { instruments } = useInstrumentsStore.getState();
    const mixerTracks = useMixerStore.getState().mixerTracks;

    // Find first unused track
    const firstUnusedTrack = mixerTracks.find(track => 
        track.type === MIXER_TRACK_TYPES.TRACK && 
        !instruments.some(inst => inst.mixerTrackId === track.id)
    );

    if (!firstUnusedTrack) {
        console.warn('⚠️ No available mixer tracks');
        alert("Boş mikser kanalı kalmadı!");
        return null;
    }

    // Generate unique name
    const baseName = sample.name.split('.')[0].replace(/_/g, ' ');
    let newName = baseName;
    let counter = 2;
    while (instruments.some(inst => inst.name === newName)) {
        newName = `${baseName} ${counter++}`;
    }

    // Create instrument object
    const newInstrument = {
        id: `inst-${uuidv4()}`,
        name: newName,
        type: INSTRUMENT_TYPES.SAMPLE,
        url: sample.url,
        notes: [],
        mixerTrackId: firstUnusedTrack.id,
        envelope: { 
            attack: 0.01, 
            decay: 0.2, 
            sustain: 0.9, 
            release: 0.5 
        },
        precomputed: { 
            normalize: false, 
            reverse: false, 
            reversePolarity: false, 
            removeDCOffset: false 
        },
        isMuted: false,
        cutItself: false,
        pianoRoll: true,
    };

    // Update stores
    useInstrumentsStore.setState({ 
        instruments: [...instruments, newInstrument] 
    });
    
    useMixerStore.getState().setTrackName(firstUnusedTrack.id, newName);

    // Create instrument in audio engine
    engine.createInstrument(newInstrument).then(() => {
        console.log(`✅ Sample instrument created: "${newName}" on track "${firstUnusedTrack.id}"`);
    }).catch(error => {
        console.error(`❌ Failed to create sample instrument: ${error.message}`);
        // Rollback store changes
        useInstrumentsStore.setState({ 
            instruments: instruments 
        });
    });

    return newInstrument;
  }

  /**
   * Creates a new synthesizer instrument
   * @param {Object} synthConfig - Synth configuration object
   * @returns {Object|null} - Created synth instrument or null if failed
   */
  static createSynthInstrument(synthConfig = {}) {
    const engine = AudioContextService.getAudioEngine();
    if (!engine) {
      console.error('❌ Audio engine not available');
      return null;
    }

    const { instruments } = useInstrumentsStore.getState();
    const mixerTracks = useMixerStore.getState().mixerTracks;

    // Find first unused track
    const firstUnusedTrack = mixerTracks.find(track => 
        track.type === MIXER_TRACK_TYPES.TRACK && 
        !instruments.some(inst => inst.mixerTrackId === track.id)
    );

    if (!firstUnusedTrack) {
        console.warn('⚠️ No available mixer tracks');
        alert("Boş mikser kanalı kalmadı!");
        return null;
    }

    // Generate unique name
    const baseName = synthConfig.name || 'Synth';
    let newName = baseName;
    let counter = 2;
    while (instruments.some(inst => inst.name === newName)) {
        newName = `${baseName} ${counter++}`;
    }

    // Default synth parameters
    const defaultSynthParams = {
        oscillator: { 
            type: synthConfig.oscillatorType || 'sawtooth', 
            detune: 0 
        },
        envelope: { 
            attack: 0.01, 
            decay: 0.3, 
            sustain: 0.7, 
            release: 1.0 
        },
        filter: { 
            frequency: 1000, 
            Q: 1, 
            type: 'lowpass' 
        },
        filterEnv: {
            attack: 0.02,
            decay: 0.3,
            sustain: 0.7,
            release: 0.5,
            baseFrequency: 1000,
            octaves: 4
        },
        lfo1: {
            type: 'sine',
            frequency: '4n',
            amplitude: 1,
            min: 0,
            max: 1
        },
        lfo2: {
            type: 'sine',
            frequency: '8n',
            amplitude: 1,
            min: 0,
            max: 1
        },
        modMatrix: [
            { id: 'slot1', source: 'none', destination: 'none', amount: 0 },
            { id: 'slot2', source: 'none', destination: 'none', amount: 0 },
            { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
        ]
    };

    // Merge with provided config
    const synthParams = {
        ...defaultSynthParams,
        ...synthConfig.synthParams
    };

    // Create synth instrument object
    const newSynth = {
        id: `synth-${uuidv4()}`,
        name: newName,
        type: INSTRUMENT_TYPES.SYNTH,
        synthParams: synthParams,
        notes: [],
        mixerTrackId: firstUnusedTrack.id,
        isMuted: false,
        pianoRoll: true,
        settings: { 
            lowLatency: true,
            customDSP: true 
        }
    };

    // Update stores
    useInstrumentsStore.setState({ 
        instruments: [...instruments, newSynth] 
    });
    
    useMixerStore.getState().setTrackName(firstUnusedTrack.id, newName);

    // Create instrument in audio engine
    engine.createInstrument(newSynth).then(() => {
        console.log(`✅ Synth instrument created: "${newName}" on track "${firstUnusedTrack.id}"`);
    }).catch(error => {
        console.error(`❌ Failed to create synth instrument: ${error.message}`);
        // Rollback store changes
        useInstrumentsStore.setState({ 
            instruments: instruments 
        });
    });

    return newSynth;
  }

  /**
   * Deletes an instrument and cleans up all references
   * @param {string} instrumentId - ID of instrument to delete
   * @returns {boolean} - Success status
   */
  static deleteInstrument(instrumentId) {
    const engine = AudioContextService.getAudioEngine();
    if (!engine) {
      console.error('❌ Audio engine not available');
      return false;
    }

    const { instruments } = useInstrumentsStore.getState();
    const instrumentToDelete = instruments.find(inst => inst.id === instrumentId);
    
    if (!instrumentToDelete) {
        console.warn(`⚠️ Instrument not found: ${instrumentId}`);
        return false;
    }

    try {
        // Remove from audio engine first
        engine.disposeInstrument(instrumentId);

        // Remove from store
        useInstrumentsStore.setState(state => ({
            instruments: state.instruments.filter(inst => inst.id !== instrumentId)
        }));

        // Reset mixer track name if it was using this instrument
        const mixerTrack = useMixerStore.getState().mixerTracks.find(
            track => track.id === instrumentToDelete.mixerTrackId
        );
        
        if (mixerTrack) {
            useMixerStore.getState().setTrackName(
                mixerTrack.id, 
                `Insert ${mixerTrack.id.split('-')[1]}`
            );
        }

        console.log(`🗑️ Instrument deleted: "${instrumentToDelete.name}"`);
        return true;

    } catch (error) {
        console.error(`❌ Failed to delete instrument: ${error.message}`);
        return false;
    }
  }

  /**
   * Duplicates an existing instrument
   * @param {string} instrumentId - ID of instrument to duplicate
   * @returns {Object|null} - Duplicated instrument or null if failed
   */
  static duplicateInstrument(instrumentId) {
    const { instruments } = useInstrumentsStore.getState();
    const originalInstrument = instruments.find(inst => inst.id === instrumentId);
    
    if (!originalInstrument) {
        console.warn(`⚠️ Instrument not found for duplication: ${instrumentId}`);
        return null;
    }

    // Find available track
    const mixerTracks = useMixerStore.getState().mixerTracks;
    const availableTrack = mixerTracks.find(track => 
        track.type === MIXER_TRACK_TYPES.TRACK && 
        !instruments.some(inst => inst.mixerTrackId === track.id)
    );

    if (!availableTrack) {
        console.warn('⚠️ No available tracks for duplication');
        alert("Boş mikser kanalı kalmadı!");
        return null;
    }

    // Create duplicate
    const duplicatedInstrument = {
        ...originalInstrument,
        id: `${originalInstrument.type}-${uuidv4()}`,
        name: `${originalInstrument.name} Copy`,
        mixerTrackId: availableTrack.id,
        notes: [...originalInstrument.notes] // Deep copy notes
    };

    // Deep copy synth params if it's a synth
    if (originalInstrument.type === INSTRUMENT_TYPES.SYNTH) {
        duplicatedInstrument.synthParams = JSON.parse(JSON.stringify(originalInstrument.synthParams));
    }

    // Update stores
    useInstrumentsStore.setState({ 
        instruments: [...instruments, duplicatedInstrument] 
    });
    
    useMixerStore.getState().setTrackName(availableTrack.id, duplicatedInstrument.name);

    // Create in audio engine
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
        engine.createInstrument(duplicatedInstrument).catch(error => {
            console.error(`❌ Failed to duplicate instrument in engine: ${error.message}`);
        });
    }

    console.log(`✅ Instrument duplicated: "${duplicatedInstrument.name}"`);
    return duplicatedInstrument;
  }

  /**
   * Updates instrument parameters and syncs with audio engine
   * @param {string} instrumentId - ID of instrument to update
   * @param {Object} updates - Parameter updates
   * @param {boolean} shouldReconcile - Whether to trigger audio reconciliation
   * @returns {boolean} - Success status
   */
  static updateInstrumentParameters(instrumentId, updates, shouldReconcile = false) {
    const { instruments } = useInstrumentsStore.getState();
    const instrument = instruments.find(inst => inst.id === instrumentId);
    
    if (!instrument) {
        console.warn(`⚠️ Instrument not found for update: ${instrumentId}`);
        return false;
    }

    // Update store
    useInstrumentsStore.getState().updateInstrument(instrumentId, updates, shouldReconcile);

    console.log(`🔧 Instrument parameters updated: ${instrument.name}`);
    return true;
  }

  /**
   * Batch operations for multiple instruments
   * @param {Array} instrumentIds - Array of instrument IDs
   * @param {string} operation - Operation to perform ('mute', 'unmute', 'delete', etc.)
   * @param {Object} params - Additional parameters for the operation
   * @returns {Object} - Operation results
   */
  static batchOperation(instrumentIds, operation, params = {}) {
    const results = {
        successful: [],
        failed: []
    };

    instrumentIds.forEach(instrumentId => {
        try {
            switch (operation) {
                case 'mute':
                    useInstrumentsStore.getState().handleToggleInstrumentMute(instrumentId);
                    results.successful.push(instrumentId);
                    break;
                
                case 'delete':
                    if (this.deleteInstrument(instrumentId)) {
                        results.successful.push(instrumentId);
                    } else {
                        results.failed.push(instrumentId);
                    }
                    break;
                
                case 'updateParams':
                    if (this.updateInstrumentParameters(instrumentId, params.updates, params.shouldReconcile)) {
                        results.successful.push(instrumentId);
                    } else {
                        results.failed.push(instrumentId);
                    }
                    break;
                
                default:
                    console.warn(`⚠️ Unknown batch operation: ${operation}`);
                    results.failed.push(instrumentId);
            }
        } catch (error) {
            console.error(`❌ Batch operation failed for ${instrumentId}: ${error.message}`);
            results.failed.push(instrumentId);
        }
    });

    console.log(`📊 Batch operation "${operation}" completed: ${results.successful.length} successful, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Gets detailed information about an instrument including audio engine status
   * @param {string} instrumentId - ID of instrument
   * @returns {Object|null} - Instrument information or null if not found
   */
  static getInstrumentInfo(instrumentId) {
    const { instruments } = useInstrumentsStore.getState();
    const instrument = instruments.find(inst => inst.id === instrumentId);
    
    if (!instrument) {
        return null;
    }

    const engine = AudioContextService.getAudioEngine();
    const engineInstrument = engine?.instruments?.get(instrumentId);

    return {
        ...instrument,
        engineStatus: {
            isLoaded: !!engineInstrument,
            activeVoices: engineInstrument?.getActiveVoiceCount() || 0,
            type: engineInstrument?.type || 'unknown'
        },
        mixerInfo: {
            trackId: instrument.mixerTrackId,
            trackName: useMixerStore.getState().mixerTracks.find(
                track => track.id === instrument.mixerTrackId
            )?.name || 'Unknown'
        }
    };
  }

  /**
   * Validates instrument configuration before creation
   * @param {Object} instrumentData - Instrument configuration
   * @returns {Object} - Validation result with isValid and errors
   */
  static validateInstrumentConfig(instrumentData) {
    const errors = [];
    
    if (!instrumentData.name || instrumentData.name.trim() === '') {
        errors.push('Instrument name is required');
    }
    
    if (!instrumentData.type || !Object.values(INSTRUMENT_TYPES).includes(instrumentData.type)) {
        errors.push('Valid instrument type is required');
    }
    
    if (instrumentData.type === INSTRUMENT_TYPES.SAMPLE && !instrumentData.url) {
        errors.push('Sample URL is required for sample instruments');
    }
    
    if (instrumentData.type === INSTRUMENT_TYPES.SYNTH && !instrumentData.synthParams) {
        errors.push('Synth parameters are required for synth instruments');
    }

    // Check for name conflicts
    const { instruments } = useInstrumentsStore.getState();
    if (instruments.some(inst => inst.name === instrumentData.name.trim())) {
        errors.push('Instrument name already exists');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
  }

  /**
   * Gets usage statistics for instruments
   * @returns {Object} - Statistics about instrument usage
   */
  static getInstrumentStats() {
    const { instruments } = useInstrumentsStore.getState();
    const engine = AudioContextService.getAudioEngine();

    const stats = {
        total: instruments.length,
        byType: {},
        muted: 0,
        withNotes: 0,
        totalNotes: 0,
        engineLoaded: 0,
        activeVoices: 0
    };

    instruments.forEach(instrument => {
        // Type statistics
        stats.byType[instrument.type] = (stats.byType[instrument.type] || 0) + 1;
        
        // Mute statistics
        if (instrument.isMuted) {
            stats.muted++;
        }
        
        // Notes statistics
        if (instrument.notes && instrument.notes.length > 0) {
            stats.withNotes++;
            stats.totalNotes += instrument.notes.length;
        }
        
        // Engine statistics
        const engineInstrument = engine?.instruments?.get(instrument.id);
        if (engineInstrument) {
            stats.engineLoaded++;
            stats.activeVoices += engineInstrument.getActiveVoiceCount() || 0;
        }
    });

    return stats;
  }
}