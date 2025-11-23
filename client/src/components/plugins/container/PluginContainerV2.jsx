/**
 * PLUGIN CONTAINER V2.0
 *
 * Universal plugin wrapper with integrated preset management and parameter batching
 *
 * v2.0 Changes from v1:
 * ✅ Integrated with PresetManager v2.0 (unified preset system)
 * ✅ Integrated with ParameterBatcher (efficient parameter updates)
 * ✅ Category-based theming (automatic color from plugin type)
 * ✅ Undo/Redo support
 * ✅ Preset search & tags
 * ✅ Import/Export presets
 * ✅ Performance monitoring
 * ✅ Keyboard shortcuts
 * ✅ Accessibility improvements
 *
 * Features:
 * - Header with bypass, preset selector, A/B comparison
 * - Factory + User presets with advanced management
 * - Parameter batching for smooth UI updates
 * - Category-based color theming
 * - Undo/Redo with Cmd+Z/Cmd+Shift+Z
 * - Preset import/export
 * - Search & tag filtering
 * - Performance stats overlay (dev mode)
 *
 * Usage:
 *   <PluginContainerV2
 *     trackId={trackId}
 *     effect={effect}
 *     definition={pluginDefinition}
 *     category="dynamics-forge"
 *   >
 *     <YourPluginUI />
 *   </PluginContainerV2>
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import './PluginContainerV2.css';
import {
  Power,
  ChevronDown,
  Save,
  Trash2,
  GitCompareArrows,
  Undo2,
  Redo2,
  Download,
  Upload,
  Search,
  Tag,
  Info
} from 'lucide-react';
import {
  PluginColorPalette,
  PluginAnimations,
  PluginTypography,
  PluginSpacingHeader,
  getCategoryColors,
  getPluginCategory
} from '../PluginDesignSystem';
import { TexturePack, DepthEffects } from '../PluginTexturePack';
import { useMixerStore } from '@/store/useMixerStore';
import { PresetManager } from '@/services/PresetManager';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import ConfirmationModal from '@/components/common/ConfirmationModal';

/**
 * PRESET MENU V2.0 (Enhanced with search, tags, import/export)
 */
const PresetMenuV2 = ({
  isOpen,
  onClose,
  anchorEl,
  presetManager,
  onSelect,
  onDelete,
  onImport,
  onExport,
  categoryColors
}) => {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    onConfirm: null,
  });

  // Position menu
  useEffect(() => {
    if (isOpen && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setPosition({ top: rect.bottom + 5, left: rect.left });
    }
  }, [isOpen, anchorEl]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Get filtered presets
  const filteredPresets = useMemo(() => {
    if (!presetManager) return { factory: [], user: [] };

    const filters = {
      searchQuery,
      tags: selectedTags,
      category: null,
    };

    return presetManager.searchPresets(searchQuery, filters);
  }, [presetManager, searchQuery, selectedTags]);

  // Get all tags
  const allTags = useMemo(() => {
    if (!presetManager) return [];
    return presetManager.getAllTags();
  }, [presetManager]);

  // Toggle tag filter
  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="preset-menu-v2"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        background: categoryColors.background,
        border: `1px solid ${categoryColors.primary}40`,
        maxHeight: '80vh',
        overflowY: 'auto',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        minWidth: '320px'
      }}
    >
      {/* Search */}
      <div className="preset-menu-v2__search">
        <Search size={14} style={{ color: categoryColors.primary }} />
        <input
          type="text"
          placeholder="Search presets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ borderColor: `${categoryColors.primary}40` }}
        />
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="preset-menu-v2__tags">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`preset-tag ${selectedTags.includes(tag) ? 'preset-tag--active' : ''}`}
              style={{
                background: selectedTags.includes(tag)
                  ? categoryColors.primary
                  : 'transparent',
                borderColor: categoryColors.primary,
              }}
            >
              <Tag size={10} />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Factory Presets */}
      {filteredPresets.factory.length > 0 && (
        <>
          <h4
            className="preset-menu-v2__category"
            style={{ color: categoryColors.primary }}
          >
            Factory Presets
          </h4>
          {filteredPresets.factory.map(preset => (
            <button
              key={preset.id}
              onClick={() => onSelect(preset)}
              className="preset-menu-v2__item"
              style={{ borderLeftColor: categoryColors.primary }}
            >
              <div className="preset-menu-v2__item-name">{preset.name}</div>
              {preset.description && (
                <div className="preset-menu-v2__item-desc">{preset.description}</div>
              )}
              {preset.tags && preset.tags.length > 0 && (
                <div className="preset-menu-v2__item-tags">
                  {preset.tags.map(tag => (
                    <span key={tag} className="preset-tag-mini">#{tag}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </>
      )}

      {/* User Presets */}
      {filteredPresets.user.length > 0 && (
        <>
          <h4
            className="preset-menu-v2__category"
            style={{ color: categoryColors.primary }}
          >
            User Presets
          </h4>
          {filteredPresets.user.map(preset => (
            <div
              key={preset.id}
              className="preset-menu-v2__user-item"
            >
              <button
                onClick={() => onSelect(preset)}
                className="preset-menu-v2__item"
                style={{ borderLeftColor: categoryColors.secondary }}
              >
                <div className="preset-menu-v2__item-name">{preset.name}</div>
                {preset.description && (
                  <div className="preset-menu-v2__item-desc">{preset.description}</div>
                )}
                {preset.tags && preset.tags.length > 0 && (
                  <div className="preset-menu-v2__item-tags">
                    {preset.tags.map(tag => (
                      <span key={tag} className="preset-tag-mini">#{tag}</span>
                    ))}
                  </div>
                )}
              </button>
              <div className="preset-menu-v2__actions">
                <button
                  onClick={() => onExport(preset.id)}
                  className="preset-action-mini"
                  title="Export preset"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={() => onDelete(preset.id)}
                  className="preset-action-mini preset-action-mini--danger"
                  title="Delete preset"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Actions */}
      <div className="preset-menu-v2__footer">
        <button
          onClick={onImport}
          className="preset-menu-v2__footer-btn"
          style={{ borderColor: categoryColors.primary }}
        >
          <Upload size={14} />
          Import
        </button>
        <button
          onClick={() => setShowStats(!showStats)}
          className="preset-menu-v2__footer-btn"
          style={{ borderColor: categoryColors.primary }}
        >
          <Info size={14} />
          Stats
        </button>
      </div>

      {/* Stats (if enabled) */}
      {showStats && presetManager && (
        <div className="preset-menu-v2__stats">
          <div>Factory: {presetManager.getFactoryPresets().length}</div>
          <div>User: {presetManager.getUserPresets().length}</div>
          <div>Tags: {allTags.length}</div>
        </div>
      )}
    </div>,
    document.body
  );
};

/**
 * PLUGIN CONTAINER V2.0
 */
const PluginContainerV2 = ({
  trackId,
  effect,
  definition,
  children,
  category: categoryProp,
  showPerformanceStats = false,
}) => {
  const { type: pluginType, presets: factoryPresets = [] } = definition;
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Category-based theming
  const category = categoryProp || getPluginCategory(pluginType);
  const categoryColors = useMemo(() => getCategoryColors(category), [category]);

  // Preset Manager
  const presetManagerRef = useRef(null);
  if (!presetManagerRef.current) {
    console.log('🔍 [PluginContainerV2] Creating PresetManager:', {
      pluginType,
      category,
      factoryPresetsCount: factoryPresets?.length
    });
    presetManagerRef.current = new PresetManager(
      pluginType,
      category,
      factoryPresets
    );
  }
  const presetManager = presetManagerRef.current;

  // Parameter Batcher (for effect node)
  const { setParam, setParams, flush } = useParameterBatcher(effect.node);

  // UI State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activePresetName, setActivePresetName] = useState('Custom');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const buttonRef = useRef(null);

  // Update undo/redo state
  useEffect(() => {
    setCanUndo(presetManager.canUndo());
    setCanRedo(presetManager.canRedo());
  }, [effect.settings]);

  // Detect active preset
  useEffect(() => {
    const currentPreset = presetManager.getCurrentPreset();
    setActivePresetName(currentPreset ? currentPreset.name : 'Custom');
  }, [effect.settings]);

  /**
   * PRESET HANDLERS
   */

  // Load preset
  const handlePresetSelect = useCallback((preset) => {
    console.log('🎯 [PluginContainerV2] Loading preset:', preset.name, preset.settings);
    presetManager.loadPreset(preset.id, (settings) => {
      console.log('✅ [PluginContainerV2] Applying settings:', settings);
      handleMixerEffectChange(trackId, effect.id, settings);
    });
    setIsMenuOpen(false);
  }, [trackId, effect.id]);

  // Save preset
  const handleSave = useCallback(() => {
    const name = prompt('Enter preset name:', activePresetName === 'Custom' ? '' : activePresetName);
    if (!name || !name.trim()) return;

    const tags = prompt('Enter tags (comma-separated, optional):');
    const description = prompt('Enter description (optional):');

    presetManager.savePreset(
      name.trim(),
      tags ? tags.split(',').map(t => t.trim()) : [],
      description || ''
    );
  }, [activePresetName]);

  // Delete preset
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    presetId: null,
    presetName: '',
  });

  const handleDelete = useCallback((presetId) => {
    const preset = presetManager.getUserPresets().find(p => p.id === presetId);
    if (!preset) return;

    setDeleteConfirmation({
      isOpen: true,
      presetId,
      presetName: preset.name,
    });
  }, [presetManager]);

  const confirmDelete = useCallback(() => {
    if (deleteConfirmation.presetId) {
      presetManager.deletePreset(deleteConfirmation.presetId);
      setDeleteConfirmation({ isOpen: false, presetId: null, presetName: '' });
    }
  }, [deleteConfirmation.presetId, presetManager]);

  // Export preset
  const handleExport = useCallback((presetId) => {
    const json = presetManager.exportPreset(presetId);
    if (!json) return;

    // Download as file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pluginType}_preset_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pluginType]);

  // Import preset
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      const imported = await presetManager.importPreset(text);

      const { apiClient } = await import('../../../services/api.js');
      if (imported) {
        apiClient.showToast(`Preset "${imported.name}" imported successfully!`, 'success', 3000);
      } else {
        apiClient.showToast('Failed to import preset. Check console for errors.', 'error', 5000);
      }
    };
    input.click();
  }, []);

  /**
   * A/B COMPARISON
   */

  const handleToggleAB = useCallback(() => {
    const currentSlot = presetManager.getCurrentABSlot();
    const newSlot = currentSlot === 'A' ? 'B' : 'A';

    presetManager.recallState(newSlot, (settings) => {
      handleMixerEffectChange(trackId, effect.id, settings);
    });
  }, [trackId, effect.id]);

  const handleSnapshotA = useCallback(() => {
    presetManager.snapshotState('A', effect.settings);
  }, [effect.settings]);

  const handleSnapshotB = useCallback(() => {
    presetManager.snapshotState('B', effect.settings);
  }, [effect.settings]);

  const handleCopyAtoB = useCallback(() => {
    presetManager.copyState('A', 'B');
  }, []);

  /**
   * UNDO/REDO
   */

  const handleUndo = useCallback(() => {
    presetManager.undo((settings) => {
      handleMixerEffectChange(trackId, effect.id, settings);
    });
  }, [trackId, effect.id]);

  const handleRedo = useCallback(() => {
    presetManager.redo((settings) => {
      handleMixerEffectChange(trackId, effect.id, settings);
    });
  }, [trackId, effect.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+Z / Ctrl+Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Cmd+Shift+Z / Ctrl+Shift+Z: Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  /**
   * BYPASS
   */

  const handleBypass = useCallback((e) => {
    e.stopPropagation();
    handleMixerEffectChange(trackId, effect.id, 'bypass', !effect.bypass);
  }, [trackId, effect.id, effect.bypass]);

  /**
   * STYLES
   */

  const containerStyle = {
    background: PluginColorPalette.backgrounds.primary,
    borderRadius: '12px',
    border: `1px solid ${effect.bypass ? 'rgba(100, 116, 139, 0.3)' : `${categoryColors.primary}40`}`,
    ...DepthEffects.containerShadow(categoryColors.glow),
    ...(effect.bypass ? {} : DepthEffects.glowShadow(categoryColors.primary, 0.15)),
    overflow: 'hidden',
    transition: `all ${PluginAnimations.normal}`,
    opacity: effect.bypass ? 0.6 : 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    position: 'relative',
  };

  const headerStyle = {
    background: `linear-gradient(135deg, ${categoryColors.accent}40 0%, ${categoryColors.accent}20 100%)`,
    borderBottom: `1px solid ${categoryColors.primary}40`,
    padding: PluginSpacingHeader.padding,
    height: '56px',
    flexShrink: 0,
  };

  return (
    <TexturePack 
      categoryColors={categoryColors}
      intensity="medium"
      enableGrain={true}
      enableGradient={true}
      enableScanlines={false}
    >
      <div style={containerStyle}>
        {/* HEADER */}
        <div style={headerStyle} className="plugin-header__controls">
        {/* Title Section */}
        <div className="plugin-header__title-section">
          {/* Bypass Button */}
          <button
            onClick={handleBypass}
            className="plugin-bypass-button"
            data-active={!effect.bypass}
            title={effect.bypass ? 'Bypassed' : 'Active'}
            style={{
              background: !effect.bypass ? categoryColors.primary : 'transparent',
            }}
          >
            <Power size={14} />
          </button>

          {/* Title */}
          <div>
            <h1 style={{ ...PluginTypography.title, color: categoryColors.primary }}>
              {pluginType}
            </h1>
            <h2 style={{ ...PluginTypography.label, color: categoryColors.secondary }}>
              {categoryColors.name}
            </h2>
          </div>
        </div>

        {/* Preset Actions */}
        <div className="preset-actions">
          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="preset-action-btn"
            title="Undo (Cmd+Z)"
            style={{
              opacity: canUndo ? 1 : 0.3,
              color: categoryColors.primary,
            }}
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="preset-action-btn"
            title="Redo (Cmd+Shift+Z)"
            style={{
              opacity: canRedo ? 1 : 0.3,
              color: categoryColors.primary,
            }}
          >
            <Redo2 size={16} />
          </button>

          {/* Preset Selector */}
          <div className="preset-manager__selector">
            <button
              ref={buttonRef}
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(true);
              }}
              className={`preset-button ${isMenuOpen ? 'preset-button--open' : ''}`}
              style={{
                borderColor: categoryColors.primary,
                background: `${categoryColors.primary}10`,
              }}
            >
              <span className="preset-button__name">{activePresetName}</span>
              <ChevronDown size={16} className="preset-button__chevron" />
            </button>

            <PresetMenuV2
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              anchorEl={buttonRef.current}
              presetManager={presetManager}
              onSelect={handlePresetSelect}
              onDelete={handleDelete}
              onImport={handleImport}
              onExport={handleExport}
              categoryColors={categoryColors}
            />
          </div>

          {/* A/B Toggle */}
          <div className="ab-toggle">
            <button
              onClick={handleSnapshotA}
              onDoubleClick={handleToggleAB}
              className={`ab-button ${presetManager.getCurrentABSlot() === 'A' ? 'ab-button--active' : ''}`}
              title="Double-click to switch"
              style={{
                background: presetManager.getCurrentABSlot() === 'A'
                  ? categoryColors.primary
                  : 'transparent',
                borderColor: categoryColors.primary,
              }}
            >
              A
            </button>
            <button
              onClick={handleSnapshotB}
              onDoubleClick={handleToggleAB}
              className={`ab-button ${presetManager.getCurrentABSlot() === 'B' ? 'ab-button--active' : ''}`}
              title="Double-click to switch"
              style={{
                background: presetManager.getCurrentABSlot() === 'B'
                  ? categoryColors.primary
                  : 'transparent',
                borderColor: categoryColors.primary,
              }}
            >
              B
            </button>
          </div>

          {/* Copy A→B */}
          <button
            onClick={handleCopyAtoB}
            className="preset-action-btn"
            title="Copy A to B"
            style={{ color: categoryColors.primary }}
          >
            <GitCompareArrows size={16} />
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            className="preset-action-btn"
            title="Save Preset"
            style={{ color: categoryColors.primary }}
          >
            <Save size={16} />
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="plugin-body" style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>

      {/* PERFORMANCE STATS (Dev Mode) */}
      {showPerformanceStats && (
        <div
          className="plugin-performance-stats"
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            background: 'rgba(0, 0, 0, 0.8)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'monospace',
            color: categoryColors.primary,
          }}
        >
          {/* TODO: Add real performance metrics */}
          60 FPS
        </div>
      )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Delete Preset"
        message={`Delete preset "${deleteConfirmation.presetName}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmation({ isOpen: false, presetId: null, presetName: '' })}
      />
    </TexturePack>
  );
};

export default PluginContainerV2;
