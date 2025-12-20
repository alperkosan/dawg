/**
 * Preset Browser Component
 * Displays grid of community presets with search and filters
 */

import { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import useInstrumentEditorStore from '@/store/useInstrumentEditorStore';
import { useAuthStore } from '@/store/useAuthStore';
import PresetCard from './PresetCard';
import './PresetBrowser.css';

export default function PresetBrowser({ activeTab, searchQuery, filters }) {
    const [presets, setPresets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const user = useAuthStore(state => state.user);
    const userId = user?.id;

    // Fetch presets based on tab and filters
    useEffect(() => {
        fetchPresets();
    }, [activeTab, searchQuery, filters, page, userId]);

    const fetchPresets = async () => {
        setLoading(true);

        try {
            const { apiClient } = await import('@/services/api.js');
            let data;

            const params = {
                page: page.toString(),
                limit: '20',
            };
            if (searchQuery) params.search = searchQuery;
            if (activeTab === 'browse') params.public = 'true';
            if (filters?.presetType) params.presetType = filters.presetType;
            if (filters?.engineType) params.engineType = filters.engineType;

            if (activeTab === 'browse' || activeTab === 'my-presets') {
                if (activeTab === 'my-presets') {
                    if (!userId) {
                        setPresets([]);
                        setLoading(false);
                        return;
                    }
                    params.userId = userId;
                }
                data = await apiClient.getPresets(params);
            } else if (activeTab === 'downloads') {
                data = await apiClient.getMyDownloads({
                    page: page.toString(),
                    limit: '20',
                    presetType: filters?.presetType,
                    engineType: filters?.engineType
                });
            }

            if (data && data.presets) {
                setPresets(data.presets);
                setHasMore(data.pagination ? data.pagination.page < data.pagination.totalPages : false);
            } else if (data && Array.isArray(data)) {
                // Fallback for array response
                setPresets(data);
                setHasMore(false);
            } else {
                setPresets([]);
                setHasMore(false);
            }
        } catch (error) {
            console.error('Failed to fetch presets:', error);
            setPresets([]);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (presetId) => {
        try {
            const { apiClient } = await import('@/services/api.js');
            const { useAuthStore } = await import('@/store/useAuthStore');
            const token = useAuthStore.getState().accessToken;

            if (!token) {
                apiClient.showToast('Please login to download presets', 'warning', 3000);
                return;
            }

            // Download preset via apiClient
            const data = await apiClient.downloadPreset(presetId);
            const preset = data.preset;

            // Save to localStorage for persistence
            const storageKey = 'downloaded_presets';
            const existingPresets = JSON.parse(localStorage.getItem(storageKey) || '[]');

            // Check if already downloaded
            const alreadyDownloaded = existingPresets.some(p => p.id === preset.id);
            if (!alreadyDownloaded) {
                existingPresets.push({
                    id: preset.id,
                    userId: preset.userId,
                    name: preset.name,
                    presetType: preset.presetType || preset.preset_type || 'instrument',
                    engineType: preset.engineType || preset.engine_type || 'zenith',
                    author: preset.userName || preset.author || 'Community', // ✅ Capture author name
                    presetData: preset.presetData,
                    downloadedAt: new Date().toISOString()
                });
                localStorage.setItem(storageKey, JSON.stringify(existingPresets));
            }

            // Apply preset to current instrument
            const currentInstrumentData = useInstrumentEditorStore.getState().instrumentData;
            if (currentInstrumentData && preset.presetData) {
                // Update instrument data in store
                Object.entries(preset.presetData).forEach(([key, value]) => {
                    useInstrumentEditorStore.getState().updateParameter(key, value);
                });

                apiClient.showToast(`Preset "${preset.name}" applied!`, 'success', 3000);
            }

            console.log('✅ Preset downloaded and applied:', preset.name);
        } catch (error) {
            console.error('Failed to download preset:', error);
        }
    };

    const handleRate = async (presetId, rating) => {
        try {
            const { apiClient } = await import('@/services/api.js');
            await apiClient.ratePreset(presetId, rating);

            // Success toast is handled by apiClient
            // Refresh presets to show updated rating
            fetchPresets();
        } catch (error) {
            console.error('Failed to rate preset:', error);
        }
    };

    if (loading && presets.length === 0) {
        return (
            <div className="preset-browser-loading">
                <Loader className="spinner" size={32} />
                <p>Loading presets...</p>
            </div>
        );
    }

    if (!loading && presets.length === 0) {
        return (
            <div className="preset-browser-empty">
                <p>No presets found</p>
                {activeTab === 'my-presets' && <p className="hint">Upload your first preset to get started!</p>}
                {activeTab === 'downloads' && <p className="hint">Download presets from the Browse tab</p>}
            </div>
        );
    }

    return (
        <div className="preset-browser">
            <div className="preset-browser-grid">
                {presets.map((preset) => (
                    <PresetCard
                        key={preset.id}
                        preset={preset}
                        onDownload={handleDownload}
                        onRate={handleRate}
                    />
                ))}
            </div>

            {hasMore && (
                <button
                    className="preset-browser-load-more"
                    onClick={() => setPage(p => p + 1)}
                    disabled={loading}
                >
                    {loading ? 'Loading...' : 'Load More'}
                </button>
            )}
        </div>
    );
}
