import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { pluginRegistry } from '../config/pluginConfig';

export function AddEffectMenu({ onSelect, onClose, x, y }) {
  const menuRef = useRef(null);

  const categorizedPlugins = Object.values(pluginRegistry).reduce((acc, plugin) => {
    const category = plugin.category || 'Diğer';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(plugin);
    return acc;
  }, {});

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 bg-gray-900 border border-gray-700 rounded-md shadow-2xl p-1"
      style={{ top: y, left: x }}
    >
      <ul className="flex flex-col gap-1">
        {Object.entries(categorizedPlugins).map(([category, plugins]) => (
          <li key={category} className="relative group">
            <div className="flex items-center justify-between px-3 py-1.5 text-sm rounded hover:bg-cyan-700 transition-colors cursor-default">
              {/* YENİ: Metin rengini beyaz yapıyoruz */}
              <span className="font-bold text-white">{category}</span> 
              <ChevronRight size={16} className="text-gray-400" /> {/* Ok ikonunun rengi */}
            </div>
            <ul className="absolute left-full top-0 mt-[-5px] w-64 bg-gray-900 border border-gray-700 rounded-md shadow-2xl p-1
                           invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150
                           flex flex-col gap-1">
              {plugins.map(plugin => (
                <li key={plugin.type}>
                  <button
                    onClick={() => onSelect(plugin.type)}
                    className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-cyan-600 transition-colors"
                  >
                    {/* YENİ: Metin rengini beyaz yapıyoruz */}
                    <span className="text-white">{plugin.type}</span> 
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );

  return ReactDOM.createPortal(menuContent, document.body);
}