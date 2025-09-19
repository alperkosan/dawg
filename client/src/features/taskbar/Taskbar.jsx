import React from 'react';
import { SlidersHorizontal, AudioLines, Music, Edit } from 'lucide-react';
import { usePanelsStore } from '../../store/usePanelsStore';
import { PANEL_IDS } from '../../config/constants'; // GÜNCELLENDİ

const panelIcons = {
  'channel-rack': AudioLines,
  'mixer': SlidersHorizontal,
  'piano-roll': Music,
  'sample-editor': Edit,
  // Diğer panel ikonları buraya eklenebilir
};

function Taskbar() {
  const minimizedPanels = usePanelsStore(state => state.minimizedPanels);
  const handleRestore = usePanelsStore(state => state.handleRestore);

  if (!minimizedPanels || minimizedPanels.length === 0) {
    return null;
  }

  return (
    <div className="taskbar">
      {minimizedPanels.map(({ id, title }) => {
        const Icon = panelIcons[id] || Edit;
        return (
          <button
            key={id}
            onClick={() => handleRestore(id)}
            className="taskbar__item"
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
