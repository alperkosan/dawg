import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Check, ChevronRight } from 'lucide-react';

// HATA DÜZELTMESİ: Menü öğeleri için her zaman benzersiz ve geçerli bir
// string key üreten yardımcı fonksiyon.
const generateUniqueKey = (option, index) => {
    // Ayırıcılar için index tabanlı bir key yeterlidir.
    if (option.type === 'separator') {
        return `separator-${index}`;
    }
    // Eğer label bir string ise, en iyi key odur.
    if (typeof option.label === 'string') {
        return option.label;
    }
    // Eğer label bir React elemanıysa (örn: renk kutucuğu),
    // içindeki benzersiz bir değerden key türetmeye çalış.
    if (React.isValidElement(option.label) && option.label.props?.style?.backgroundColor) {
        return `color-${option.label.props.style.backgroundColor}`;
    }
    // Hiçbiri işe yaramazsa, son çare olarak index'i kullan.
    return `menu-item-${index}`;
};


// YENİ: Hem ana menü hem de alt menü öğelerini render etmek için
// yeniden kullanılabilir ve özyineli (recursive) bir bileşen.
const MenuItem = ({ option, onClose }) => {
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
    
    const handleMouseEnter = () => { if (option.children) setIsSubMenuOpen(true); };
    const handleMouseLeave = () => { if (option.children) setIsSubMenuOpen(false); };

    if (option.type === 'separator') {
        return <div className="h-px bg-gray-700/50 my-1" />;
    }

    return (
        <li onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="relative">
            <button
              onClick={() => {
                if(option.action) {
                    option.action();
                    onClose();
                }
              }}
              disabled={!option.action && !!option.children}
              className="w-full flex items-center justify-between text-left px-3 py-1.5 text-sm rounded hover:bg-cyan-600 transition-colors text-gray-200 disabled:text-gray-500"
            >
              <div className="flex items-center gap-2">
                <div style={{width: 16}}>
                    {option.isActive && <Check size={16} className="text-cyan-400"/>}
                </div>
                <span>{option.label}</span>
              </div>
              {option.children && <ChevronRight size={16} className="text-gray-500" />}
            </button>

            {isSubMenuOpen && option.children && (
                <ul className="absolute left-full -top-1 w-48 bg-gray-900 border border-gray-700 rounded-md shadow-2xl p-1">
                    {option.children.map((childOption, index) => (
                        // HATA DÜZELTMESİ: Artık yeni ve güvenilir fonksiyonumuzu kullanıyoruz.
                        <MenuItem key={generateUniqueKey(childOption, index)} option={childOption} onClose={onClose} />
                    ))}
                </ul>
            )}
        </li>
    );
};


function ChannelContextMenu({ x, y, onClose, options }) {
  const menuRef = useRef(null);

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
      className="fixed z-[100] bg-gray-900 border border-gray-700 rounded-md shadow-2xl p-1 min-w-[180px]"
      style={{ top: y, left: x }}
    >
      <ul>
        {options.map((option, index) => (
          // HATA DÜZELTMESİ: Artık yeni ve güvenilir fonksiyonumuzu kullanıyoruz.
          <MenuItem key={generateUniqueKey(option, index)} option={option} onClose={onClose} />
        ))}
      </ul>
    </div>
  );

  return ReactDOM.createPortal(menuContent, document.body);
}

export default ChannelContextMenu;

