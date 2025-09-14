import React from 'react';
import { LayoutGrid, SlidersHorizontal, AudioLines, Music, Keyboard, Palette } from 'lucide-react';
import { usePanelsStore } from '../../store/usePanelsStore';
import { useThemeStore } from '../../store/useThemeStore';

function MainToolbar() {
    const togglePanel = usePanelsStore(state => state.togglePanel);
    const { themes, activeThemeId, setActiveThemeId } = useThemeStore();
    const openThemeEditor = usePanelsStore(state => state.togglePanel);

    return (
        <nav className="h-12 bg-[var(--color-surface)] border-b-2 border-[var(--color-background)] flex items-center justify-between px-4 shrink-0 shadow-lg">
            {/* Tema Seçim Menüsü */}
            <div className="flex items-center gap-2">
                 <Palette size={18} className="text-[var(--color-primary)]"/>
                 <select 
                    value={activeThemeId}
                    onChange={(e) => setActiveThemeId(e.target.value)}
                    className="bg-[var(--color-background)] border rounded px-2 py-1 text-xs"
                    style={{ borderColor: 'var(--color-muted)' }}
                 >
                    {themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                 </select>
                 <button onClick={() => openThemeEditor('theme-editor')} className="p-1.5 rounded hover:bg-[var(--color-muted)]" title="Tema Editörünü Aç">
                     <Palette size={16}/>
                 </button>
            </div>

            <div className="flex items-center gap-2">
                <button
                    title="Arrangement"
                    className="p-2 hover:bg-[var(--color-surface)] rounded transition-colors"
                    onClick={() => togglePanel('arrangement')}
                >
                    <LayoutGrid className="w-5 h-5 text-[var(--color-text)]" />
                </button>
                <button title="Channel Rack" onClick={() => togglePanel('channel-rack')} className="p-2 hover:bg-[var(--color-surface)] rounded transition-colors" >
                    <AudioLines className="w-5 h-5 text-[var(--color-text)]" />
                </button>
                <button
                    title="Mixer"
                    onClick={() => togglePanel('mixer')}
                    className="p-2 hover:bg-[var(--color-surface)] rounded transition-colors"
                >
                    <SlidersHorizontal className="w-5 h-5 text-[var(--color-text)]" />
                </button>
                <button
                    title="Piano Roll"
                    onClick={() => togglePanel('piano-roll')}
                    className="p-2 hover:bg-[var(--color-surface)] rounded transition-colors"
                >
                    <Music className="w-5 h-5 text-[var(--color-text)]" />
                </button>
                <button
                    title="Klavye Kısayolları"
                    onClick={() => togglePanel('keybindings')}
                    className="p-2 hover:bg-[var(--color-surface)] rounded transition-colors"
                >
                    <Keyboard className="w-5 h-5 text-[var(--color-text)]" />
                </button>
            </div>
        </nav>
    );
}

export default MainToolbar;