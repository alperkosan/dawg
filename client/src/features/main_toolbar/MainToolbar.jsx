import React from 'react';
import { LayoutGrid, SlidersHorizontal, AudioLines, Music, Keyboard } from 'lucide-react';
import { usePanelsStore } from '../../store/usePanelsStore';

function MainToolbar() {
    // Sadece togglePanel fonksiyonuna ihtiyacımız var.
    const togglePanel = usePanelsStore(state => state.togglePanel);

    return (
        <nav className="h-16 bg-gray-900 border-b-2 border-gray-950 flex items-center justify-between px-4 shrink-0 shadow-lg">
            <div></div>
            <div className="flex items-center gap-2">
                <button title="Arrangement" className="p-2 hover:bg-gray-700 rounded transition-colors">
                    <LayoutGrid className="w-6 h-6 text-gray-400" />
                </button>
                <button
                    title="Channel Rack"
                    onClick={() => togglePanel('channel-rack')}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                >
                    <AudioLines className="w-6 h-6 text-gray-400" />
                </button>
                <button
                    title="Mixer"
                    onClick={() => togglePanel('mixer')}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                >
                    <SlidersHorizontal className="w-6 h-6 text-gray-400" />
                </button>
                <button
                    title="Piano Roll"
                    onClick={() => togglePanel('piano-roll')}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                >
                    <Music className="w-6 h-6 text-gray-400" />
                </button>
                <button
                    title="Klavye Kısayolları"
                    onClick={() => togglePanel('keybindings')}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                >
                    <Keyboard className="w-6 h-6 text-gray-400" />
                </button>
            </div>
        </nav>
    );
}

export default MainToolbar;