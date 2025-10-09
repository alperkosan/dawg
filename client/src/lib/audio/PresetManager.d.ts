/**
 * TypeScript definitions for PresetManager
 *
 * Provides type safety for preset management system
 *
 * @version 2.0.0
 * @date 2025-10-09
 */

/**
 * Preset metadata
 */
export interface PresetMetadata {
  /**
   * Preset category for organization
   * @example 'Init', 'Utility', 'Creative', 'User'
   */
  category: string;

  /**
   * Preset description
   */
  description?: string;

  /**
   * Tags for searching
   */
  tags?: string[];

  /**
   * Preset author
   */
  author?: string;

  /**
   * Preset version
   */
  version?: string;

  /**
   * Creation timestamp (ISO 8601)
   */
  createdAt?: string;

  /**
   * Last modified timestamp (ISO 8601)
   */
  modifiedAt?: string;
}

/**
 * Plugin preset definition
 */
export interface Preset<T = Record<string, any>> {
  /**
   * Unique preset ID
   */
  id: string;

  /**
   * Preset display name
   */
  name: string;

  /**
   * Preset category
   */
  category: string;

  /**
   * Plugin parameter values
   */
  parameters: T;

  /**
   * Optional description
   */
  description?: string;

  /**
   * Optional metadata
   */
  metadata?: PresetMetadata;

  /**
   * Whether this is a factory preset (read-only)
   */
  isFactory?: boolean;
}

/**
 * Presets organized by category
 */
export type PresetsByCategory<T = Record<string, any>> = Record<string, Preset<T>[]>;

/**
 * Callback function for applying preset parameters
 */
export type ApplyPresetCallback<T = Record<string, any>> = (parameters: T) => void;

/**
 * PresetManager - Unified preset management system
 *
 * Handles:
 * - Factory presets (built-in, read-only)
 * - User presets (saved, editable)
 * - localStorage persistence
 * - Import/export to JSON
 * - Category organization
 *
 * @example
 * ```typescript
 * // Create preset manager
 * const presetManager = createPresetManager('my-plugin', [
 *   {
 *     id: 'default',
 *     name: 'Default',
 *     category: 'Init',
 *     parameters: { gain: 0.5, tone: 0.5 }
 *   }
 * ]);
 *
 * // Save user preset
 * const presetId = presetManager.saveUserPreset(
 *   'My Preset',
 *   { gain: 0.8, tone: 0.3 },
 *   { category: 'User', description: 'Custom sound' }
 * );
 *
 * // Apply preset
 * presetManager.applyPreset(presetId, (params) => {
 *   setPluginParams(params);
 * });
 *
 * // Export preset
 * const json = presetManager.exportPreset(presetId);
 * // ... save to file
 *
 * // Import preset
 * const importedId = presetManager.importPreset(json);
 * ```
 */
export declare class PresetManager<T = Record<string, any>> {
  /**
   * Plugin identifier (used for localStorage key)
   */
  readonly pluginId: string;

  /**
   * Factory presets (read-only)
   */
  private factoryPresets: Map<string, Preset<T>>;

  /**
   * User presets (editable)
   */
  private userPresets: Map<string, Preset<T>>;

  /**
   * localStorage key prefix
   */
  private readonly storageKey: string;

  /**
   * Create a new PresetManager instance
   *
   * @param pluginId - Unique plugin identifier
   * @param factoryPresets - Built-in presets (optional)
   */
  constructor(pluginId: string, factoryPresets?: Preset<T>[]);

  /**
   * Register factory presets
   *
   * Factory presets are read-only and cannot be deleted or modified.
   *
   * @param presets - Array of factory presets
   */
  registerFactoryPresets(presets: Preset<T>[]): void;

  /**
   * Load user presets from localStorage
   *
   * Called automatically in constructor.
   * Can be called manually to reload after external changes.
   */
  loadUserPresets(): void;

  /**
   * Save user preset to localStorage
   *
   * @param name - Preset name
   * @param parameters - Plugin parameter values
   * @param metadata - Optional metadata
   * @returns Preset ID
   */
  saveUserPreset(
    name: string,
    parameters: T,
    metadata?: Partial<PresetMetadata>
  ): string;

  /**
   * Update existing user preset
   *
   * @param id - Preset ID
   * @param updates - Partial preset updates
   * @returns Success boolean
   */
  updateUserPreset(
    id: string,
    updates: Partial<Omit<Preset<T>, 'id' | 'isFactory'>>
  ): boolean;

  /**
   * Delete user preset
   *
   * Cannot delete factory presets.
   *
   * @param id - Preset ID
   * @returns Success boolean
   */
  deleteUserPreset(id: string): boolean;

  /**
   * Get preset by ID
   *
   * Searches both factory and user presets.
   *
   * @param id - Preset ID
   * @returns Preset or null if not found
   */
  getPreset(id: string): Preset<T> | null;

  /**
   * Get all presets (factory + user)
   *
   * @returns Array of all presets
   */
  getAllPresets(): Preset<T>[];

  /**
   * Get factory presets only
   *
   * @returns Array of factory presets
   */
  getFactoryPresets(): Preset<T>[];

  /**
   * Get user presets only
   *
   * @returns Array of user presets
   */
  getUserPresets(): Preset<T>[];

  /**
   * Get presets organized by category
   *
   * @returns Object with category keys and preset arrays
   */
  getPresetsByCategory(): PresetsByCategory<T>;

  /**
   * Search presets by name or tags
   *
   * @param query - Search query
   * @returns Matching presets
   */
  searchPresets(query: string): Preset<T>[];

  /**
   * Apply preset to plugin
   *
   * Calls the callback with preset parameters.
   *
   * @param id - Preset ID
   * @param callback - Function to apply parameters
   * @returns Success boolean
   */
  applyPreset(id: string, callback: ApplyPresetCallback<T>): boolean;

  /**
   * Export preset to JSON string
   *
   * @param id - Preset ID
   * @returns JSON string or null if preset not found
   */
  exportPreset(id: string): string | null;

  /**
   * Export all user presets to JSON string
   *
   * @returns JSON string
   */
  exportAllUserPresets(): string;

  /**
   * Import preset from JSON string
   *
   * @param json - JSON string
   * @returns Preset ID or null on error
   */
  importPreset(json: string): string | null;

  /**
   * Import multiple presets from JSON string
   *
   * @param json - JSON string containing array of presets
   * @returns Array of imported preset IDs
   */
  importPresets(json: string): string[];

  /**
   * Clear all user presets
   *
   * Factory presets are not affected.
   */
  clearUserPresets(): void;

  /**
   * Get total preset count
   *
   * @returns Total number of presets (factory + user)
   */
  getPresetCount(): number;

  /**
   * Check if preset exists
   *
   * @param id - Preset ID
   * @returns Boolean indicating existence
   */
  hasPreset(id: string): boolean;

  /**
   * Get default preset
   *
   * Returns the first factory preset, or the first user preset if no factory presets exist.
   *
   * @returns Default preset or null
   */
  getDefaultPreset(): Preset<T> | null;
}

/**
 * Factory function to create a PresetManager instance
 *
 * @param pluginId - Unique plugin identifier
 * @param factoryPresets - Built-in presets (optional)
 * @returns PresetManager instance
 *
 * @example
 * ```typescript
 * interface MyPluginParams {
 *   gain: number;
 *   tone: number;
 *   mix: number;
 * }
 *
 * const presetManager = createPresetManager<MyPluginParams>('my-plugin', [
 *   {
 *     id: 'default',
 *     name: 'Default',
 *     category: 'Init',
 *     parameters: { gain: 0.5, tone: 0.5, mix: 1.0 }
 *   }
 * ]);
 * ```
 */
export declare function createPresetManager<T = Record<string, any>>(
  pluginId: string,
  factoryPresets?: Preset<T>[]
): PresetManager<T>;
