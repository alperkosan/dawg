/**
 * PresetManager - Unified Preset System
 *
 * Handles loading, saving, and managing presets for all plugins
 *
 * @version 1.0.0
 * @date 2025-10-09
 */

/**
 * Preset structure:
 * {
 *   id: string,
 *   name: string,
 *   category: string,
 *   description: string,
 *   icon: string,
 *   color: string,
 *   parameters: Object,
 *   metadata: {
 *     author: string,
 *     date: number,
 *     version: string,
 *     tags: string[]
 *   }
 * }
 */

export class PresetManager {
  constructor(pluginType) {
    this.pluginType = pluginType;
    this.presets = new Map();
    this.userPresets = new Map();
    this.currentPreset = null;
  }

  /**
   * Register factory presets
   * @param {Array} presets - Array of preset objects
   */
  registerFactoryPresets(presets) {
    presets.forEach(preset => {
      this.presets.set(preset.id, {
        ...preset,
        isFactory: true,
        isUser: false
      });
    });
    console.log(`📦 Registered ${presets.length} factory presets for ${this.pluginType}`);
  }

  /**
   * Load user presets from localStorage
   */
  loadUserPresets() {
    try {
      const stored = localStorage.getItem(`presets:${this.pluginType}`);
      if (stored) {
        const userPresets = JSON.parse(stored);
        userPresets.forEach(preset => {
          this.userPresets.set(preset.id, {
            ...preset,
            isFactory: false,
            isUser: true
          });
        });
        console.log(`👤 Loaded ${userPresets.length} user presets for ${this.pluginType}`);
      }
    } catch (error) {
      console.error('❌ Failed to load user presets:', error);
    }
  }

  /**
   * Save user presets to localStorage
   */
  saveUserPresets() {
    try {
      const userPresets = Array.from(this.userPresets.values());
      localStorage.setItem(`presets:${this.pluginType}`, JSON.stringify(userPresets));
      console.log(`💾 Saved ${userPresets.length} user presets for ${this.pluginType}`);
    } catch (error) {
      console.error('❌ Failed to save user presets:', error);
    }
  }

  /**
   * Get all presets (factory + user)
   * @param {Object} filters - Filter options
   * @returns {Array} Filtered presets
   */
  getAllPresets(filters = {}) {
    const allPresets = [
      ...Array.from(this.presets.values()),
      ...Array.from(this.userPresets.values())
    ];

    let filtered = allPresets;

    // Filter by category
    if (filters.category) {
      filtered = filtered.filter(p => p.category === filters.category);
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(p =>
        p.metadata?.tags?.some(tag => filters.tags.includes(tag))
      );
    }

    // Search by name/description
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }

  /**
   * Get preset by ID
   * @param {string} id - Preset ID
   * @returns {Object|null} Preset object
   */
  getPreset(id) {
    return this.presets.get(id) || this.userPresets.get(id) || null;
  }

  /**
   * Get presets by category
   * @param {string} category - Category name
   * @returns {Array} Presets in category
   */
  getPresetsByCategory(category) {
    return this.getAllPresets({ category });
  }

  /**
   * Save user preset
   * @param {string} name - Preset name
   * @param {Object} parameters - Parameter values
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Saved preset
   */
  saveUserPreset(name, parameters, metadata = {}) {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const preset = {
      id,
      name,
      category: metadata.category || 'User',
      description: metadata.description || '',
      icon: metadata.icon || '⭐',
      color: metadata.color || 'purple',
      parameters,
      metadata: {
        author: metadata.author || 'User',
        date: Date.now(),
        version: '1.0.0',
        tags: metadata.tags || [],
        ...metadata
      },
      isFactory: false,
      isUser: true
    };

    this.userPresets.set(id, preset);
    this.saveUserPresets();

    console.log(`✅ User preset saved: ${name}`);
    return preset;
  }

  /**
   * Update existing user preset
   * @param {string} id - Preset ID
   * @param {Object} updates - Updated values
   * @returns {boolean} Success status
   */
  updateUserPreset(id, updates) {
    const preset = this.userPresets.get(id);
    if (!preset) {
      console.warn(`⚠️ Preset not found: ${id}`);
      return false;
    }

    const updated = {
      ...preset,
      ...updates,
      metadata: {
        ...preset.metadata,
        ...updates.metadata,
        dateModified: Date.now()
      }
    };

    this.userPresets.set(id, updated);
    this.saveUserPresets();

    console.log(`✅ User preset updated: ${id}`);
    return true;
  }

  /**
   * Delete user preset
   * @param {string} id - Preset ID
   * @returns {boolean} Success status
   */
  deleteUserPreset(id) {
    const preset = this.userPresets.get(id);
    if (!preset) {
      console.warn(`⚠️ Preset not found: ${id}`);
      return false;
    }

    this.userPresets.delete(id);
    this.saveUserPresets();

    console.log(`🗑️ User preset deleted: ${id}`);
    return true;
  }

  /**
   * Export preset to JSON
   * @param {string} id - Preset ID
   * @returns {string} JSON string
   */
  exportPreset(id) {
    const preset = this.getPreset(id);
    if (!preset) {
      throw new Error(`Preset not found: ${id}`);
    }

    return JSON.stringify({
      dawg_preset: true,
      pluginType: this.pluginType,
      preset: {
        name: preset.name,
        category: preset.category,
        description: preset.description,
        icon: preset.icon,
        color: preset.color,
        parameters: preset.parameters,
        metadata: preset.metadata
      }
    }, null, 2);
  }

  /**
   * Import preset from JSON
   * @param {string} json - JSON string
   * @returns {Object} Imported preset
   */
  importPreset(json) {
    try {
      const data = JSON.parse(json);

      if (!data.dawg_preset) {
        throw new Error('Invalid preset format');
      }

      if (data.pluginType !== this.pluginType) {
        throw new Error(`Preset is for ${data.pluginType}, not ${this.pluginType}`);
      }

      const preset = data.preset;
      return this.saveUserPreset(
        preset.name,
        preset.parameters,
        preset.metadata
      );
    } catch (error) {
      console.error('❌ Failed to import preset:', error);
      throw error;
    }
  }

  /**
   * Set current active preset
   * @param {string} id - Preset ID
   */
  setCurrentPreset(id) {
    this.currentPreset = id;
  }

  /**
   * Get current active preset
   * @returns {Object|null} Current preset
   */
  getCurrentPreset() {
    return this.currentPreset ? this.getPreset(this.currentPreset) : null;
  }

  /**
   * Apply preset parameters to plugin
   * @param {string} id - Preset ID
   * @param {Function} applyCallback - Function to apply parameters
   * @returns {boolean} Success status
   */
  applyPreset(id, applyCallback) {
    const preset = this.getPreset(id);
    if (!preset) {
      console.warn(`⚠️ Preset not found: ${id}`);
      return false;
    }

    try {
      applyCallback(preset.parameters);
      this.setCurrentPreset(id);
      console.log(`🎨 Applied preset: ${preset.name}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to apply preset:', error);
      return false;
    }
  }

  /**
   * Get preset categories with counts
   * @returns {Array} Categories with preset counts
   */
  getCategories() {
    const categories = new Map();

    this.getAllPresets().forEach(preset => {
      const category = preset.category || 'Uncategorized';
      const count = categories.get(category) || 0;
      categories.set(category, count + 1);
    });

    return Array.from(categories.entries()).map(([name, count]) => ({
      name,
      count
    }));
  }
}

/**
 * Create preset manager instance for a plugin
 * @param {string} pluginType - Plugin type identifier
 * @param {Array} factoryPresets - Factory preset definitions
 * @returns {PresetManager} Preset manager instance
 */
export function createPresetManager(pluginType, factoryPresets = []) {
  const manager = new PresetManager(pluginType);
  manager.registerFactoryPresets(factoryPresets);
  manager.loadUserPresets();
  return manager;
}
