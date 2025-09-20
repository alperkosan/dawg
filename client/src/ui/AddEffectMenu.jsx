import React, { useEffect, useRef, useLayoutEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { ChevronRight, Search, X } from 'lucide-react';
import { pluginRegistry } from '../config/pluginConfig';

// YENİ: Portal'da render edilecek alt menü bileşeni
const SubMenu = ({ parentRef, plugins, onSelect, onClose }) => {
    const subMenuRef = useRef(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useLayoutEffect(() => {
        if (parentRef.current && subMenuRef.current) {
            const parentRect = parentRef.current.getBoundingClientRect();
            const subMenuRect = subMenuRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;

            let left = parentRect.right;
            // Eğer sağa açılırsa ekranın dışına taşacaksa, sola aç
            if (parentRect.right + subMenuRect.width > viewportWidth) {
                left = parentRect.left - subMenuRect.width;
            }

            setPosition({ top: parentRect.top, left });
        }
    }, [parentRef]);

    return ReactDOM.createPortal(
        <ul
            ref={subMenuRef}
            className="add-effect-menu__submenu" // Stiller aynı kalacak
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
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
        </ul>,
        document.body
    );
};


const MenuItem = ({ category, plugins, onSelect }) => {
    const itemRef = useRef(null);
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
    const timerRef = useRef(null);

    const handleMouseEnter = () => {
        clearTimeout(timerRef.current);
        setIsSubMenuOpen(true);
    };

    const handleMouseLeave = () => {
        timerRef.current = setTimeout(() => {
            setIsSubMenuOpen(false);
        }, 150); // Hafif bir gecikme ile kapanmasını sağla
    };

    return (
        <li 
            ref={itemRef} 
            onMouseEnter={handleMouseEnter} 
            onMouseLeave={handleMouseLeave} 
            className="add-effect-menu__item"
        >
            <div className="add-effect-menu__item-content">
                <span>{category}</span>
                <ChevronRight size={16} className="text-gray-500" />
            </div>
            {isSubMenuOpen && (
                <SubMenu 
                    parentRef={itemRef} 
                    plugins={plugins} 
                    onSelect={onSelect}
                    onClose={() => setIsSubMenuOpen(false)}
                />
            )}
        </li>
    );
};

// Ana bileşende değişiklik yok, sadece MenuItem'ı kullanıyor
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