/**
 * PresetBrowser - Save, load, and manage instrument presets
 * Features: Save current state, load presets, delete presets, search/filter
 */

import { useState, useEffect } from 'react';
import { Save, Download, Trash2, Search, Star, StarOff, Upload, Sparkles } from 'lucide-react';
import { usePanelsStore } from '../../../store/usePanelsStore';
import useInstrumentEditorStore from '../../../store/useInstrumentEditorStore';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
import PresetUploadModal from '../../preset_library/components/PresetUploadModal';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useAuthStore } from '@/store/useAuthStore';
import './PresetBrowser.css';

const PresetBrowser = ({
  targetData,
  presetType = 'instrument',
  engineType,
  onApplyPreset
}) => {
  const user = useAuthStore(state => state.user);
  const [presets, setPresets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadPresetData, setUploadPresetData] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'local' | 'downloaded'
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    variant: 'default'
  });

  // Default engine type if not provided
  const effectiveEngineType = engineType || targetData?.type || 'unknown';

  const loadParameter = useInstrumentEditorStore((state) => state.loadParameter);
  const updateParameter = useInstrumentEditorStore((state) => state.updateParameter);

  // Load presets from localStorage on mount and when user changes
  useEffect(() => {
    loadAllPresets();
    loadFavorites();
  }, [effectiveEngineType, presetType, user?.id]);

  const getStorageKeys = () => {
    const userId = user?.id || 'guest';
    return {
      localKey: `presets_${presetType}_${effectiveEngineType}_${userId}`,
      communityKey: 'downloaded_presets', // ✅ Unified across all users and components
      favoritesKey: `favorites_${presetType}_${effectiveEngineType}_${userId}`
    };
  };

  const loadAllPresets = () => {
    const { localKey, communityKey } = getStorageKeys();

    let combined = [];

    // 1. Load Local Presets
    const localStored = localStorage.getItem(localKey);
    if (localStored) {
      try {
        combined = JSON.parse(localStored);
      } catch (e) {
        console.error('Failed to load local presets:', e);
      }
    }

    // 2. Load Community Downloaded Presets
    const communityStored = localStorage.getItem(communityKey);
    if (communityStored) {
      try {
        const allDownloaded = JSON.parse(communityStored);

        // 🔧 Migration: Add missing presetType to old downloads
        let needsMigration = false;
        const migratedDownloads = allDownloaded.map(p => {
          if (!p.presetType) {
            needsMigration = true;
            // Default to 'instrument' for backwards compatibility
            return { ...p, presetType: 'instrument' };
          }
          return p;
        });

        // Save migrated data back to localStorage
        if (needsMigration) {
          localStorage.setItem(communityKey, JSON.stringify(migratedDownloads));
          console.log('✅ Migrated downloaded presets with missing presetType');
        }

        const filtered = migratedDownloads.filter(p => {
          // Robust case-insensitive match
          const engineMatch = p.engineType?.toLowerCase() === effectiveEngineType?.toLowerCase();
          const typeMatch = p.presetType === presetType;

          return typeMatch && engineMatch;
        });

        const communityPresets = filtered.map(p => ({
          ...p,
          data: p.presetData,
          isCommunity: true,
          createdAt: p.downloadedAt ? new Date(p.downloadedAt).getTime() : Date.now()
        }));

        combined = [...communityPresets, ...combined];
      } catch (e) {
        console.error('Failed to load community presets:', e);
      }
    }

    console.log(`📂 Loaded ${combined.length} total presets (${combined.filter(p => p.isCommunity).length} community)`);
    setPresets(combined);
  };

  const loadFavorites = () => {
    const { favoritesKey } = getStorageKeys();
    const stored = localStorage.getItem(favoritesKey);
    if (stored) {
      try {
        setFavorites(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error('Failed to load favorites:', e);
        setFavorites(new Set());
      }
    } else {
      setFavorites(new Set());
    }
  };

  const savePresets = (newPresets) => {
    const { localKey } = getStorageKeys();
    // Only save local presets (not community)
    const localPresets = newPresets.filter(p => !p.isCommunity);
    localStorage.setItem(localKey, JSON.stringify(localPresets));
    setPresets(newPresets);
  };

  const saveFavorites = (newFavorites) => {
    const { favoritesKey } = getStorageKeys();
    localStorage.setItem(favoritesKey, JSON.stringify([...newFavorites]));
    setFavorites(newFavorites);
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      const { apiClient } = await import('@/services/api.js');
      apiClient.showToast('Please enter a preset name', 'warning', 3000);
      return;
    }

    const preset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newPresetName.trim(),
      presetType,
      engineType: effectiveEngineType,
      createdAt: Date.now(),
      data: { ...targetData },
    };

    const newPresets = [...presets, preset];
    savePresets(newPresets);

    setNewPresetName('');
    setShowSaveDialog(false);

    console.log('✅ Preset saved:', preset.name);
  };

  const handleLoadPreset = (preset) => {
    if (onApplyPreset) {
      onApplyPreset(preset.data);
      console.log('✅ Preset applied via callback:', preset.name);
      return;
    }

    // Default behavior for instruments (legacy compatibility)
    if (presetType === 'instrument') {
      Object.entries(preset.data).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'name' && key !== 'type' && key !== 'mixerTrackId') {
          updateParameter(key, value);
        }
      });

      // Synchronize audio engine for instruments
      const audioEngine = AudioEngineGlobal.get();
      const targetId = targetData.id;
      if (audioEngine && targetId) {
        const instrument = audioEngine.instruments.get(targetId);
        if (instrument && typeof instrument.updateParameters === 'function') {
          const updateObj = {
            oscillatorSettings: preset.data.oscillators,
            filterSettings: preset.data.filter,
            filterEnvelope: preset.data.filterEnvelope,
            amplitudeEnvelope: preset.data.amplitudeEnvelope,
            lfos: preset.data.lfos,
            voiceMode: preset.data.voiceMode,
            portamento: preset.data.portamento,
            legato: preset.data.legato
          };
          instrument.updateParameters(updateObj);
        }
      }
    }

    console.log('✅ Preset loaded and synced:', preset.name);
  };

  const handleDeletePreset = (presetId) => {
    const preset = presets.find(p => p.id === presetId);

    if (preset?.isCommunity) {
      // Community preset: only remove from localStorage
      setConfirmationModal({
        isOpen: true,
        title: 'Remove Downloaded Preset',
        message: 'Remove this downloaded preset from your local library? You can re-download it anytime from the community library.',
        variant: 'warning',
        onConfirm: () => {
          const { communityKey } = getStorageKeys();
          const stored = localStorage.getItem(communityKey);
          if (stored) {
            const allDownloaded = JSON.parse(stored);
            const updated = allDownloaded.filter(p => p.id !== presetId);
            localStorage.setItem(communityKey, JSON.stringify(updated));
          }

          const newPresets = presets.filter(p => p.id !== presetId);
          savePresets(newPresets);

          // Also remove from favorites
          if (favorites.has(presetId)) {
            const newFavorites = new Set(favorites);
            newFavorites.delete(presetId);
            saveFavorites(newFavorites);
          }

          setConfirmationModal({ ...confirmationModal, isOpen: false });
          console.log('🗑️ Downloaded preset removed');
        }
      });
    } else {
      // Local preset: delete permanently
      setConfirmationModal({
        isOpen: true,
        title: 'Delete Preset',
        message: `Delete "${preset.name}" permanently? This action cannot be undone.`,
        variant: 'danger',
        onConfirm: () => {
          const newPresets = presets.filter(p => p.id !== presetId);
          savePresets(newPresets);

          // Also remove from favorites
          if (favorites.has(presetId)) {
            const newFavorites = new Set(favorites);
            newFavorites.delete(presetId);
            saveFavorites(newFavorites);
          }

          setConfirmationModal({ ...confirmationModal, isOpen: false });
          console.log('🗑️ Preset deleted permanently');
        }
      });
    }
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

  const handleSaveToLibrary = async () => {
    try {
      if (!targetData) {
        const { apiClient } = await import('@/services/api.js');
        apiClient.showToast('No preset data available', 'warning', 3000);
        return;
      }

      let dataToUpload = { ...targetData };

      // If it's an instrument and we're in the instrument editor, 
      // we might want to extract only the sound settings if targetData contains UI state
      if (presetType === 'instrument' && targetData.type) {
        // Special handling for legacy objects that might have metadata
        dataToUpload = {
          oscillators: targetData.oscillators || [],
          filter: targetData.filter || {},
          filterEnvelope: targetData.filterEnvelope || {},
          amplitudeEnvelope: targetData.amplitudeEnvelope || {},
          lfos: targetData.lfos || [],
          modulation: targetData.modulation || [],
          voiceMode: targetData.voiceMode || 'poly',
          portamento: targetData.portamento || 0,
          legato: targetData.legato || false,
          masterVolume: targetData.masterVolume || 0.7
        };
      }

      setUploadPresetData({
        presetType,
        engineType: effectiveEngineType,
        presetData: dataToUpload
      });
      setShowUploadModal(true);

      console.log(`✅ Opening ${presetType} upload modal with data:`, dataToUpload);
    } catch (error) {
      console.error('Failed to export preset:', error);
      const { apiClient } = await import('@/services/api.js');
      apiClient.showToast('Failed to export preset', 'error', 3000);
    }
  };

  // Filter presets by search query and filter type
  const filteredPresets = presets.filter(preset => {
    const matchesSearch = preset.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === 'all' ? true :
        filter === 'local' ? !preset.isCommunity :
          filter === 'downloaded' ? preset.isCommunity :
            true;
    return matchesSearch && matchesFilter;
  });

  // Sort: favorites first, then by date
  const sortedPresets = [...filteredPresets].sort((a, b) => {
    const aFav = favorites.has(a.id);
    const bFav = favorites.has(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return b.createdAt - a.createdAt;
  });

  const localCount = presets.filter(p => !p.isCommunity).length;
  const downloadedCount = presets.filter(p => p.isCommunity).length;

  return (
    <div className="preset-browser">
      {/* Header with Save buttons */}
      <div className="preset-browser__header">
        <h3 className="preset-browser__title">
          Preset Manager
          <span className="preset-browser__count">({localCount} local, {downloadedCount} downloaded)</span>
        </h3>
        <div className="preset-browser__header-actions">
          <button
            className="preset-browser__save-btn"
            onClick={() => setShowSaveDialog(true)}
            title="Save current settings as a local preset"
          >
            <Save size={14} />
            Save Current
          </button>
          <button
            className="preset-browser__upload-btn"
            onClick={handleSaveToLibrary}
            title="Upload current settings to community library"
          >
            <Upload size={16} />
            Upload to Community
          </button>
          <button
            className="preset-browser__community-btn"
            onClick={() => {
              usePanelsStore.getState().setPresetLibraryOpen(true);
            }}
            title="Browse community presets library"
          >
            <Sparkles size={16} />
            Browse Community
          </button>
        </div>
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

      {/* Filter Tabs */}
      <div className="preset-browser__filters">
        <button
          className={`preset-browser__filter ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({presets.length})
        </button>
        <button
          className={`preset-browser__filter ${filter === 'local' ? 'active' : ''}`}
          onClick={() => setFilter('local')}
        >
          Local ({localCount})
        </button>
        <button
          className={`preset-browser__filter ${filter === 'downloaded' ? 'active' : ''}`}
          onClick={() => setFilter('downloaded')}
        >
          Downloaded ({downloadedCount})
        </button>
      </div>

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
                <div className="preset-browser__name">
                  {preset.name}
                  {preset.isCommunity && (
                    <span className="preset-browser__community-tag">
                      {preset.author || preset.userName || 'Community'}
                    </span>
                  )}
                </div>
                <div className="preset-browser__date">
                  {preset.isCommunity ? 'Downloaded ' : ''}
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
        💡 Click a preset to load • Export to share with others • Save to Library for community
      </div>

      {/* Upload Modal */}
      {showUploadModal && uploadPresetData && (
        <PresetUploadModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            setUploadPresetData(null);
          }}
          initialData={uploadPresetData}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        variant={confirmationModal.variant}
        onConfirm={confirmationModal.onConfirm}
        onCancel={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
      />
    </div>
  );
};

export default PresetBrowser;
