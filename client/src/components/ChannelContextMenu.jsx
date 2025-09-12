import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Check, X } from 'lucide-react';

function ChannelContextMenu({ x, y, onClose, options }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    // Mousedown yerine click olayını dinlemek daha güvenilir olabilir
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [onClose]);

  // Menünün JSX içeriğini bir değişkene alıyoruz.
  const menuContent = (
    <div
      ref={menuRef}
      // DEĞİŞİKLİK: 'absolute' yerine 'fixed' kullanarak
      // pozisyonlamayı tüm pencereye göre yapıyoruz.
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-md shadow-2xl p-1 min-w-[180px]"
      style={{ top: y, left: x }}
    >
      <ul>
        {options.map((option) => (
          <li key={option.label}>
            <button
              onClick={() => {
                option.action();
                onClose();
              }}
              className="w-full flex items-center justify-between text-left px-3 py-1.5 text-sm rounded hover:bg-cyan-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                {option.isActive ? (
                    <Check size={16} className="text-cyan-400"/>
                ) : (
                    <div style={{width: 16}}></div>
                )}
                <span className='text-white'>{option.label}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  // YENİ: Menü içeriğini bir portal aracılığıyla document.body'e render ediyoruz.
  return ReactDOM.createPortal(menuContent, document.body);
}

export default ChannelContextMenu;