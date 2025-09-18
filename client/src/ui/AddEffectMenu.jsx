import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { pluginRegistry } from '../config/pluginConfig';

// Akıllı alt menü öğesi bileşeni
const MenuItem = ({ category, plugins, onSelect }) => {
    const itemRef = useRef(null);
    // Alt menünün hangi yöne açılacağını tutan state
    const [subMenuPositionClass, setSubMenuPositionClass] = useState('left-full');

    const handleMouseEnter = () => {
        if (itemRef.current) {
            const parentRect = itemRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const subMenuWidth = 256; // Alt menünün tahmini genişliği (256px)

            // Eğer sağda yeterli alan yoksa, sola doğru açılmasını sağla
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
  // Menünün son pozisyonunu ve görünürlüğünü tutan state
  const [position, setPosition] = useState({ top: y, left: x, opacity: 0 });

  const categorizedPlugins = Object.values(pluginRegistry).reduce((acc, plugin) => {
    const category = plugin.category || 'Diğer';
    if (!acc[category]) acc[category] = [];
    acc[category].push(plugin);
    return acc;
  }, {});

  // Bu "sihirli" hook, bileşen ekrana çizilmeden hemen önce çalışır.
  // Bu sayede menünün boyutlarını ölçüp, taşma durumunda pozisyonunu anında düzeltebiliriz.
  useLayoutEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      let finalY = y;

      // Eğer menü, alt kenardan taşıyorsa...
      if (y + menuRect.height > viewportHeight) {
        // ...menüyü, yüksekliği kadar yukarı kaydırarak aç.
        finalY = y - menuRect.height;
      }
      
      // Menünün son, akıllı pozisyonunu ayarla ve görünür yap.
      setPosition({ top: finalY, left: x, opacity: 1 });
    }
  }, [x, y]);

  // Dışarı tıklandığında menüyü kapatan standart hook
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
      className="fixed z-50 w-64 bg-gray-900 border border-gray-700 rounded-md shadow-2xl p-1 transition-opacity duration-150"
      // Akıllıca hesaplanmış pozisyonu ve başlangıçta görünmez olmasını sağlayan stil
      style={{ top: position.top, left: position.left, opacity: position.opacity }}
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
