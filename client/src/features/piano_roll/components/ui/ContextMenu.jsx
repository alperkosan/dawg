// src/features/piano_roll/components/ui/ContextMenu.jsx
import React, { useCallback } from 'react';
import { usePianoRollStore } from '../../store';
import '../../styles/components/ContextMenu.css';

export const ContextMenu = React.memo(({ contextMenu, setContextMenu, onAction }) => {
  const { gridSnapValue } = usePianoRollStore();
  
  const handleAction = useCallback((action) => {
    if (action) {
      onAction(action, contextMenu.data);
    }
    setContextMenu(null);
  }, [onAction, contextMenu, setContextMenu]);
  
  if (!contextMenu) return null;

  const menuItems = [
    { label: 'Cut', action: 'cut', shortcut: 'Ctrl+X', enabled: contextMenu.data?.selectedNotes?.size > 0 },
    { label: 'Copy', action: 'copy', shortcut: 'Ctrl+C', enabled: contextMenu.data?.selectedNotes?.size > 0 },
    { label: 'Paste', action: 'paste', shortcut: 'Ctrl+V', enabled: contextMenu.data?.hasClipboard },
    { type: 'separator' },
    { label: 'Delete', action: 'delete', shortcut: 'Del', enabled: contextMenu.data?.selectedNotes?.size > 0 },
    { label: 'Duplicate', action: 'duplicate', shortcut: 'Ctrl+D', enabled: contextMenu.data?.selectedNotes?.size > 0 },
    { type: 'separator' },
    { label: `Quantize (${gridSnapValue})`, action: 'quantize', shortcut: 'Ctrl+Q', enabled: contextMenu.data?.selectedNotes?.size > 0 },
    { label: 'Humanize', action: 'humanize', shortcut: 'Ctrl+H', enabled: contextMenu.data?.selectedNotes?.size > 0 },
    { type: 'separator' },
    { label: 'Select All', action: 'selectAll', shortcut: 'Ctrl+A', enabled: true },
    { label: 'Invert Selection', action: 'invertSelection', shortcut: 'Ctrl+Shift+I', enabled: true },
  ];

  return (
    <div
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onMouseLeave={() => setContextMenu(null)}
    >
      {menuItems.map((item, index) =>
        item.type === 'separator' ? (
          <div key={index} className="context-menu__separator" />
        ) : (
          <button
            key={index}
            className="context-menu__item"
            disabled={!item.enabled}
            onClick={() => handleAction(item.action)}
          >
            <span className="context-menu__label">{item.label}</span>
            {item.shortcut && (
              <span className="context-menu__shortcut">{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  );
});
