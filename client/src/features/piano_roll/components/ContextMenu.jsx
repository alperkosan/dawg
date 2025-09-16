import React from 'react';

// Bu fonksiyon artık kendi bileşen dosyasında
const ContextMenu = ({ contextMenu, setContextMenu }) => {
  if (!contextMenu) return null;

  const menuItems = [
    { label: 'Cut', action: () => console.log('Cut'), shortcut: 'Ctrl+X' },
    { label: 'Copy', action: () => console.log('Copy'), shortcut: 'Ctrl+C' },
    { label: 'Paste', action: () => console.log('Paste'), shortcut: 'Ctrl+V' },
    { type: 'separator' },
    { label: 'Delete', action: () => console.log('Delete'), shortcut: 'Del' },
    { label: 'Duplicate', action: () => console.log('Duplicate'), shortcut: 'Ctrl+D' },
    { type: 'separator' },
    { label: 'Quantize', action: () => console.log('Quantize'), shortcut: 'Ctrl+Q' },
    { label: 'Humanize', action: () => console.log('Humanize'), shortcut: 'Ctrl+H' },
  ];

  return (
    <div
      className="absolute bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-2 min-w-[180px] context-menu" // Sınıf adı ekledim
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onMouseLeave={() => setContextMenu(null)}
    >
      {menuItems.map((item, index) =>
        item.type === 'separator' ? (
          <div key={index} className="h-px bg-gray-600 my-1" />
        ) : (
          <button
            key={index}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 flex justify-between items-center"
            onClick={() => {
              item.action?.();
              setContextMenu(null);
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-gray-400 text-xs">{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  );
};

export default ContextMenu;