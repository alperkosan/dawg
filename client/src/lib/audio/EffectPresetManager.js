/**
 * EFFECT PRESET MANAGER
 *
 * Manages saving, loading, and sharing custom effect presets
 */

export class EffectPresetManager {
  constructor() {
    this.storageKey = 'dawg_custom_effects';
    this.presets = this.loadPresetsFromStorage();
  }

  /**
   * Load presets from localStorage
   */
  loadPresetsFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : this.getDefaultPresets();
    } catch (error) {
      console.error('Failed to load presets:', error);
      return this.getDefaultPresets();
    }
  }

  /**
   * Save presets to localStorage
   */
  savePresetsToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.presets));
      console.log('✅ Presets saved to storage');
    } catch (error) {
      console.error('Failed to save presets:', error);
    }
  }

  /**
   * Get default/example presets
   */
  getDefaultPresets() {
    return [
      {
        id: 'warm_saturation',
        name: 'Warm Saturation',
        author: 'DAWG',
        description: 'Gentle tube saturation with subtle filtering',
        dspChain: [
          { type: 'filter', params: { type: 'highpass', frequency: 80, q: 0.7 } },
          { type: 'saturator', params: { drive: 1.8 } },
          { type: 'filter', params: { type: 'lowpass', frequency: 8000, q: 0.7 } }
        ],
        tags: ['saturation', 'warmth', 'analog'],
        createdAt: Date.now()
      },
      {
        id: 'space_echo',
        name: 'Space Echo',
        author: 'DAWG',
        description: 'Vintage tape echo with modulation',
        dspChain: [
          { type: 'delay', params: { time: 0.375, feedback: 0.45 } },
          { type: 'saturator', params: { drive: 1.2 } },
          { type: 'filter', params: { type: 'lowpass', frequency: 3500, q: 1.0 } }
        ],
        tags: ['delay', 'vintage', 'modulation'],
        createdAt: Date.now()
      },
      {
        id: 'shimmer_verb',
        name: 'Shimmer Reverb',
        author: 'DAWG',
        description: 'Ethereal reverb with high-frequency emphasis',
        dspChain: [
          { type: 'filter', params: { type: 'highpass', frequency: 500, q: 1.0 } },
          { type: 'reverb', params: { decay: 5.0 } },
          { type: 'gain', params: { amount: 0.7 } }
        ],
        tags: ['reverb', 'ambient', 'shimmer'],
        createdAt: Date.now()
      },
      {
        id: 'pumping_compressor',
        name: 'Pumping Compressor',
        author: 'DAWG',
        description: 'Heavy compression with fast attack',
        dspChain: [
          { type: 'compressor', params: { threshold: -18, ratio: 8, attack: 0.001, release: 0.1 } },
          { type: 'gain', params: { amount: 1.5 } }
        ],
        tags: ['compression', 'dynamics', 'pumping'],
        createdAt: Date.now()
      }
    ];
  }

  /**
   * Get all presets
   */
  getAllPresets() {
    return this.presets;
  }

  /**
   * Get preset by ID
   */
  getPreset(id) {
    return this.presets.find(p => p.id === id);
  }

  /**
   * Save new preset
   */
  savePreset(preset) {
    const newPreset = {
      id: preset.id || `custom_${Date.now()}`,
      name: preset.name || 'Untitled Effect',
      author: preset.author || 'User',
      description: preset.description || '',
      dspChain: preset.dspChain || [],
      tags: preset.tags || [],
      createdAt: Date.now()
    };

    // Check if preset already exists (update)
    const existingIndex = this.presets.findIndex(p => p.id === newPreset.id);
    if (existingIndex !== -1) {
      this.presets[existingIndex] = { ...this.presets[existingIndex], ...newPreset };
    } else {
      this.presets.push(newPreset);
    }

    this.savePresetsToStorage();
    return newPreset;
  }

  /**
   * Delete preset
   */
  deletePreset(id) {
    this.presets = this.presets.filter(p => p.id !== id);
    this.savePresetsToStorage();
  }

  /**
   * Search presets by tag
   */
  searchByTag(tag) {
    return this.presets.filter(p => p.tags.includes(tag));
  }

  /**
   * Search presets by name
   */
  searchByName(query) {
    const lowerQuery = query.toLowerCase();
    return this.presets.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Export preset as JSON
   */
  exportPreset(id) {
    const preset = this.getPreset(id);
    if (!preset) return null;

    const json = JSON.stringify(preset, null, 2);
    return json;
  }

  /**
   * Import preset from JSON
   */
  importPreset(jsonString) {
    try {
      const preset = JSON.parse(jsonString);

      // Validate preset structure
      if (!preset.dspChain || !Array.isArray(preset.dspChain)) {
        throw new Error('Invalid preset format: missing dspChain');
      }

      return this.savePreset(preset);
    } catch (error) {
      console.error('Failed to import preset:', error);
      throw error;
    }
  }

  /**
   * Duplicate preset
   */
  duplicatePreset(id) {
    const original = this.getPreset(id);
    if (!original) return null;

    const duplicate = {
      ...original,
      id: `custom_${Date.now()}`,
      name: `${original.name} (Copy)`,
      createdAt: Date.now()
    };

    return this.savePreset(duplicate);
  }

  /**
   * Get all unique tags
   */
  getAllTags() {
    const tagSet = new Set();
    this.presets.forEach(preset => {
      preset.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }
}

// Singleton instance
export const effectPresetManager = new EffectPresetManager();
