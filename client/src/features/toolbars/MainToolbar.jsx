import React, { useState, useEffect } from 'react';
import { LayoutGrid, SlidersHorizontal, AudioLines, Music, Keyboard, Palette, Activity, Settings, Infinity, Layers } from 'lucide-react';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useThemeStore } from '@/store/useThemeStore';
import { AudioContextService } from '@/lib/services/AudioContextService';

function MainToolbar() {
    const { panels, togglePanel } = usePanelsStore();
    const { themes, activeThemeId, setActiveThemeId } = useThemeStore();
    const [performanceStats, setPerformanceStats] = useState({
        cpuUsage: 0,
        sampleRate: 48000,
        activeVoices: 0,
        latency: 0
    });

    const panelButtons = [
        { id: 'arrangement-workspace', title: 'Arrangement Workspace', icon: Layers },
        { id: 'channel-rack', title: 'Channel Rack', icon: AudioLines },
        { id: 'mixer', title: 'Mixer', icon: SlidersHorizontal },
        { id: 'piano-roll', title: 'Piano Roll', icon: Music },
        { id: 'keybindings', title: 'Keyboard Shortcuts', icon: Keyboard },
    ];

    const settingsButtons = [
        { id: 'audio-quality-settings', title: 'Audio Quality Settings', icon: Settings }
    ];

    return (
        <nav className="main-toolbar">
            <div className="toolbar__group">
                 <Palette size={16} className="text-[var(--zenith-accent-cool)]"/>
                 <select
                    value={activeThemeId}
                    onChange={(e) => setActiveThemeId(e.target.value)}
                    className="main-toolbar__theme-selector"
                 >
                    {themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                 </select>
                 <button onClick={() => togglePanel('theme-editor')} className="main-toolbar__button" title="Open Theme Editor">
                     <Palette size={16}/>
                 </button>
            </div>

            <div className="toolbar__group">
                {panelButtons.map(({ id, title, icon: Icon }) => {
                    const isActive = panels[id]?.isOpen && !panels[id]?.isMinimized;
                    const buttonClasses = `main-toolbar__button ${isActive ? 'main-toolbar__button--active' : ''}`;
                    return (
                        <button key={id} title={title} className={buttonClasses} onClick={() => togglePanel(id)}>
                            <Icon size={18} />
                        </button>
                    );
                })}
            </div>

            {/* Settings Buttons */}
            <div className="toolbar__group">
                {settingsButtons.map(({ id, title, icon: Icon }) => {
                    const isActive = panels[id]?.isOpen && !panels[id]?.isMinimized;
                    const buttonClasses = `main-toolbar__button ${isActive ? 'main-toolbar__button--active' : ''}`;
                    return (
                        <button key={id} title={title} className={buttonClasses} onClick={() => togglePanel(id)}>
                            <Icon size={18} />
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

export default MainToolbar;

