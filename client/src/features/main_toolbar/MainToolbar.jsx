import React, { useState, useEffect } from 'react';
import { LayoutGrid, SlidersHorizontal, AudioLines, Music, Keyboard, Palette, Activity, Settings, Infinity } from 'lucide-react';
import { usePanelsStore } from '../../store/usePanelsStore';
import { useThemeStore } from '../../store/useThemeStore';
import { AudioContextService } from '../../lib/services/AudioContextService';

function MainToolbar() {
    const { panels, togglePanel } = usePanelsStore();
    const { themes, activeThemeId, setActiveThemeId } = useThemeStore();
    const [performanceStats, setPerformanceStats] = useState({
        cpuUsage: 0,
        sampleRate: 48000,
        activeVoices: 0,
        latency: 0
    });
    const [lastStatsUpdate, setLastStatsUpdate] = useState(0);

    // Performance monitoring hook
    useEffect(() => {
        const updateStats = () => {
            try {
                const audioEngine = AudioContextService.getAudioEngine();
                if (audioEngine && audioEngine.getEngineStats) {
                    const stats = audioEngine.getEngineStats();
                    const audioContext = audioEngine.audioContext;

                    // Calculate CPU usage estimate - much more conservative
                    const activeVoices = stats?.performance?.activeVoices || 0;
                    const instrumentCount = stats?.instruments?.total || 0;
                    const baseCpuLoad = 2; // Base load

                    const cpuUsage = Math.min(100,
                        baseCpuLoad +
                        (activeVoices * 0.5) + // Much lower per voice
                        (instrumentCount * 0.3) // Much lower per instrument
                    );

                    // Safe performance stats with fallback values
                    const safeStats = {
                        cpuUsage: isNaN(cpuUsage) ? 2 : Math.max(0, Math.min(100, cpuUsage)),
                        sampleRate: audioContext?.sampleRate || 48000,
                        activeVoices: activeVoices,
                        latency: stats?.audioContext?.totalLatency || 0
                    };

                    // Only update if values changed significantly
                    const currentTime = Date.now();
                    if (currentTime - lastStatsUpdate > 1000 ||
                        Math.abs(safeStats.cpuUsage - performanceStats.cpuUsage) > 1) {
                        setPerformanceStats(safeStats);
                        setLastStatsUpdate(currentTime);
                    }
                } else {
                    // Fallback when audio engine is not available
                    setPerformanceStats({
                        cpuUsage: 0,
                        sampleRate: 48000,
                        activeVoices: 0,
                        latency: 0
                    });
                }
            } catch (error) {
                console.log('Performance stats update error:', error);
                // Set safe fallback values on error
                setPerformanceStats({
                    cpuUsage: 0,
                    sampleRate: 48000,
                    activeVoices: 0,
                    latency: 0
                });
            }
        };

        updateStats();
        const interval = setInterval(updateStats, 2000); // Less frequent updates
        return () => clearInterval(interval);
    }, []);

    const panelButtons = [
        { id: 'arrangement', title: 'Arrangement', icon: LayoutGrid },
        { id: 'channel-rack', title: 'Channel Rack', icon: AudioLines },
        { id: 'mixer', title: 'Mixer', icon: SlidersHorizontal },
        { id: 'piano-roll', title: 'Piano Roll', icon: Music },
        { id: 'keybindings', title: 'Keyboard Shortcuts', icon: Keyboard },
    ];

    const infiniteCanvasButtons = [
        { id: 'infinite-channel-rack', title: 'Infinite Channel Rack 🚀', icon: Infinity },
        { id: 'infinite-piano-roll', title: 'Infinite Piano Roll 🚀', icon: Infinity },
    ];

    const settingsButtons = [
        { id: 'audio-quality-settings', title: 'Audio Quality Settings', icon: Settings }
    ];

    return (
        <nav className="main-toolbar">
            <div className="toolbar__group">
                 <Palette size={16} className="text-[var(--color-accent-primary)]"/>
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

            {/* Infinite Canvas Buttons */}
            <div className="toolbar__group">
                <div className="toolbar__label">∞ Canvas</div>
                {infiniteCanvasButtons.map(({ id, title, icon: Icon }) => {
                    const isActive = panels[id]?.isOpen && !panels[id]?.isMinimized;
                    const buttonClasses = `main-toolbar__button main-toolbar__button--special ${isActive ? 'main-toolbar__button--active' : ''}`;
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

            {/* CPU Usage Monitor */}
            <div className="toolbar__group">
                <div className="main-toolbar__performance-monitor">
                    <Activity size={16} className="text-[var(--color-accent-primary)]" />
                    <span className="main-toolbar__cpu-text">
                        {(performanceStats.cpuUsage || 0).toFixed(0)}%
                    </span>
                    <div
                        className="main-toolbar__cpu-bar"
                        title={`CPU: ${(performanceStats.cpuUsage || 0).toFixed(1)}% | Sample Rate: ${performanceStats.sampleRate || 48000}Hz | Voices: ${performanceStats.activeVoices || 0} | Latency: ${(performanceStats.latency || 0).toFixed(1)}ms`}
                    >
                        <div
                            className={`main-toolbar__cpu-fill ${(performanceStats.cpuUsage || 0) > 80 ? 'main-toolbar__cpu-fill--high' : (performanceStats.cpuUsage || 0) > 50 ? 'main-toolbar__cpu-fill--medium' : 'main-toolbar__cpu-fill--low'}`}
                            style={{ width: `${Math.min(100, performanceStats.cpuUsage || 0)}%` }}
                        />
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default MainToolbar;

