import React from 'react';
import { SlidersHorizontal, AudioLines, Music, Edit } from 'lucide-react';
import { usePanelsStore } from '../../store/usePanelsStore';
import { shallow } from 'zustand/shallow'; // shallow'ı import et

const panelIcons = {
  'channel-rack': AudioLines,
  'mixer': SlidersHorizontal,
  'piano-roll': Music,
  'sample-editor': Edit,
};

function Taskbar() {
  const minimizedPanels = usePanelsStore(state => state.minimizedPanels);
  const handleRestore = usePanelsStore(state => state.handleRestore);

  if (!minimizedPanels || minimizedPanels.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gray-950/80 backdrop-blur-sm flex items-center px-4 gap-x-2 z-50 border-t border-gray-700">
      {minimizedPanels.map(({ id, title }) => {
        const Icon = panelIcons[id] || Edit;
        return (
          <button
            key={id}
            onClick={() => handleRestore(id)}
            className="bg-gray-700 hover:bg-cyan-600 h-8 px-3 rounded flex items-center gap-2 text-sm text-white transition-colors"
            title={`Restore ${title}`}
          >
            <Icon size={16} />
            <span className="truncate">{title}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Taskbar;