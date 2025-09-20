import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { pluginRegistry } from '../config/pluginConfig';

// Akıllı alt menü öğesi bileşeni (değişiklik yok, ama burada olması önemli)
const MenuItem = ({ category, plugins, onSelect }) => {
    const itemRef = useRef(null);
    const [subMenuPositionClass, setSubMenuPositionClass] = useState('left-full');

    const handleMouseEnter = () => {
        if (itemRef.current) {
            const parentRect = itemRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const subMenuWidth = 256; 
            if (parentRect.right + subMenuWidth > viewportWidth) {
                setSubMenuPositionClass('right-full');
            } else {
                setSubMenuPositionClass('left-full');
            }
        }
    };

    return (
        <li ref={itemRef} onMouseEnter={handleMouseEnter} className="relative group">
            <div className="flex items-center justify-between px-3 py-1.5 text-sm rounded hover:bg-cyan-700 transition-colors cursor-default">
                <span className="font-bold text-white">{category}</span>
                <ChevronRight size={16} className="text-gray-400" />
            </div>
            <ul className={`absolute top-0 mt-[-5px] w-64 bg-gray-900 border border-gray-700 rounded-md shadow-2xl p-1
                           invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150
                           flex flex-col gap-1 ${subMenuPositionClass}`}>
                {plugins.map(plugin => (
                    <li key={plugin.type}>
                        <button
                            onClick={() => onSelect(plugin.type)}
                            className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-cyan-600 transition-colors"
                        >
                            <span className="text-white">{plugin.type}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </li>
    );
};

export function AddEffectMenu({ onSelect, onClose, x, y }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: y, left: x, opacity: 0 });

  const categorizedPlugins = Object.values(pluginRegistry).reduce((acc, plugin) => {
    const category = plugin.category || 'Diğer';
    if (!acc[category]) acc[category] = [];
    acc[category].push(plugin);
    return acc;
  }, {});

  useLayoutEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let finalY = y;
      let finalX = x;

      if (y + menuRect.height > viewportHeight) {
        finalY = y - menuRect.height;
      }
      if (x + menuRect.width > viewportWidth) {
          finalX = x - menuRect.width;
      }
      
      setPosition({ top: finalY, left: finalX, opacity: 1 });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Menüye veya onu açan butona tıklanmadığından emin ol
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    // mousedown, click'ten önce çalıştığı için daha güvenilir
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 bg-gray-900 border border-gray-700 rounded-md shadow-2xl p-1 transition-opacity duration-150"
      style={{ top: position.top, left: position.left, opacity: position.opacity }}
      // Olayların yukarı yayılmasını engelle, böylece dışarıya tıklama mekanizması bozulmaz
      onClick={(e) => e.stopPropagation()} 
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ul className="flex flex-col gap-1">
        {Object.entries(categorizedPlugins).map(([category, plugins]) => (
          <MenuItem key={category} category={category} plugins={plugins} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );

  // Portalı, `document.body`'nin sonuna ekliyoruz.
  return ReactDOM.createPortal(menuContent, document.body);
}
