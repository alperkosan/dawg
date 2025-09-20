import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { pluginRegistry } from '../config/pluginConfig';

// Akıllı alt menü bileşeni
const MenuItem = ({ category, plugins, onSelect }) => {
    const itemRef = useRef(null);
    const [subMenuPositionClass, setSubMenuPositionClass] = useState('left-full');

    // Alt menünün ekran dışına taşmasını engellemek için pozisyonunu hesapla
    const handleMouseEnter = () => {
        if (itemRef.current) {
            const parentRect = itemRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const subMenuWidth = 256; // Alt menünün tahmini genişliği
            if (parentRect.right + subMenuWidth > viewportWidth) {
                // Sağa sığmıyorsa, sola aç
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

// Ana menü bileşeni - YENİ AKILLI KONUMLANDIRMA MANTIĞI İLE
export function AddEffectMenu({ onSelect, onClose, x, y }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, opacity: 0 });

  const categorizedPlugins = Object.values(pluginRegistry).reduce((acc, plugin) => {
    const category = plugin.category || 'Diğer';
    if (!acc[category]) acc[category] = [];
    acc[category].push(plugin);
    return acc;
  }, {});

  // Menünün açılacağı en iyi pozisyonu hesaplayan hook
  useLayoutEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const margin = 10; // Kenar boşluğu

      // 4 potansiyel pozisyonu hesapla
      const positions = {
        bottomRight: { top: y + margin, left: x + margin },
        bottomLeft: { top: y + margin, left: x - menuRect.width - margin },
        topRight: { top: y - menuRect.height - margin, left: x + margin },
        topLeft: { top: y - menuRect.height - margin, left: x - menuRect.width - margin },
      };

      // Her pozisyonun ne kadar "uygun" olduğunu hesapla (ekran içinde ne kadar alan kapladığı)
      const scores = {};
      for (const key in positions) {
        const pos = positions[key];
        if (pos.top >= 0 && pos.top + menuRect.height <= viewportHeight &&
            pos.left >= 0 && pos.left + menuRect.width <= viewportWidth) {
          scores[key] = (viewportWidth - (pos.left + menuRect.width)) * (viewportHeight - (pos.top + menuRect.height));
        } else {
          scores[key] = -1; // Uygun değil
        }
      }
      
      // En yüksek skora sahip pozisyonu seç
      const bestPosition = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b, 'bottomRight');
      
      setPosition({ ...positions[bestPosition], opacity: 1 });
    }
  }, [x, y]);

  // Dışarı tıklandığında menüyü kapat
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
      className="fixed z-[1000] w-64 bg-gray-900 border border-gray-700 rounded-md shadow-2xl p-1 transition-opacity duration-150"
      style={{ top: position.top, left: position.left, opacity: position.opacity }}
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

  return ReactDOM.createPortal(menuContent, document.body);
}