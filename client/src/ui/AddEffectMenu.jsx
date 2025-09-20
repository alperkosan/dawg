import React, { useEffect, useRef, useLayoutEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { ChevronRight, Search, X } from 'lucide-react';
import { pluginRegistry } from '../config/pluginConfig';

// Tek bir kategori ve onun alt menüsünü yöneten bileşen
const MenuItem = ({ category, plugins, onSelect }) => {
    const itemRef = useRef(null);
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
    const [subMenuPositionClass, setSubMenuPositionClass] = useState('left-full');
    
    // YENİ: Zamanlayıcıyı saklamak için bir ref
    const closeTimerRef = useRef(null);

    // Mouse bir menü öğesinin (ana veya alt) üzerine geldiğinde
    const handleMouseEnter = () => {
        // Kapanmak üzere olan bir zamanlayıcı varsa onu iptal et
        clearTimeout(closeTimerRef.current);

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
        // Alt menüyü hemen aç
        setIsSubMenuOpen(true);
    };
    
    // Mouse bir menü öğesinden (ana veya alt) ayrıldığında
    const handleMouseLeave = () => {
        // Alt menüyü 150ms sonra kapatmak için bir zamanlayıcı başlat
        closeTimerRef.current = setTimeout(() => {
            setIsSubMenuOpen(false);
        }, 150);
    };

    return (
        <li ref={itemRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="add-effect-menu__item">
            <div className="add-effect-menu__item-content">
                <span>{category}</span>
                <ChevronRight size={16} className="text-gray-500" />
            </div>
            {isSubMenuOpen && (
                <ul className={`add-effect-menu__submenu ${subMenuPositionClass}`}>
                    {plugins.map(plugin => (
                        <li key={plugin.type}>
                            <button
                                onClick={() => onSelect(plugin.type)}
                                className="add-effect-menu__plugin-btn"
                            >
                                <span>{plugin.type}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
};

// Ana AddEffectMenu bileşeninin geri kalanı aynı
export function AddEffectMenu({ onSelect, onClose, x, y }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: y, left: x, opacity: 0 });
  const [searchTerm, setSearchTerm] = useState('');

  const categorizedPlugins = useMemo(() => {
    return Object.values(pluginRegistry)
      .filter(p => p.type.toLowerCase().includes(searchTerm.toLowerCase()))
      .reduce((acc, plugin) => {
        const category = plugin.category || 'Diğer';
        if (!acc[category]) acc[category] = [];
        acc[category].push(plugin);
        return acc;
      }, {});
  }, [searchTerm]);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const { innerWidth, innerHeight } = window;
      let finalX = x;
      let finalY = y;

      if (x + menuRect.width > innerWidth) finalX = innerWidth - menuRect.width - 10;
      if (y + menuRect.height > innerHeight) finalY = innerHeight - menuRect.height - 10;
      
      setPosition({ top: finalY, left: finalX, opacity: 1 });
    }
  }, [x, y]);

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
      className="add-effect-menu"
      style={{ top: position.top, left: position.left, opacity: position.opacity }}
      onClick={(e) => e.stopPropagation()} 
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="add-effect-menu__search-container">
        <Search size={16} className="add-effect-menu__search-icon" />
        <input
          type="text"
          placeholder="Efekt ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="add-effect-menu__search-input"
          autoFocus
        />
        {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="add-effect-menu__clear-btn">
                <X size={14}/>
            </button>
        )}
      </div>
      <ul className="add-effect-menu__list">
        {Object.entries(categorizedPlugins).map(([category, plugins]) => (
          <MenuItem key={category} category={category} plugins={plugins} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );

  return ReactDOM.createPortal(menuContent, document.body);
}