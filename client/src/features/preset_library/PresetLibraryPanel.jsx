/**
 * Preset Library Panel
 * Community preset sharing platform
 * Browse, upload, download, and rate presets for all instruments and effects
 */

import { useState, useEffect, memo } from 'react';
import { X, Search, Download, Star, TrendingUp, Sparkles, Filter, User } from 'lucide-react';
import { usePanelsStore } from '../../store/usePanelsStore';
import PresetBrowser from './components/PresetBrowser';
import './PresetLibraryPanel.css';

const PresetLibraryPanel = memo(function PresetLibraryPanel() {
    // Get state directly from store
    const isOpen = usePanelsStore(state => state.isPresetLibraryOpen);
    const setPresetLibraryOpen = usePanelsStore(state => state.setPresetLibraryOpen);

    const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'my-presets' | 'downloads'
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        presetType: 'instrument', // Default to instrument
        engineType: null,
        category: null,
        genre: null,
        tags: [],
    });

    // Reset search when tab changes
    useEffect(() => {
        setSearchQuery('');
    }, [activeTab]);


    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    return (
        <>
            <div className="preset-library-panel">
                <div className="preset-library-header">
                    <div className="preset-library-title">
                        <Sparkles size={20} />
                        <h2>Preset Library</h2>
                    </div>
                    <button
                        className="preset-library-close"
                        onClick={() => setPresetLibraryOpen(false)}
                        aria-label="Close Preset Library"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="preset-library-tabs">
                    <button
                        className={`preset-library-tab ${activeTab === 'browse' ? 'active' : ''}`}
                        onClick={() => setActiveTab('browse')}
                    >
                        <Search size={16} />
                        Browse
                    </button>
                    <button
                        className={`preset-library-tab ${activeTab === 'my-presets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('my-presets')}
                    >
                        <User size={16} />
                        My Presets
                    </button>
                    <button
                        className={`preset-library-tab ${activeTab === 'downloads' ? 'active' : ''}`}
                        onClick={() => setActiveTab('downloads')}
                    >
                        <Download size={16} />
                        Downloads
                    </button>
                </div>

                {/* Search Bar */}
                <div className="preset-library-search">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search presets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                        className="preset-library-filter-btn"
                        title="Filters"
                    >
                        <Filter size={18} />
                    </button>
                </div>

                {/* Content Category Filter */}
                <div className="preset-library-category-tabs">
                    <button
                        className={`category-tab ${filters.presetType === 'instrument' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('presetType', 'instrument')}
                    >
                        Instruments
                    </button>
                    <button
                        className={`category-tab ${filters.presetType === 'effect' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('presetType', 'effect')}
                    >
                        Plugins
                    </button>
                </div>

                {/* Quick Actions */}
                {activeTab === 'browse' && (
                    <div className="preset-library-quick-actions">
                        <button className="quick-action-btn">
                            <TrendingUp size={16} />
                            Popular
                        </button>
                        <button className="quick-action-btn">
                            <Star size={16} />
                            Top Rated
                        </button>
                        <button className="quick-action-btn">
                            <Sparkles size={16} />
                            Featured
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="preset-library-content">
                    <PresetBrowser
                        activeTab={activeTab}
                        searchQuery={searchQuery}
                        filters={filters}
                    />
                </div>
            </div>
        </>
    );
});
export default PresetLibraryPanel;
