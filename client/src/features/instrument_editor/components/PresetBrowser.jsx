/**
 * PresetBrowser - Save, load, and manage instrument presets
 * Features: Save current state, load presets, delete presets, search/filter
 */

import { useState, useEffect } from 'react';
import { Save, Download, Trash2, Search, Star, StarOff } from 'lucide-react';
import useInstrumentEditorStore from '../../../store/useInstrumentEditorStore';
import './PresetBrowser.css';

const PresetBrowser = ({ instrumentData }) => {
  const [presets, setPresets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [favorites, setFavorites] = useState(new Set());

  const loadParameter = useInstrumentEditorStore((state) => state.loadParameter);
  const updateParameter = useInstrumentEditorStore((state) => state.updateParameter);

  // Load presets from localStorage on mount
  useEffect(() => {
    loadPresets();
    loadFavorites();
  }, [instrumentData.type]);

  const loadPresets = () => {
    const storageKey = `presets_${instrumentData.type}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setPresets(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load presets:', e);
        setPresets([]);
      }
    }
  };

  const loadFavorites = () => {
    const stored = localStorage.getItem('preset_favorites');
    if (stored) {
      try {
        setFavorites(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error('Failed to load favorites:', e);
        setFavorites(new Set());
      }
    }
  };

  const savePresets = (newPresets) => {
    const storageKey = `presets_${instrumentData.type}`;
    localStorage.setItem(storageKey, JSON.stringify(newPresets));
    setPresets(newPresets);
  };

  const saveFavorites = (newFavorites) => {
    localStorage.setItem('preset_favorites', JSON.stringify([...newFavorites]));
    setFavorites(newFavorites);
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      const { apiClient } = await import('../../../services/api.js');
      apiClient.showToast('Please enter a preset name', 'warning', 3000);
      return;
    }

    const preset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newPresetName.trim(),
      type: instrumentData.type,
      createdAt: Date.now(),
      data: { ...instrumentData },
    };

    const newPresets = [...presets, preset];
    savePresets(newPresets);

    setNewPresetName('');
    setShowSaveDialog(false);

    console.log('✅ Preset saved:', preset.name);
  };

  const handleLoadPreset = (preset) => {
    // Apply all preset data to current instrument
    Object.entries(preset.data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'name') {
        updateParameter(key, value);
      }
    });

    console.log('✅ Preset loaded:', preset.name);
  };

  const handleDeletePreset = (presetId) => {
    if (!confirm('Delete this preset?')) return;

    const newPresets = presets.filter(p => p.id !== presetId);
    savePresets(newPresets);

    // Also remove from favorites
    if (favorites.has(presetId)) {
      const newFavorites = new Set(favorites);
      newFavorites.delete(presetId);
      saveFavorites(newFavorites);
    }

    console.log('🗑️ Preset deleted');
  };

  const handleToggleFavorite = (presetId) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(presetId)) {
      newFavorites.delete(presetId);
    } else {
      newFavorites.add(presetId);
    }
    saveFavorites(newFavorites);
  };

  const handleExportPreset = (preset) => {
    const dataStr = JSON.stringify(preset, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${preset.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter presets by search query
  const filteredPresets = presets.filter(preset =>
    preset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: favorites first, then by date
  const sortedPresets = [...filteredPresets].sort((a, b) => {
    const aFav = favorites.has(a.id);
    const bFav = favorites.has(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="preset-browser">
      {/* Header with Save button */}
      <div className="preset-browser__header">
        <h3 className="preset-browser__title">
          Preset Manager
          <span className="preset-browser__count">({presets.length})</span>
        </h3>
        <button
          className="preset-browser__save-btn"
          onClick={() => setShowSaveDialog(true)}
        >
          <Save size={14} />
          Save Current
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="preset-browser__save-dialog">
          <input
            type="text"
            placeholder="Preset name..."
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSavePreset();
              if (e.key === 'Escape') setShowSaveDialog(false);
            }}
            autoFocus
            className="preset-browser__save-input"
          />
          <div className="preset-browser__save-actions">
            <button onClick={handleSavePreset} className="preset-browser__save-confirm">
              Save
            </button>
            <button onClick={() => setShowSaveDialog(false)} className="preset-browser__save-cancel">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="preset-browser__search">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search presets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="preset-browser__search-input"
        />
      </div>

      {/* Preset List */}
      <div className="preset-browser__list">
        {sortedPresets.length === 0 ? (
          <div className="preset-browser__empty">
            {searchQuery ? (
              <p>No presets found matching "{searchQuery}"</p>
            ) : (
              <>
                <p>No saved presets yet</p>
                <p className="preset-browser__empty-hint">
                  Click "Save Current" to save your first preset
                </p>
              </>
            )}
          </div>
        ) : (
          sortedPresets.map((preset) => (
            <div key={preset.id} className="preset-browser__item">
              <button
                className="preset-browser__favorite"
                onClick={() => handleToggleFavorite(preset.id)}
                title={favorites.has(preset.id) ? 'Remove from favorites' : 'Add to favorites'}
              >
                {favorites.has(preset.id) ? (
                  <Star size={14} fill="currentColor" />
                ) : (
                  <StarOff size={14} />
                )}
              </button>

              <div className="preset-browser__info" onClick={() => handleLoadPreset(preset)}>
                <div className="preset-browser__name">{preset.name}</div>
                <div className="preset-browser__date">
                  {new Date(preset.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="preset-browser__actions">
                <button
                  className="preset-browser__action"
                  onClick={() => handleExportPreset(preset)}
                  title="Export preset"
                >
                  <Download size={14} />
                </button>
                <button
                  className="preset-browser__action preset-browser__action--danger"
                  onClick={() => handleDeletePreset(preset.id)}
                  title="Delete preset"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="preset-browser__footer">
        💡 Click a preset to load • Export to share with others
      </div>
    </div>
  );
};

export default PresetBrowser;
