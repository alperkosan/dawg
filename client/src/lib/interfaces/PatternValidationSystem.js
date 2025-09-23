// lib/core/interfaces/PatternValidationSystem.js
// DAWG - Pattern Validation System - Clean up orphaned refs

export class PatternValidationSystem {
  constructor(audioEngine, eventBus) {
    this.engine = audioEngine;
    this.eventBus = eventBus;
    
    // Validation state
    this.validationQueue = new Map();
    this.orphanedReferences = new Map();
    this.validationResults = new Map();
    
    // Auto-validation settings
    this.autoValidate = true;
    this.validationDelay = 1000; // ms
    
    // Performance tracking
    this.metrics = {
      totalValidations: 0,
      orphansFound: 0,
      orphansFixed: 0,
      validationErrors: 0
    };
    
    console.log('Pattern Validation System initialized');
    this.setupValidationListeners();
  }

  // =================== VALIDATION SCHEDULING ===================

  /**
   * Schedule pattern validation with debouncing
   * @param {string} patternId - Pattern to validate
   * @param {string} reason - Reason for validation
   */
  scheduleValidation(patternId, reason = 'manual') {
    if (!this.autoValidate && reason === 'auto') return;
    
    // Clear existing timeout
    if (this.validationQueue.has(patternId)) {
      clearTimeout(this.validationQueue.get(patternId));
    }
    
    // Schedule new validation
    const timeout = setTimeout(() => {
      this.validatePattern(patternId);
      this.validationQueue.delete(patternId);
    }, this.validationDelay);
    
    this.validationQueue.set(patternId, timeout);
    
    console.log(`📋 Validation scheduled: ${patternId} (${reason})`);
  }

  /**
   * Validate pattern immediately
   * @param {string} patternId - Pattern to validate
   * @returns {Object} - Validation result
   */
  async validatePattern(patternId) {
    try {
      console.log(`🔍 Validating pattern: ${patternId}`);
      
      const pattern = this.getPatternData(patternId);
      if (!pattern) {
        throw new Error(`Pattern not found: ${patternId}`);
      }
      
      const result = {
        patternId,
        timestamp: Date.now(),
        isValid: true,
        issues: [],
        orphanedRefs: [],
        fixes: [],
        performance: { startTime: performance.now() }
      };
      
      // Validate pattern structure
      await this.validatePatternStructure(pattern, result);
      
      // Validate instrument references
      await this.validateInstrumentReferences(pattern, result);
      
      // Validate note data
      await this.validateNoteData(pattern, result);
      
      // Validate timing and positioning
      await this.validateTiming(pattern, result);
      
      // Apply auto-fixes if enabled
      if (result.issues.length > 0) {
        await this.applyAutoFixes(pattern, result);
      }
      
      // Finalize result
      result.performance.duration = performance.now() - result.performance.startTime;
      result.isValid = result.issues.length === 0;
      
      // Cache result
      this.validationResults.set(patternId, result);
      this.metrics.totalValidations++;
      
      // Emit validation complete event
      this.eventBus.emit('patternValidated', result);
      
      console.log(`✅ Pattern validation complete: ${patternId} (${result.performance.duration.toFixed(2)}ms)`);
      return result;
      
    } catch (error) {
      this.metrics.validationErrors++;
      console.error(`❌ Pattern validation failed: ${patternId}`, error);
      
      const errorResult = {
        patternId,
        timestamp: Date.now(),
        isValid: false,
        issues: [{ type: 'critical', message: error.message }],
        orphanedRefs: [],
        fixes: []
      };
      
      this.validationResults.set(patternId, errorResult);
      return errorResult;
    }
  }

  // =================== VALIDATION CHECKS ===================

  /**
   * Validate basic pattern structure
   */
  async validatePatternStructure(pattern, result) {
    // Check required fields
    const requiredFields = ['id', 'name', 'data'];
    requiredFields.forEach(field => {
      if (!pattern[field]) {
        result.issues.push({
          type: 'structure',
          severity: 'high',
          message: `Missing required field: ${field}`,
          fix: 'addMissingField'
        });
      }
    });
    
    // Check data structure
    if (pattern.data && typeof pattern.data !== 'object') {
      result.issues.push({
        type: 'structure',
        severity: 'critical',
        message: 'Pattern data must be an object',
        fix: 'resetPatternData'
      });
    }
    
    // Check pattern metadata
    if (pattern.length && (typeof pattern.length !== 'number' || pattern.length <= 0)) {
      result.issues.push({
        type: 'structure',
        severity: 'medium',
        message: 'Invalid pattern length',
        fix: 'recalculateLength'
      });
    }
  }

  /**
   * Validate instrument references
   */
  async validateInstrumentReferences(pattern, result) {
    if (!pattern.data) return;
    
    const availableInstruments = this.getAvailableInstruments();
    const orphanedInstruments = [];
    
    Object.keys(pattern.data).forEach(instrumentId => {
      if (!availableInstruments.has(instrumentId)) {
        orphanedInstruments.push(instrumentId);
        result.orphanedRefs.push({
          type: 'instrument',
          id: instrumentId,
          references: pattern.data[instrumentId]?.length || 0
        });
      }
    });
    
    if (orphanedInstruments.length > 0) {
      result.issues.push({
        type: 'orphanedReference',
        severity: 'medium',
        message: `Found ${orphanedInstruments.length} orphaned instrument references`,
        data: orphanedInstruments,
        fix: 'removeOrphanedInstruments'
      });
      
      this.metrics.orphansFound += orphanedInstruments.length;
    }
  }

  /**
   * Validate note data
   */
  async validateNoteData(pattern, result) {
    if (!pattern.data) return;
    
    let totalInvalidNotes = 0;
    
    Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
      if (!Array.isArray(notes)) {
        result.issues.push({
          type: 'noteData',
          severity: 'high',
          message: `Notes for instrument ${instrumentId} is not an array`,
          fix: 'fixNotesArray',
          data: { instrumentId }
        });
        return;
      }
      
      const invalidNotes = [];
      
      notes.forEach((note, index) => {
        const noteIssues = [];
        
        // Required fields
        if (!note.id) {
          noteIssues.push('missing ID');
        }
        
        if (typeof note.time !== 'number' || note.time < 0) {
          noteIssues.push('invalid time');
        }
        
        if (!note.pitch || typeof note.pitch !== 'string') {
          noteIssues.push('invalid pitch');
        }
        
        if (typeof note.velocity !== 'number' || note.velocity < 0 || note.velocity > 1) {
          noteIssues.push('invalid velocity');
        }
        
        // Duration validation
        if (note.duration && typeof note.duration !== 'string' && typeof note.duration !== 'number') {
          noteIssues.push('invalid duration format');
        }
        
        if (noteIssues.length > 0) {
          invalidNotes.push({
            index,
            note,
            issues: noteIssues
          });
        }
      });
      
      if (invalidNotes.length > 0) {
        result.issues.push({
          type: 'noteData',
          severity: 'medium',
          message: `Found ${invalidNotes.length} invalid notes in instrument ${instrumentId}`,
          data: { instrumentId, invalidNotes },
          fix: 'fixInvalidNotes'
        });
        
        totalInvalidNotes += invalidNotes.length;
      }
    });
    
    if (totalInvalidNotes > 0) {
      console.log(`🔍 Found ${totalInvalidNotes} invalid notes across pattern`);
    }
  }

  /**
   * Validate timing and positioning
   */
  async validateTiming(pattern, result) {
    if (!pattern.data) return;
    
    let maxTime = 0;
    let timingIssues = 0;
    
    Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
      if (!Array.isArray(notes)) return;
      
      notes.forEach(note => {
        const noteTime = note.time || 0;
        const noteDuration = this.parseDuration(note.duration) || 0;
        const noteEnd = noteTime + noteDuration;
        
        maxTime = Math.max(maxTime, noteEnd);
        
        // Check for negative times
        if (noteTime < 0) {
          timingIssues++;
        }
        
        // Check for extreme durations
        if (noteDuration > 64) { // More than 4 bars
          timingIssues++;
        }
      });
    });
    
    // Check if pattern length matches content
    const calculatedLength = Math.ceil(maxTime / 16) * 16;
    if (pattern.length && Math.abs(pattern.length - calculatedLength) > 16) {
      result.issues.push({
        type: 'timing',
        severity: 'low',
        message: `Pattern length (${pattern.length}) doesn't match content length (${calculatedLength})`,
        fix: 'updatePatternLength',
        data: { calculatedLength }
      });
    }
    
    if (timingIssues > 0) {
      result.issues.push({
        type: 'timing',
        severity: 'medium',
        message: `Found ${timingIssues} timing issues`,
        fix: 'fixTimingIssues'
      });
    }
  }

  // =================== AUTO-FIX SYSTEM ===================

  /**
   * Apply automatic fixes to pattern issues
   * @param {Object} pattern - Pattern data
   * @param {Object} result - Validation result
   */
  async applyAutoFixes(pattern, result) {
    const fixes = [];
    
    for (const issue of result.issues) {
      try {
        const fix = await this.applyFix(pattern, issue);
        if (fix) {
          fixes.push(fix);
        }
      } catch (error) {
        console.error(`❌ Fix failed for ${issue.type}:`, error);
      }
    }
    
    result.fixes = fixes;
    this.metrics.orphansFixed += fixes.filter(f => f.type === 'orphanedReference').length;
    
    if (fixes.length > 0) {
      console.log(`🔧 Applied ${fixes.length} automatic fixes`);
    }
  }

  /**
   * Apply a specific fix
   * @param {Object} pattern - Pattern data
   * @param {Object} issue - Issue to fix
   */
  async applyFix(pattern, issue) {
    switch (issue.fix) {
      case 'removeOrphanedInstruments':
        return this.removeOrphanedInstruments(pattern, issue.data);
        
      case 'fixNotesArray':
        return this.fixNotesArray(pattern, issue.data.instrumentId);
        
      case 'fixInvalidNotes':
        return this.fixInvalidNotes(pattern, issue.data);
        
      case 'updatePatternLength':
        return this.updatePatternLength(pattern, issue.data.calculatedLength);
        
      case 'addMissingField':
        return this.addMissingFields(pattern);
        
      default:
        console.warn(`Unknown fix type: ${issue.fix}`);
        return null;
    }
  }

  /**
   * Remove orphaned instrument references
   */
  removeOrphanedInstruments(pattern, orphanedInstruments) {
    orphanedInstruments.forEach(instrumentId => {
      delete pattern.data[instrumentId];
    });
    
    return {
      type: 'orphanedReference',
      action: 'removed',
      count: orphanedInstruments.length,
      instruments: orphanedInstruments
    };
  }

  /**
   * Fix invalid notes array
   */
  fixNotesArray(pattern, instrumentId) {
    pattern.data[instrumentId] = [];
    
    return {
      type: 'noteData',
      action: 'resetArray',
      instrumentId
    };
  }

  /**
   * Fix invalid notes
   */
  fixInvalidNotes(pattern, { instrumentId, invalidNotes }) {
    const notes = pattern.data[instrumentId];
    let fixedCount = 0;
    
    invalidNotes.forEach(({ index, note, issues }) => {
      // Fix missing ID
      if (!note.id) {
        note.id = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Fix invalid time
      if (typeof note.time !== 'number' || note.time < 0) {
        note.time = 0;
      }
      
      // Fix invalid pitch
      if (!note.pitch || typeof note.pitch !== 'string') {
        note.pitch = 'C4';
      }
      
      // Fix invalid velocity
      if (typeof note.velocity !== 'number' || note.velocity < 0 || note.velocity > 1) {
        note.velocity = 0.8;
      }
      
      fixedCount++;
    });
    
    return {
      type: 'noteData',
      action: 'fixedNotes',
      instrumentId,
      count: fixedCount
    };
  }

  /**
   * Update pattern length
   */
  updatePatternLength(pattern, calculatedLength) {
    const oldLength = pattern.length;
    pattern.length = calculatedLength;
    
    return {
      type: 'timing',
      action: 'updatedLength',
      oldLength,
      newLength: calculatedLength
    };
  }

  /**
   * Add missing required fields
   */
  addMissingFields(pattern) {
    const fixes = [];
    
    if (!pattern.id) {
      pattern.id = `pattern_${Date.now()}`;
      fixes.push('id');
    }
    
    if (!pattern.name) {
      pattern.name = 'Unnamed Pattern';
      fixes.push('name');
    }
    
    if (!pattern.data) {
      pattern.data = {};
      fixes.push('data');
    }
    
    return {
      type: 'structure',
      action: 'addedFields',
      fields: fixes
    };
  }

  // =================== VALIDATION LISTENERS ===================

  /**
   * Setup automatic validation triggers
   */
  setupValidationListeners() {
    // Pattern change events
    this.eventBus.on('patternChanged', (data) => {
      this.scheduleValidation(data.patternId, 'auto');
    });
    
    this.eventBus.on('patternNotesUpdated', (data) => {
      this.scheduleValidation(data.patternId, 'auto');
    });
    
    this.eventBus.on('instrumentDeleted', (data) => {
      // Check all patterns for references to deleted instrument
      this.validateAllPatterns('instrumentDeleted');
    });
    
    console.log('📡 Validation listeners setup complete');
  }

  /**
   * Validate all patterns
   * @param {string} reason - Reason for validation
   */
  async validateAllPatterns(reason = 'manual') {
    const patterns = this.getAllPatterns();
    const results = [];
    
    console.log(`🔍 Validating ${patterns.length} patterns (${reason})`);
    
    for (const pattern of patterns) {
      const result = await this.validatePattern(pattern.id);
      results.push(result);
    }
    
    return results;
  }

  // =================== UTILITY METHODS ===================

  /**
   * Get pattern data from store/engine
   */
  getPatternData(patternId) {
    // This would typically come from arrangement store
    return this.engine?.patterns?.get(patternId) || null;
  }

  /**
   * Get all patterns
   */
  getAllPatterns() {
    // This would typically come from arrangement store
    const patterns = this.engine?.patterns || new Map();
    return Array.from(patterns.values());
  }

  /**
   * Get available instruments
   */
  getAvailableInstruments() {
    // This would typically come from instruments store
    return this.engine?.instruments || new Map();
  }

  /**
   * Parse duration string to steps
   */
  parseDuration(duration) {
    if (typeof duration === 'number') return duration;
    if (!duration) return 1;
    
    // Simple duration parsing
    const durationMap = {
      '4n': 4, '8n': 2, '16n': 1, '32n': 0.5,
      '2n': 8, '1n': 16
    };
    
    return durationMap[duration] || 1;
  }

  // =================== STATUS & MONITORING ===================

  /**
   * Get validation system status
   */
  getStatus() {
    return {
      autoValidate: this.autoValidate,
      validationDelay: this.validationDelay,
      queueSize: this.validationQueue.size,
      cachedResults: this.validationResults.size,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Get validation result for pattern
   */
  getValidationResult(patternId) {
    return this.validationResults.get(patternId) || null;
  }

  /**
   * Get all validation results
   */
  getAllValidationResults() {
    return Object.fromEntries(this.validationResults);
  }

  /**
   * Clear validation cache
   */
  clearCache(patternId = null) {
    if (patternId) {
      this.validationResults.delete(patternId);
    } else {
      this.validationResults.clear();
    }
  }

  // =================== CONFIGURATION ===================

  /**
   * Update validation settings
   */
  updateSettings(settings) {
    if (typeof settings.autoValidate === 'boolean') {
      this.autoValidate = settings.autoValidate;
    }
    
    if (typeof settings.validationDelay === 'number') {
      this.validationDelay = Math.max(100, settings.validationDelay);
    }
    
    console.log('⚙️ Validation settings updated:', settings);
  }

  /**
   * Enable/disable auto-validation
   */
  setAutoValidation(enabled) {
    this.autoValidate = enabled;
    console.log(`🔄 Auto-validation ${enabled ? 'enabled' : 'disabled'}`);
  }

  // =================== CLEANUP ===================

  /**
   * Dispose validation system
   */
  dispose() {
    // Clear all timeouts
    this.validationQueue.forEach(timeout => clearTimeout(timeout));
    this.validationQueue.clear();
    
    // Clear caches
    this.validationResults.clear();
    this.orphanedReferences.clear();
    
    // Remove event listeners
    this.eventBus.removeAllListeners('patternChanged');
    this.eventBus.removeAllListeners('patternNotesUpdated');
    this.eventBus.removeAllListeners('instrumentDeleted');
    
    console.log('🗑️ Pattern Validation System disposed');
  }
}

export default PatternValidationSystem;