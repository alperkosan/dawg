// lib/interfaces/DynamicLoopManager.js
// DAWG - Dynamic Loop Length Management System

export class DynamicLoopManager {
  constructor(audioEngine, eventBus) {
    this.engine = audioEngine;
    this.eventBus = eventBus;
    
    // Loop management state
    this.loopMode = 'auto'; // 'auto' | 'manual' | 'selection'
    this.currentLoop = {
      start: 0,
      end: 64,
      length: 64,
      bars: 4
    };
    
    // Pattern analysis cache
    this.patternAnalysisCache = new Map();
    this.analysisThrottle = 100; // Cache analysis for 100ms
    
    // Auto-calculation settings
    this.autoSettings = {
      minLength: 16, // Minimum 1 bar
      maxLength: 256, // Maximum 16 bars
      snapToBars: true,
      includeEmptyTail: true, // Include silence at end
      tailLength: 8 // Steps of silence to include
    };
    
    // Manual override tracking
    this.manualOverrides = new Map();
    
    console.log('Dynamic Loop Manager initialized');
    this.setupPatternListeners();
  }

  // =================== LOOP MODE MANAGEMENT ===================

  /**
   * Set loop calculation mode
   * @param {string} mode - 'auto', 'manual', or 'selection'
   */
  setLoopMode(mode) {
    const validModes = ['auto', 'manual', 'selection'];
    if (!validModes.includes(mode)) {
      console.warn(`Invalid loop mode: ${mode}`);
      return false;
    }
    
    const previousMode = this.loopMode;
    this.loopMode = mode;
    
    this.eventBus.emit('loopModeChanged', {
      previous: previousMode,
      current: mode,
      loop: this.currentLoop
    });
    
    // Recalculate loop based on new mode
    this.recalculateLoop();
    
    console.log(`Loop mode changed: ${previousMode} -> ${mode}`);
    return true;
  }

  /**
   * Get current loop mode
   */
  getLoopMode() {
    return this.loopMode;
  }

  // =================== AUTOMATIC LOOP CALCULATION ===================

  /**
   * Calculate loop length from current active pattern
   * @param {string} patternId - Pattern to analyze (optional, uses active)
   */
  calculateLoopFromPattern(patternId = null) {
    const targetPatternId = patternId || this.getActivePatternId();
    if (!targetPatternId) {
      console.warn('No active pattern for loop calculation');
      return this.getDefaultLoop();
    }
    
    // Check cache first
    const cacheKey = `${targetPatternId}_${Date.now()}`;
    const cached = this.patternAnalysisCache.get(targetPatternId);
    if (cached && (Date.now() - cached.timestamp) < this.analysisThrottle) {
      return cached.loop;
    }
    
    const pattern = this.getPatternData(targetPatternId);
    if (!pattern || !pattern.data) {
      console.warn(`Pattern data not found: ${targetPatternId}`);
      return this.getDefaultLoop();
    }
    
    const analysis = this.analyzePatternContent(pattern);
    const calculatedLoop = this.calculateLoopFromAnalysis(analysis);
    
    // Cache result
    this.patternAnalysisCache.set(targetPatternId, {
      loop: calculatedLoop,
      analysis,
      timestamp: Date.now()
    });
    
    console.log(`Loop calculated from pattern ${targetPatternId}:`, calculatedLoop);
    return calculatedLoop;
  }

  /**
   * Analyze pattern content to find musical boundaries
   * @param {Object} pattern - Pattern data
   */
  analyzePatternContent(pattern) {
    let maxNoteEnd = 0;
    let totalNotes = 0;
    let lastNoteTime = 0;
    let instrumentActivity = new Map();
    let timeDensity = new Map(); // Notes per time unit
    
    // Analyze all instruments in pattern
    Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
      if (!Array.isArray(notes) || notes.length === 0) return;
      
      let instrumentLastNote = 0;
      let instrumentNoteCount = notes.length;
      
      notes.forEach(note => {
        const noteTime = note.time || 0;
        const noteDuration = this.parseDuration(note.duration) || 1;
        const noteEnd = noteTime + noteDuration;
        
        // Track maximum extent
        if (noteEnd > maxNoteEnd) {
          maxNoteEnd = noteEnd;
        }
        
        if (noteTime > lastNoteTime) {
          lastNoteTime = noteTime;
        }
        
        if (noteTime > instrumentLastNote) {
          instrumentLastNote = noteTime;
        }
        
        // Count notes in time windows for density analysis
        const timeWindow = Math.floor(noteTime / 4) * 4; // 4-step windows
        timeDensity.set(timeWindow, (timeDensity.get(timeWindow) || 0) + 1);
        
        totalNotes++;
      });
      
      instrumentActivity.set(instrumentId, {
        noteCount: instrumentNoteCount,
        lastNoteTime: instrumentLastNote,
        density: instrumentNoteCount / Math.max(instrumentLastNote, 1)
      });
    });
    
    return {
      maxNoteEnd,
      totalNotes,
      lastNoteTime,
      instrumentActivity,
      timeDensity,
      activeInstruments: instrumentActivity.size
    };
  }

  /**
   * Calculate optimal loop based on pattern analysis
   * @param {Object} analysis - Pattern analysis result
   */
  calculateLoopFromAnalysis(analysis) {
    const { maxNoteEnd, lastNoteTime, timeDensity } = analysis;
    
    if (maxNoteEnd === 0) {
      return this.getDefaultLoop();
    }
    
    // Find the effective end (last significant musical activity)
    let effectiveEnd = Math.max(maxNoteEnd, lastNoteTime);
    
    // Add tail if enabled
    if (this.autoSettings.includeEmptyTail) {
      effectiveEnd += this.autoSettings.tailLength;
    }
    
    // Find natural musical boundary
    const naturalEnd = this.findMusicalBoundary(effectiveEnd, timeDensity);
    
    // Apply constraints
    let finalEnd = Math.max(this.autoSettings.minLength, naturalEnd);
    finalEnd = Math.min(this.autoSettings.maxLength, finalEnd);
    
    // Snap to bars if enabled
    if (this.autoSettings.snapToBars) {
      const stepsPerBar = 16;
      finalEnd = Math.ceil(finalEnd / stepsPerBar) * stepsPerBar;
    }
    
    const loop = {
      start: 0,
      end: finalEnd,
      length: finalEnd,
      bars: Math.ceil(finalEnd / 16),
      source: 'auto-calculated',
      confidence: this.calculateConfidence(analysis, finalEnd)
    };
    
    return loop;
  }

  /**
   * Find natural musical boundary (end of phrases, etc.)
   * @param {number} approximateEnd - Rough end position
   * @param {Map} timeDensity - Note density by time window
   */
  findMusicalBoundary(approximateEnd, timeDensity) {
    const stepsPerBar = 16;
    const searchRange = stepsPerBar * 2; // Search ±2 bars
    
    // Find the bar containing approximate end
    const targetBar = Math.floor(approximateEnd / stepsPerBar);
    
    // Look for natural boundaries (low density followed by high density)
    let bestBoundary = approximateEnd;
    let bestScore = 0;
    
    for (let bar = Math.max(0, targetBar - 2); bar <= targetBar + 2; bar++) {
      const barStart = bar * stepsPerBar;
      const barEnd = barStart + stepsPerBar;
      
      const currentDensity = timeDensity.get(barStart) || 0;
      const nextDensity = timeDensity.get(barEnd) || 0;
      const prevDensity = timeDensity.get(barStart - stepsPerBar) || 0;
      
      // Score based on musical phrase logic
      let score = 0;
      
      // End of phrase (high activity followed by low)
      if (prevDensity > currentDensity) score += 2;
      
      // Start of new phrase (low activity followed by high)
      if (currentDensity < nextDensity) score += 1;
      
      // Prefer even bar numbers (2, 4, 6, 8 bar phrases)
      if ((bar + 1) % 2 === 0) score += 0.5;
      if ((bar + 1) % 4 === 0) score += 0.5;
      
      if (score > bestScore) {
        bestScore = score;
        bestBoundary = barEnd;
      }
    }
    
    return bestBoundary;
  }

  /**
   * Calculate confidence in auto-calculated loop
   * @param {Object} analysis - Pattern analysis
   * @param {number} calculatedEnd - Calculated loop end
   */
  calculateConfidence(analysis, calculatedEnd) {
    let confidence = 0.5; // Base confidence
    
    // More notes = higher confidence
    if (analysis.totalNotes > 50) confidence += 0.3;
    else if (analysis.totalNotes > 20) confidence += 0.2;
    else if (analysis.totalNotes > 5) confidence += 0.1;
    
    // Multiple instruments = higher confidence
    if (analysis.activeInstruments > 3) confidence += 0.2;
    else if (analysis.activeInstruments > 1) confidence += 0.1;
    
    // Good time distribution = higher confidence
    const timeSpread = analysis.lastNoteTime / calculatedEnd;
    if (timeSpread > 0.7) confidence += 0.2;
    else if (timeSpread > 0.5) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  // =================== MANUAL LOOP CONTROL ===================

  /**
   * Set loop points manually
   * @param {number} start - Loop start step
   * @param {number} end - Loop end step
   * @param {string} source - Source of change ('user', 'selection', etc.)
   */
  setManualLoop(start, end, source = 'user') {
    const loop = {
      start: Math.max(0, start),
      end: Math.max(start + 1, end),
      length: Math.max(1, end - start),
      bars: Math.ceil((end - start) / 16),
      source: source,
      timestamp: Date.now()
    };
    
    // Store manual override
    const patternId = this.getActivePatternId();
    if (patternId) {
      this.manualOverrides.set(patternId, loop);
    }
    
    // Update current loop
    this.updateCurrentLoop(loop);
    
    console.log(`Manual loop set: ${loop.start} -> ${loop.end} (${source})`);
    return loop;
  }

  /**
   * Clear manual override for current pattern
   */
  clearManualOverride() {
    const patternId = this.getActivePatternId();
    if (patternId && this.manualOverrides.has(patternId)) {
      this.manualOverrides.delete(patternId);
      
      // Recalculate auto loop
      if (this.loopMode === 'auto') {
        this.recalculateLoop();
      }
      
      console.log(`Manual override cleared for pattern: ${patternId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Check if current pattern has manual override
   */
  hasManualOverride(patternId = null) {
    const targetPatternId = patternId || this.getActivePatternId();
    return this.manualOverrides.has(targetPatternId);
  }

  // =================== LOOP UPDATE SYSTEM ===================

  /**
   * Recalculate loop based on current mode and data
   */
  recalculateLoop() {
    let newLoop;
    
    switch (this.loopMode) {
      case 'auto':
        newLoop = this.calculateLoopFromPattern();
        break;
        
      case 'manual':
        const patternId = this.getActivePatternId();
        newLoop = this.manualOverrides.get(patternId) || this.currentLoop;
        break;
        
      case 'selection':
        // Use timeline selection if available
        newLoop = this.getSelectionLoop() || this.currentLoop;
        break;
        
      default:
        newLoop = this.currentLoop;
    }
    
    this.updateCurrentLoop(newLoop);
    return newLoop;
  }

  /**
   * Update current loop and notify engine
   * @param {Object} newLoop - New loop configuration
   */
  updateCurrentLoop(newLoop) {
    const previousLoop = { ...this.currentLoop };
    this.currentLoop = { ...newLoop };
    
    // Update engine if available
    if (this.engine.playbackManager) {
      this.engine.playbackManager.setLoopPoints(newLoop.start, newLoop.end);
      this.engine.playbackManager.setLoopEnabled(true);
    }
    
    // Emit change event
    this.eventBus.emit('loopChanged', {
      previous: previousLoop,
      current: this.currentLoop,
      mode: this.loopMode
    });
    
    console.log(`Loop updated: ${this.currentLoop.start} -> ${this.currentLoop.end} (${this.loopMode})`);
  }

  // =================== PATTERN CHANGE LISTENERS ===================

  /**
   * Setup listeners for pattern changes
   */
  setupPatternListeners() {
    this.eventBus.on('activePatternChanged', (patternId) => {
      this.handleActivePatternChange(patternId);
    });
    
    this.eventBus.on('patternContentChanged', (data) => {
      this.handlePatternContentChange(data.patternId);
    });
    
    this.eventBus.on('patternNotesUpdated', (data) => {
      this.handlePatternContentChange(data.patternId);
    });
  }

  /**
   * Handle active pattern change
   */
  handleActivePatternChange(patternId) {
    // Clear cache for new pattern
    this.clearAnalysisCache(patternId);
    
    // Recalculate loop
    this.recalculateLoop();
    
    console.log(`Active pattern changed: ${patternId}, loop recalculated`);
  }

  /**
   * Handle pattern content change  
   */
  handlePatternContentChange(patternId) {
    // Clear cache for changed pattern
    this.clearAnalysisCache(patternId);
    
    // Only recalculate if this is the active pattern and in auto mode
    const activePatternId = this.getActivePatternId();
    if (patternId === activePatternId && this.loopMode === 'auto') {
      this.recalculateLoop();
    }
    
    console.log(`Pattern content changed: ${patternId}`);
  }

  /**
   * Handle transport loop event
   * Called when transport completes a loop cycle
   * @param {Object} data - Loop event data from transport
   */
  handleTransportLoop(data) {
    // This method is called when transport fires a 'loop' event
    // We can use this to update loop state or trigger recalculation if needed
    
    // If in auto mode and pattern content has changed, recalculate
    if (this.loopMode === 'auto') {
      const activePatternId = this.getActivePatternId();
      if (activePatternId) {
        // Clear cache to force fresh analysis on next calculation
        this.clearAnalysisCache(activePatternId);
      }
    }
    
    // Emit loop event for other listeners
    this.eventBus.emit('transportLoopHandled', {
      loop: this.currentLoop,
      data: data
    });
    
    // Log in dev mode only
    if (import.meta.env.DEV) {
      console.log('Transport loop handled by DynamicLoopManager:', {
        currentLoop: this.currentLoop,
        mode: this.loopMode
      });
    }
  }

  // =================== UTILITY METHODS ===================

  /**
   * Get active pattern ID from arrangement store
   */
  getActivePatternId() {
    // This would typically come from a store
    return this.engine.activePatternId || null;
  }

  /**
   * Get pattern data
   */
  getPatternData(patternId) {
    // This would typically come from a store
    return this.engine.patterns?.get(patternId) || null;
  }

  /**
   * Get selection-based loop from timeline
   */
  getSelectionLoop() {
    // This would come from timeline selection API
    return null; // Placeholder
  }

  /**
   * Get default loop configuration
   */
  getDefaultLoop() {
    return {
      start: 0,
      end: 64,
      length: 64,
      bars: 4,
      source: 'default'
    };
  }

  /**
   * Parse duration string to steps
   * @param {string|number} duration - Duration in various formats
   */
  parseDuration(duration) {
    if (typeof duration === 'number') return duration;
    if (!duration) return 1;
    
    // Simple duration parsing (can be enhanced)
    const durationMap = {
      '4n': 4, '8n': 2, '16n': 1, '32n': 0.5,
      '2n': 8, '1n': 16
    };
    
    return durationMap[duration] || 1;
  }

  /**
   * Clear analysis cache
   */
  clearAnalysisCache(patternId = null) {
    if (patternId) {
      this.patternAnalysisCache.delete(patternId);
    } else {
      this.patternAnalysisCache.clear();
    }
  }

  // =================== CONFIGURATION ===================

  /**
   * Update auto-calculation settings
   * @param {Object} settings - New settings
   */
  updateAutoSettings(settings) {
    this.autoSettings = { ...this.autoSettings, ...settings };
    
    // Recalculate if in auto mode
    if (this.loopMode === 'auto') {
      this.recalculateLoop();
    }
    
    console.log('Auto-calculation settings updated:', settings);
  }

  /**
   * Get current auto settings
   */
  getAutoSettings() {
    return { ...this.autoSettings };
  }

  // =================== STATUS & DEBUG ===================

  /**
   * Get current loop info
   */
  getCurrentLoop() {
    return { ...this.currentLoop };
  }

  /**
   * Get detailed status
   */
  getStatus() {
    return {
      mode: this.loopMode,
      currentLoop: this.getCurrentLoop(),
      hasManualOverride: this.hasManualOverride(),
      cacheSize: this.patternAnalysisCache.size,
      manualOverrides: this.manualOverrides.size,
      autoSettings: this.getAutoSettings()
    };
  }

  /**
   * Export loop data for saving
   */
  exportLoopData() {
    return {
      mode: this.loopMode,
      currentLoop: this.currentLoop,
      manualOverrides: Object.fromEntries(this.manualOverrides),
      autoSettings: this.autoSettings
    };
  }

  /**
   * Import loop data from save
   */
  importLoopData(data) {
    if (data.mode) this.loopMode = data.mode;
    if (data.currentLoop) this.currentLoop = data.currentLoop;
    if (data.autoSettings) this.autoSettings = data.autoSettings;
    
    if (data.manualOverrides) {
      this.manualOverrides.clear();
      Object.entries(data.manualOverrides).forEach(([key, value]) => {
        this.manualOverrides.set(key, value);
      });
    }
    
    console.log('Loop data imported');
  }

  // =================== CLEANUP ===================

  /**
   * Dispose dynamic loop manager
   */
  dispose() {
    this.patternAnalysisCache.clear();
    this.manualOverrides.clear();
    this.eventBus.removeAllListeners();
    
    console.log('Dynamic Loop Manager disposed');
  }
}

export default DynamicLoopManager;