/**
 * PRESET MANAGER v2.0 - Unified Preset System
 *
 * Centralized preset management for all plugins
 * Replaces fragmented preset systems with single source of truth
 *
 * Features:
 * - Factory presets (bundled with plugins)
 * - User presets (localStorage + optional cloud sync)
 * - A/B comparison states
 * - Import/Export functionality
 * - Preset browser with search/filter
 * - Tag-based organization
 * - Undo/Redo support
 *
 * Usage:
 *   const presetManager = new PresetManager('Compressor', 'dynamics-forge');
 *   await presetManager.savePreset('My Vocal Comp', ['vocal', 'gentle']);
 *   presetManager.loadPreset(presetId);
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * PRESET STORAGE
 *
 * Handles persistence layer (localStorage + cloud)
 */
class PresetStorage {
  constructor() {
    this.storageKey = 'dawg_presets_v2';
    this.cloudSyncEnabled = false; // Future feature
  }

  /**
   * Load all presets for a plugin type
   */
  load(pluginType) {
    try {
      // Load user presets (standard)
      const allPresets = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      const userPresets = allPresets[pluginType] || [];

      // Load downloaded presets (community)
      const downloadedPresets = JSON.parse(localStorage.getItem('downloaded_presets') || '[]');

      const filteredDownloads = downloadedPresets
        .filter(p => {
          // 1. Direct engine match (case-insensitive)
          const engineMatch = p.engineType?.toLowerCase() === pluginType?.toLowerCase();

          // 2. Strict category match for specific plugin types
          // If we're an instrument, we only want instrument presets
          const isInstrument = ['zenith', 'sampler', 'sample', 'vasynth', 'synth'].includes(pluginType?.toLowerCase());

          const categoryMatch = isInstrument
            ? p.presetType === 'instrument'
            : p.presetType === 'effect';

          // 3. Fallback for "generic" entries (legacy or mislabeled)
          // Allow 'zenith' as a fallback engine ONLY for instruments
          const fallbackMatch = (p.engineType?.toLowerCase() === 'zenith' || !p.engineType) &&
            (isInstrument && p.presetType === 'instrument');

          return engineMatch || (categoryMatch && (engineMatch || fallbackMatch));
        })
        .map(p => ({
          ...p,
          id: p.id,
          name: p.name,
          settings: p.presetData || p.settings, // Uniform settings key
          isDownloaded: true,
          author: p.author || 'Community'
        }));

      return [...userPresets, ...filteredDownloads];
    } catch (e) {
      console.error('Failed to load presets:', e);
      return [];
    }
  }

  /**
   * Save a preset
   */
  save(pluginType, preset) {
    try {
      const allPresets = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      if (!allPresets[pluginType]) {
        allPresets[pluginType] = [];
      }

      // Update existing or add new
      const existingIndex = allPresets[pluginType].findIndex(p => p.id === preset.id);
      if (existingIndex >= 0) {
        allPresets[pluginType][existingIndex] = preset;
      } else {
        allPresets[pluginType].push(preset);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(allPresets));
      return true;
    } catch (e) {
      console.error('Failed to save preset:', e);
      return false;
    }
  }

  /**
   * Delete a preset
   */
  delete(pluginType, presetId) {
    try {
      // Try deleting from standard user presets
      const allPresets = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      if (allPresets[pluginType]) {
        const initialCount = allPresets[pluginType].length;
        allPresets[pluginType] = allPresets[pluginType].filter(p => p.id !== presetId);

        if (allPresets[pluginType].length < initialCount) {
          localStorage.setItem(this.storageKey, JSON.stringify(allPresets));
          return true;
        }
      }

      // Try deleting from downloaded presets
      const downloadedPresets = JSON.parse(localStorage.getItem('downloaded_presets') || '[]');
      const initialDownloadCount = downloadedPresets.length;
      const filteredDownloads = downloadedPresets.filter(p => p.id !== presetId);

      if (filteredDownloads.length < initialDownloadCount) {
        localStorage.setItem('downloaded_presets', JSON.stringify(filteredDownloads));
        return true;
      }

      return false;
    } catch (e) {
      console.error('Failed to delete preset:', e);
      return false;
    }
  }

  /**
   * Clear all presets for a plugin type
   */
  clearAll(pluginType) {
    try {
      const allPresets = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      delete allPresets[pluginType];
      localStorage.setItem(this.storageKey, JSON.stringify(allPresets));
      return true;
    } catch (e) {
      console.error('Failed to clear presets:', e);
      return false;
    }
  }
}

/**
 * PRESET MANAGER
 *
 * Main preset management service
 */
export class PresetManager {
  constructor(pluginType, categoryKey, factoryPresets = []) {
    this.pluginType = pluginType;
    this.category = categoryKey;
    this.factoryPresets = factoryPresets;
    this.storage = new PresetStorage();

    // A/B comparison states
    this.abStates = {
      A: null,
      B: null,
      current: 'A'
    };

    // Undo/Redo stacks
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistorySize = 50;

    // Event listeners
    this.listeners = {
      'preset-loaded': [],
      'preset-saved': [],
      'preset-deleted': [],
      'state-changed': []
    };

    // Current state
    this.currentSettings = null;
    this.currentPreset = null; // Track loaded preset
  }

  /**
   * EVENT SYSTEM
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  /**
   * PRESET RETRIEVAL
   */

  /**
   * Get all factory presets
   */
  getFactoryPresets() {
    return this.factoryPresets.map(preset => ({
      ...preset,
      isFactory: true,
      canDelete: false,
      canEdit: false
    }));
  }

  /**
   * Get all user presets
   */
  getUserPresets() {
    return this.storage.load(this.pluginType).map(preset => ({
      ...preset,
      isFactory: false,
      canDelete: true,
      canEdit: true
    }));
  }

  /**
   * Get all presets (factory + user)
   */
  getAllPresets() {
    return [...this.getFactoryPresets(), ...this.getUserPresets()];
  }

  /**
   * Find a preset by ID
   */
  findPreset(presetId) {
    const allPresets = this.getAllPresets();
    return allPresets.find(p => p.id === presetId);
  }

  /**
   * Search presets by name/tags
   * Returns { factory: [], user: [] }
   */
  searchPresets(query, filters = {}) {
    let allPresets = this.getAllPresets();

    // Text search (name + description)
    if (query) {
      const lowerQuery = query.toLowerCase();
      allPresets = allPresets.filter(p =>
        p.name.toLowerCase().includes(lowerQuery) ||
        (p.description && p.description.toLowerCase().includes(lowerQuery)) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
      );
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      allPresets = allPresets.filter(p =>
        p.tags && filters.tags.some(tag => p.tags.includes(tag))
      );
    }

    // Filter by author
    if (filters.author) {
      allPresets = allPresets.filter(p => p.author === filters.author);
    }

    // Filter by category
    if (filters.category) {
      allPresets = allPresets.filter(p => p.category === filters.category);
    }

    // Split into factory and user
    return {
      factory: allPresets.filter(p => p.isFactory),
      user: allPresets.filter(p => !p.isFactory)
    };
  }

  /**
   * PRESET MANIPULATION
   */

  /**
   * Save current state as preset
   */
  async savePreset(name, tags = [], description = '') {
    if (!this.currentSettings) {
      throw new Error('No current settings to save');
    }

    const preset = {
      id: uuidv4(),
      name,
      tags,
      description,
      category: this.category,
      settings: { ...this.currentSettings },
      author: 'User',
      timestamp: Date.now(),
      version: '2.0'
    };

    const success = this.storage.save(this.pluginType, preset);

    if (success) {
      this.emit('preset-saved', preset);
      return preset;
    } else {
      throw new Error('Failed to save preset');
    }
  }

  /**
   * Update existing preset
   */
  async updatePreset(presetId, updates) {
    const preset = this.findPreset(presetId);
    if (!preset) {
      throw new Error('Preset not found');
    }

    if (preset.isFactory) {
      throw new Error('Cannot edit factory presets');
    }

    const updatedPreset = {
      ...preset,
      ...updates,
      timestamp: Date.now()
    };

    const success = this.storage.save(this.pluginType, updatedPreset);

    if (success) {
      this.emit('preset-saved', updatedPreset);
      return updatedPreset;
    } else {
      throw new Error('Failed to update preset');
    }
  }

  /**
   * Delete preset
   */
  async deletePreset(presetId) {
    const preset = this.findPreset(presetId);
    if (!preset) {
      throw new Error('Preset not found');
    }

    if (preset.isFactory) {
      throw new Error('Cannot delete factory presets');
    }

    const success = this.storage.delete(this.pluginType, presetId);

    if (success) {
      this.emit('preset-deleted', presetId);
      return true;
    } else {
      throw new Error('Failed to delete preset');
    }
  }

  /**
   * Load preset
   */
  loadPreset(presetId, applyCallback) {
    const preset = this.findPreset(presetId);
    if (!preset) {
      throw new Error('Preset not found');
    }

    // Save to undo stack
    if (this.currentSettings) {
      this.pushToUndoStack(this.currentSettings);
    }

    // Apply settings
    this.currentSettings = { ...preset.settings };
    this.currentPreset = preset; // Track loaded preset

    if (applyCallback) {
      applyCallback(this.currentSettings);
    }

    this.emit('preset-loaded', preset);
    this.emit('state-changed', this.currentSettings);

    return preset;
  }

  /**
   * Get currently loaded preset (or null if custom)
   */
  getCurrentPreset() {
    return this.currentPreset || null;
  }

  /**
   * Get all unique tags from all presets
   */
  getAllTags() {
    const allPresets = this.getAllPresets();
    const tagSet = new Set();

    allPresets.forEach(preset => {
      if (preset.tags && Array.isArray(preset.tags)) {
        preset.tags.forEach(tag => tagSet.add(tag));
      }
    });

    return Array.from(tagSet).sort();
  }

  /**
   * IMPORT/EXPORT
   */

  /**
   * Export preset to JSON string
   */
  exportPreset(presetId) {
    const preset = this.findPreset(presetId);
    if (!preset) {
      throw new Error('Preset not found');
    }

    return JSON.stringify(preset, null, 2);
  }

  /**
   * Export all user presets
   */
  exportAllPresets() {
    const userPresets = this.getUserPresets();
    return JSON.stringify({
      pluginType: this.pluginType,
      category: this.category,
      presets: userPresets,
      exportDate: new Date().toISOString(),
      version: '2.0'
    }, null, 2);
  }

  /**
   * Import preset from JSON string
   */
  async importPreset(jsonString) {
    try {
      const preset = JSON.parse(jsonString);

      // Validate preset structure
      if (!preset.name || !preset.settings) {
        throw new Error('Invalid preset format');
      }

      // Generate new ID to avoid conflicts
      const newPreset = {
        ...preset,
        id: uuidv4(),
        timestamp: Date.now(),
        author: preset.author || 'Imported'
      };

      const success = this.storage.save(this.pluginType, newPreset);

      if (success) {
        this.emit('preset-saved', newPreset);
        return newPreset;
      } else {
        throw new Error('Failed to import preset');
      }
    } catch (e) {
      throw new Error(`Import failed: ${e.message}`);
    }
  }

  /**
   * Import multiple presets
   */
  async importPresets(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      if (!data.presets || !Array.isArray(data.presets)) {
        throw new Error('Invalid preset pack format');
      }

      const imported = [];
      for (const preset of data.presets) {
        try {
          const newPreset = await this.importPreset(JSON.stringify(preset));
          imported.push(newPreset);
        } catch (e) {
          console.error(`Failed to import preset "${preset.name}":`, e);
        }
      }

      return imported;
    } catch (e) {
      throw new Error(`Import failed: ${e.message}`);
    }
  }

  /**
   * A/B COMPARISON
   */

  /**
   * Snapshot current state to A or B
   */
  snapshotState(slot) {
    if (slot !== 'A' && slot !== 'B') {
      throw new Error('Slot must be A or B');
    }

    this.abStates[slot] = { ...this.currentSettings };
    console.log(`📸 Snapshot saved to ${slot}`);
  }

  /**
   * Recall A or B state
   */
  recallState(slot, applyCallback) {
    if (slot !== 'A' && slot !== 'B') {
      throw new Error('Slot must be A or B');
    }

    if (!this.abStates[slot]) {
      throw new Error(`No state saved in slot ${slot}`);
    }

    this.currentSettings = { ...this.abStates[slot] };
    this.abStates.current = slot;

    if (applyCallback) {
      applyCallback(this.currentSettings);
    }

    this.emit('state-changed', this.currentSettings);
    console.log(`🔄 Recalled state from ${slot}`);
  }

  /**
   * Copy A to B (or vice versa)
   */
  copyState(from, to) {
    if (!['A', 'B'].includes(from) || !['A', 'B'].includes(to)) {
      throw new Error('Slots must be A or B');
    }

    if (!this.abStates[from]) {
      throw new Error(`No state in slot ${from}`);
    }

    this.abStates[to] = { ...this.abStates[from] };
    console.log(`📋 Copied ${from} → ${to}`);
  }

  /**
   * Get current A/B slot
   */
  getCurrentABSlot() {
    return this.abStates.current || 'A';
  }

  /**
   * Get A/B state
   */
  getABState(slot) {
    if (slot !== 'A' && slot !== 'B') {
      throw new Error('Slot must be A or B');
    }
    return this.abStates[slot];
  }

  /**
   * UNDO/REDO
   */

  /**
   * Push state to undo stack
   */
  pushToUndoStack(state) {
    this.undoStack.push({ ...state });

    // Limit stack size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }

    // Clear redo stack on new action
    this.redoStack = [];
  }

  /**
   * Undo last action
   */
  undo(applyCallback) {
    if (this.undoStack.length === 0) {
      throw new Error('Nothing to undo');
    }

    // Push current to redo stack
    this.redoStack.push({ ...this.currentSettings });

    // Pop from undo stack
    const previousState = this.undoStack.pop();
    this.currentSettings = previousState;

    if (applyCallback) {
      applyCallback(this.currentSettings);
    }

    this.emit('state-changed', this.currentSettings);
    console.log('↩️ Undo');
  }

  /**
   * Redo last undone action
   */
  redo(applyCallback) {
    if (this.redoStack.length === 0) {
      throw new Error('Nothing to redo');
    }

    // Push current to undo stack
    this.undoStack.push({ ...this.currentSettings });

    // Pop from redo stack
    const nextState = this.redoStack.pop();
    this.currentSettings = nextState;

    if (applyCallback) {
      applyCallback(this.currentSettings);
    }

    this.emit('state-changed', this.currentSettings);
    console.log('↪️ Redo');
  }

  /**
   * Check if undo/redo available
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * UTILITY METHODS
   */

  /**
   * Set current settings (for external updates)
   */
  setCurrentSettings(settings) {
    if (this.currentSettings) {
      this.pushToUndoStack(this.currentSettings);
    }

    this.currentSettings = { ...settings };
    this.emit('state-changed', this.currentSettings);
  }

  /**
   * Get current settings
   */
  getCurrentSettings() {
    return this.currentSettings;
  }

  /**
   * Reset to default settings
   */
  reset(defaultSettings, applyCallback) {
    if (this.currentSettings) {
      this.pushToUndoStack(this.currentSettings);
    }

    this.currentSettings = { ...defaultSettings };

    if (applyCallback) {
      applyCallback(this.currentSettings);
    }

    this.emit('state-changed', this.currentSettings);
  }

  /**
   * Get preset statistics
   */
  getStats() {
    const userPresets = this.getUserPresets();
    const factoryPresets = this.getFactoryPresets();

    return {
      totalPresets: userPresets.length + factoryPresets.length,
      userPresets: userPresets.length,
      factoryPresets: factoryPresets.length,
      categories: [...new Set(this.getAllPresets().map(p => p.category))],
      tags: [...new Set(this.getAllPresets().flatMap(p => p.tags || []))],
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length
    };
  }
}

/**
 * PRESET MANAGER FACTORY
 *
 * Create preset managers with factory presets
 */
export const createPresetManager = (pluginType, categoryKey, factoryPresets = []) => {
  return new PresetManager(pluginType, categoryKey, factoryPresets);
};

/**
 * GLOBAL PRESET REGISTRY
 *
 * Singleton registry for accessing preset managers
 */
class PresetRegistry {
  constructor() {
    this.managers = new Map();
  }

  /**
   * Get or create preset manager for plugin
   */
  getManager(pluginType, categoryKey, factoryPresets = []) {
    if (!this.managers.has(pluginType)) {
      this.managers.set(
        pluginType,
        new PresetManager(pluginType, categoryKey, factoryPresets)
      );
    }
    return this.managers.get(pluginType);
  }

  /**
   * Clear all managers
   */
  clear() {
    this.managers.clear();
  }
}

export const presetRegistry = new PresetRegistry();
