// lib/services/PatternService.js - ENHANCED FOR NATIVE ENGINE
// DAWG - Enhanced Pattern Service - Native AudioWorklet Integration

import { useArrangementStore } from '../../store/useArrangementStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { AudioContextService } from './AudioContextService';
import { NativeTimeUtils } from '../utils/NativeTimeUtils';
import { calculatePatternLoopLength, analyzePatternDensity } from '../utils/patternUtils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enhanced Pattern Service for managing patterns and arrangement with Native Audio Engine
 */
export class PatternService {
  
  /**
   * Clears all notes from a pattern
   * @param {string} patternId - ID of pattern to clear
   * @returns {boolean} - Success status
   */
  static clearPattern(patternId) {
    const { patterns } = useArrangementStore.getState();
    const pattern = patterns[patternId];
    
    if (!pattern) {
      console.warn(`⚠️ Pattern not found: ${patternId}`);
      return false;
    }

    // Clear all instrument notes
    const clearedData = {};
    Object.keys(pattern.data).forEach(instrumentId => {
      clearedData[instrumentId] = [];
    });

    // Update store
    useArrangementStore.setState({
      patterns: {
        ...patterns,
        [patternId]: {
          ...pattern,
          data: clearedData,
          modified: Date.now()
        }
      }
    });

    // Update audio engine
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.setActivePattern(patternId);
    }

    // Reschedule if this is the active pattern and we're playing
    if (patternId === useArrangementStore.getState().activePatternId &&
        usePlaybackStore.getState().playbackState === 'playing') {
      engine?.reschedule();
    }

    console.log(`🧹 Pattern cleared: ${patternId}`);
    return true;
  }

  /**
   * Quantizes all notes in a pattern to a specific grid
   * @param {string} patternId - ID of pattern to quantize
   * @param {string} gridValue - Grid value (e.g., '16n', '8n', '4n')
   * @param {number} strength - Quantization strength (0-1)
   * @returns {boolean} - Success status
   */
  static quantizePattern(patternId, gridValue = '16n', strength = 1.0) {
    const { patterns } = useArrangementStore.getState();
    const pattern = patterns[patternId];
    
    if (!pattern) {
      console.warn(`⚠️ Pattern not found: ${patternId}`);
      return false;
    }

    const currentBPM = usePlaybackStore.getState().bpm;
    const gridStep = NativeTimeUtils.parseTime(gridValue, currentBPM) / 
                     NativeTimeUtils.parseTime('16n', currentBPM);

    const quantizedData = {};
    
    Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
      if (Array.isArray(notes)) {
        quantizedData[instrumentId] = notes.map(note => {
          const originalTime = note.time || 0;
          const quantizedTime = Math.round(originalTime / gridStep) * gridStep;
          const finalTime = originalTime + (quantizedTime - originalTime) * strength;
          
          return {
            ...note,
            time: Math.max(0, finalTime)
          };
        });
      } else {
        quantizedData[instrumentId] = notes;
      }
    });

    // Update store
    useArrangementStore.setState({
      patterns: {
        ...patterns,
        [patternId]: {
          ...pattern,
          data: quantizedData,
          modified: Date.now()
        }
      }
    });

    // Update audio engine
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.setActivePattern(patternId);
    }

    // Reschedule if needed
    if (patternId === useArrangementStore.getState().activePatternId &&
        usePlaybackStore.getState().playbackState === 'playing') {
      engine?.reschedule();
    }

    console.log(`📐 Pattern quantized: ${patternId} to ${gridValue} (${strength * 100}% strength)`);
    return true;
  }

  /**
   * Analyzes a pattern and returns detailed information
   * @param {string} patternId - ID of pattern to analyze
   * @returns {Object|null} - Pattern analysis or null if not found
   */
  static analyzePattern(patternId) {
    const { patterns } = useArrangementStore.getState();
    const pattern = patterns[patternId];
    
    if (!pattern) {
      console.warn(`⚠️ Pattern not found: ${patternId}`);
      return null;
    }

    const analysis = analyzePatternDensity(pattern);
    const calculatedLength = calculatePatternLoopLength(pattern);
    
    return {
      ...analysis,
      calculatedLength,
      actualLength: pattern.length || calculatedLength,
      isEmpty: analysis.totalNotes === 0,
      instrumentsWithNotes: Object.keys(pattern.data).filter(
        instrumentId => Array.isArray(pattern.data[instrumentId]) && 
                       pattern.data[instrumentId].length > 0
      ),
      created: pattern.created,
      modified: pattern.modified
    };
  }

  /**
   * Optimizes a pattern by removing empty instruments and sorting notes
   * @param {string} patternId - ID of pattern to optimize
   * @returns {boolean} - Success status
   */
  static optimizePattern(patternId) {
    const { patterns } = useArrangementStore.getState();
    const pattern = patterns[patternId];
    
    if (!pattern) {
      console.warn(`⚠️ Pattern not found: ${patternId}`);
      return false;
    }

    const optimizedData = {};
    
    Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
      if (Array.isArray(notes) && notes.length > 0) {
        // Filter out invalid notes and sort by time
        const validNotes = notes
          .filter(note => 
            note && 
            typeof note.time === 'number' && 
            note.time >= 0 &&
            note.pitch
          )
          .sort((a, b) => (a.time || 0) - (b.time || 0));
        
        if (validNotes.length > 0) {
          optimizedData[instrumentId] = validNotes;
        }
      }
    });

    // Update store
    useArrangementStore.setState({
      patterns: {
        ...patterns,
        [patternId]: {
          ...pattern,
          data: optimizedData,
          modified: Date.now()
        }
      }
    });

    // Update audio engine
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.setActivePattern(patternId);
    }

    console.log(`⚡ Pattern optimized: ${patternId}`);
    return true;
  }

  /**
   * Merges multiple patterns into a new pattern
   * @param {Array} patternIds - Array of pattern IDs to merge
   * @param {string} newName - Name for the merged pattern
   * @param {string} mergeMode - How to merge ('sequence', 'overlay', 'interleave')
   * @returns {Object|null} - Merged pattern or null if failed
   */
  static mergePatterns(patternIds, newName = 'Merged Pattern', mergeMode = 'sequence') {
    const { patterns } = useArrangementStore.getState();
    
    if (!Array.isArray(patternIds) || patternIds.length < 2) {
      console.warn('⚠️ At least 2 patterns required for merging');
      return null;
    }

    const sourcePatterns = patternIds.map(id => patterns[id]).filter(Boolean);
    if (sourcePatterns.length !== patternIds.length) {
      console.warn('⚠️ Some patterns not found for merging');
      return null;
    }

    const mergedId = `pattern-${uuidv4()}`;
    let mergedData = {};
    let totalLength = 0;

    switch (mergeMode) {
      case 'sequence':
        // Place patterns one after another
        sourcePatterns.forEach((pattern, index) => {
          const patternLength = calculatePatternLoopLength(pattern);
          const timeOffset = totalLength;
          
          Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
            if (!mergedData[instrumentId]) mergedData[instrumentId] = [];
            
            if (Array.isArray(notes)) {
              const offsetNotes = notes.map(note => ({
                ...note,
                time: (note.time || 0) + timeOffset
              }));
              mergedData[instrumentId].push(...offsetNotes);
            }
          });
          
          totalLength += patternLength;
        });
        break;

      case 'overlay':
        // Overlay all patterns at the same time
        sourcePatterns.forEach(pattern => {
          Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
            if (!mergedData[instrumentId]) mergedData[instrumentId] = [];
            
            if (Array.isArray(notes)) {
              mergedData[instrumentId].push(...notes);
            }
          });
        });
        totalLength = Math.max(...sourcePatterns.map(p => calculatePatternLoopLength(p)));
        break;

      case 'interleave':
        // Interleave patterns bar by bar
        const maxLength = Math.max(...sourcePatterns.map(p => calculatePatternLoopLength(p)));
        const barLength = 16; // 16 steps per bar
        
        for (let bar = 0; bar < Math.ceil(maxLength / barLength); bar++) {
          const patternIndex = bar % sourcePatterns.length;
          const pattern = sourcePatterns[patternIndex];
          const timeOffset = bar * barLength;
          
          Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
            if (!mergedData[instrumentId]) mergedData[instrumentId] = [];
            
            if (Array.isArray(notes)) {
              const barNotes = notes.filter(note => {
                const noteTime = note.time || 0;
                return noteTime >= 0 && noteTime < barLength;
              });
              
              const offsetNotes = barNotes.map(note => ({
                ...note,
                time: (note.time || 0) + timeOffset
              }));
              
              mergedData[instrumentId].push(...offsetNotes);
            }
          });
        }
        totalLength = Math.ceil(maxLength / barLength) * barLength;
        break;

      default:
        console.warn(`⚠️ Unknown merge mode: ${mergeMode}`);
        return null;
    }

    const mergedPattern = {
      id: mergedId,
      name: newName,
      data: mergedData,
      length: totalLength,
      created: Date.now(),
      modified: Date.now()
    };

    // Add to stores
    const { patternOrder } = useArrangementStore.getState();
    useArrangementStore.setState({
      patterns: {
        ...patterns,
        [mergedId]: mergedPattern
      },
      patternOrder: [...patternOrder, mergedId]
    });

    // Add to audio engine
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.setActivePattern(mergedId);
    }

    console.log(`🔀 Patterns merged: ${patternIds.join(', ')} -> ${mergedId} (${mergeMode})`);
    return mergedPattern;
  }

  /**
   * Exports pattern data in various formats
   * @param {string} patternId - ID of pattern to export
   * @param {string} format - Export format ('json', 'midi', 'audio')
   * @returns {Object|null} - Export data or null if failed
   */
  static exportPattern(patternId, format = 'json') {
    const { patterns } = useArrangementStore.getState();
    const pattern = patterns[patternId];
    
    if (!pattern) {
      console.warn(`⚠️ Pattern not found: ${patternId}`);
      return null;
    }

    switch (format) {
      case 'json':
        return {
          format: 'dawg-pattern-v1',
          pattern: pattern,
          metadata: {
            exported: Date.now(),
            bpm: usePlaybackStore.getState().bpm,
            analysis: this.analyzePattern(patternId)
          }
        };

      case 'midi':
        // MIDI export would require additional implementation
        console.warn('⚠️ MIDI export not implemented yet');
        return null;

      case 'audio':
        // Audio export would require rendering
        console.warn('⚠️ Audio export not implemented yet');
        return null;

      default:
        console.warn(`⚠️ Unknown export format: ${format}`);
        return null;
    }
  }

  /**
   * Imports pattern data from external source
   * @param {Object} patternData - Pattern data to import
   * @param {string} name - Name for imported pattern
   * @returns {Object|null} - Imported pattern or null if failed
   */
  static importPattern(patternData, name = 'Imported Pattern') {
    try {
      // Validate pattern data structure
      if (!patternData || typeof patternData !== 'object') {
        throw new Error('Invalid pattern data structure');
      }

      // Create new pattern
      const importedPattern = this.createNewPattern(name);
      
      // Update with imported data
      if (patternData.data) {
        useArrangementStore.setState(state => ({
          patterns: {
            ...state.patterns,
            [importedPattern.id]: {
              ...importedPattern,
              data: patternData.data,
              length: patternData.length || calculatePatternLoopLength(patternData),
              modified: Date.now()
            }
          }
        }));

        // Update audio engine
        const engine = AudioContextService.getAudioEngine();
        if (engine) {
          engine.setActivePattern(importedPattern.id);
        }
      }

      console.log(`📥 Pattern imported: ${name} (${importedPattern.id})`);
      return importedPattern;

    } catch (error) {
      console.error(`❌ Pattern import failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Gets comprehensive statistics about all patterns
   * @returns {Object} - Pattern statistics
   */
  static getPatternStats() {
    const { patterns } = useArrangementStore.getState();
    
    const stats = {
      total: Object.keys(patterns).length,
      totalNotes: 0,
      averageLength: 0,
      densityDistribution: {},
      instrumentUsage: {},
      oldestPattern: null,
      newestPattern: null
    };

    const patternArray = Object.values(patterns);
    
    if (patternArray.length === 0) {
      return stats;
    }

    let totalLength = 0;
    let oldestTime = Date.now();
    let newestTime = 0;

    patternArray.forEach(pattern => {
      // Analyze each pattern
      const analysis = analyzePatternDensity(pattern);
      stats.totalNotes += analysis.totalNotes;
      
      const length = calculatePatternLoopLength(pattern);
      totalLength += length;
      
      // Density distribution
      const density = analysis.density;
      stats.densityDistribution[density] = (stats.densityDistribution[density] || 0) + 1;
      
      // Instrument usage
      Object.keys(pattern.data).forEach(instrumentId => {
        if (pattern.data[instrumentId] && Array.isArray(pattern.data[instrumentId]) && 
            pattern.data[instrumentId].length > 0) {
          stats.instrumentUsage[instrumentId] = (stats.instrumentUsage[instrumentId] || 0) + 1;
        }
      });
      
      // Timestamps
      if (pattern.created < oldestTime) {
        oldestTime = pattern.created;
        stats.oldestPattern = pattern.id;
      }
      
      if (pattern.modified > newestTime) {
        newestTime = pattern.modified;
        stats.newestPattern = pattern.id;
      }
    });

    stats.averageLength = Math.round(totalLength / patternArray.length);

    return stats;
  }

  /**
   * Validates pattern integrity and fixes common issues
   * @param {string} patternId - ID of pattern to validate
   * @returns {Object} - Validation result with fixes applied
   */
  static validateAndFixPattern(patternId) {
    const { patterns } = useArrangementStore.getState();
    const pattern = patterns[patternId];
    
    if (!pattern) {
      return { isValid: false, errors: ['Pattern not found'] };
    }

    const issues = [];
    const fixes = [];
    let fixedData = { ...pattern.data };
    let wasFixed = false;

    // Check and fix note data
    Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
      if (!Array.isArray(notes)) {
        issues.push(`Invalid notes array for instrument ${instrumentId}`);
        fixedData[instrumentId] = [];
        fixes.push(`Fixed notes array for instrument ${instrumentId}`);
        wasFixed = true;
        return;
      }

      const validNotes = [];
      notes.forEach((note, index) => {
        if (!note || typeof note !== 'object') {
          issues.push(`Invalid note object at index ${index} for instrument ${instrumentId}`);
          fixes.push(`Removed invalid note at index ${index} for instrument ${instrumentId}`);
          wasFixed = true;
          return;
        }

        // Fix note properties
        const fixedNote = { ...note };
        
        if (typeof note.time !== 'number' || note.time < 0) {
          fixedNote.time = 0;
          issues.push(`Invalid time for note in instrument ${instrumentId}`);
          fixes.push(`Fixed note time to 0 for instrument ${instrumentId}`);
          wasFixed = true;
        }

        if (!note.pitch) {
          fixedNote.pitch = 'C4';
          issues.push(`Missing pitch for note in instrument ${instrumentId}`);
          fixes.push(`Set default pitch C4 for instrument ${instrumentId}`);
          wasFixed = true;
        }

        if (typeof note.velocity !== 'number' || note.velocity < 0 || note.velocity > 1) {
          fixedNote.velocity = 0.8;
          issues.push(`Invalid velocity for note in instrument ${instrumentId}`);
          fixes.push(`Fixed velocity to 0.8 for instrument ${instrumentId}`);
          wasFixed = true;
        }

        if (!fixedNote.id) {
          fixedNote.id = `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          fixes.push(`Added missing ID for note in instrument ${instrumentId}`);
          wasFixed = true;
        }

        validNotes.push(fixedNote);
      });

      fixedData[instrumentId] = validNotes;
    });

    // Apply fixes if any were made
    if (wasFixed) {
      useArrangementStore.setState({
        patterns: {
          ...patterns,
          [patternId]: {
            ...pattern,
            data: fixedData,
            modified: Date.now()
          }
        }
      });

      // Update audio engine
      const engine = AudioContextService.getAudioEngine();
      if (engine) {
        engine.setActivePattern(patternId);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      fixes,
      wasFixed
    };
  }

  /**
   * Updates notes for the active pattern and syncs with audio engine
   * @param {string} instrumentId - ID of the instrument
   * @param {Array} newNotes - New notes array
   * @param {boolean} shouldReschedule - Whether to reschedule playback
   */
  static updateNotesForActivePattern(instrumentId, newNotes, shouldReschedule = true) {
    const engine = AudioContextService.getAudioEngine();
    const { activePatternId, updatePatternNotes } = useArrangementStore.getState();

    if (!activePatternId) {
      console.warn('⚠️ No active pattern to update');
      return;
    }

    // 1. Update state
    updatePatternNotes(activePatternId, instrumentId, newNotes);
    
    // 2. Update audio engine pattern data
    if (engine) {
      engine.setActivePattern(activePatternId);
    }
    
    // 3. Update loop settings if pattern length changed
    const playbackStore = usePlaybackStore.getState();
    if (playbackStore.isAutoLoop) {
      playbackStore.updateLoopLength();
    }
    
    // 4. Reschedule if playing and requested
    if (shouldReschedule && playbackStore.playbackState === 'playing') {
      engine?.reschedule();
    }

    console.log(`🎵 Notes updated for instrument ${instrumentId} in pattern ${activePatternId}`);
  }

  /**
   * Creates a new empty pattern
   * @param {string} name - Pattern name
   * @param {number} length - Pattern length in steps (optional)
   * @returns {Object} - Created pattern object
   */
  static createNewPattern(name = 'New Pattern', length = 64) {
    const patternId = `pattern-${uuidv4()}`;
    const newPattern = {
      id: patternId,
      name: name,
      data: {}, // Empty instrument data
      length: length,
      created: Date.now(),
      modified: Date.now()
    };

    // Add to arrangement store
    const { patterns, patternOrder } = useArrangementStore.getState();
    useArrangementStore.setState({
      patterns: {
        ...patterns,
        [patternId]: newPattern
      },
      patternOrder: [...patternOrder, patternId]
    });

    // Add to audio engine
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.setActivePattern(patternId);
    }

    console.log(`✅ New pattern created: ${name} (${patternId})`);
    return newPattern;
  }

  /**
   * Duplicates an existing pattern
   * @param {string} sourcePatternId - ID of pattern to duplicate
   * @param {string} newName - Name for the duplicated pattern
   * @returns {Object|null} - Duplicated pattern or null if failed
   */
  static duplicatePattern(sourcePatternId, newName = null) {
    const { patterns, patternOrder } = useArrangementStore.getState();
    const sourcePattern = patterns[sourcePatternId];
    
    if (!sourcePattern) {
      console.warn(`⚠️ Source pattern not found: ${sourcePatternId}`);
      return null;
    }

    const duplicatedId = `pattern-${uuidv4()}`;
    const finalName = newName || `${sourcePattern.name} Copy`;
    
    // Deep copy the pattern data
    const duplicatedPattern = {
      id: duplicatedId,
      name: finalName,
      data: JSON.parse(JSON.stringify(sourcePattern.data)),
      length: sourcePattern.length,
      created: Date.now(),
      modified: Date.now()
    };

    // Update stores
    useArrangementStore.setState({
      patterns: {
        ...patterns,
        [duplicatedId]: duplicatedPattern
      },
      patternOrder: [...patternOrder, duplicatedId]
    });

    // Add to audio engine
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.setActivePattern(duplicatedId);
    }

    console.log(`✅ Pattern duplicated: ${finalName} (${duplicatedId})`);
    return duplicatedPattern;
  }

  /**
   * Deletes a pattern and cleans up references
   * @param {string} patternId - ID of pattern to delete
   * @returns {boolean} - Success status
   */
  static deletePattern(patternId) {
    const { patterns, patternOrder, activePatternId } = useArrangementStore.getState();
    
    if (!patterns[patternId]) {
      console.warn(`⚠️ Pattern not found: ${patternId}`);
      return false;
    }

    // Don't delete if it's the only pattern
    if (patternOrder.length <= 1) {
      console.warn('⚠️ Cannot delete the last remaining pattern');
      return false;
    }

    // If deleting active pattern, switch to another one
    let newActivePatternId = activePatternId;
    if (activePatternId === patternId) {
      const currentIndex = patternOrder.indexOf(patternId);
      const newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex + 1;
      newActivePatternId = patternOrder[newIndex];
    }

    // Update stores
    const newPatterns = { ...patterns };
    delete newPatterns[patternId];
    
    useArrangementStore.setState({
      patterns: newPatterns,
      patternOrder: patternOrder.filter(id => id !== patternId),
      activePatternId: newActivePatternId
    });

    // Remove from audio engine
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.setActivePattern(newActivePatternId);
    }

    console.log(`🗑️ Pattern deleted: ${patternId}`);
    return true;
  }

  /**
   * Sets the active pattern
   * @param {string} patternId - ID of pattern to activate
   * @returns {boolean} - Success status
   */
  static setActivePattern(patternId) {
    const { patterns } = useArrangementStore.getState();
    
    if (!patterns[patternId]) {
      console.warn(`⚠️ Pattern not found: ${patternId}`);
      return false;
    }

    // Update store
    useArrangementStore.setState({ activePatternId: patternId });

    // Update audio engine
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.setActivePattern(patternId);
    }

    // Update loop settings
    const playbackStore = usePlaybackStore.getState();
    if (playbackStore.isAutoLoop) {
      playbackStore.updateLoopLength();
    }

    console.log(`🎯 Active pattern set: ${patternId}`);
    return true;
  }

  /**
   * Gets the currently active pattern
   * @returns {Object|null} - Active pattern or null if none
   */
  static getActivePattern() {
    const { patterns, activePatternId } = useArrangementStore.getState();
    return activePatternId ? patterns[activePatternId] : null;
  }

  /**
   * Gets pattern by ID
   * @param {string} patternId - Pattern ID
   * @returns {Object|null} - Pattern or null if not found
   */
  static getPattern(patternId) {
    const { patterns } = useArrangementStore.getState();
    return patterns[patternId] || null;
  }

  /**
   * Gets all patterns
   * @returns {Array} - Array of all patterns
   */
  static getAllPatterns() {
    const { patterns, patternOrder } = useArrangementStore.getState();
    return patternOrder.map(id => patterns[id]).filter(Boolean);
  }
}