// src/components/WindowControls.jsx
import React from 'react';
import { X, Minus, Square, Minimize2 } from 'lucide-react';

function WindowControls({ onMinimize, onMaximize, onClose, isMaximized }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onMinimize} className="p-1 rounded-full hover:bg-gray-700 transition-colors" title="Küçült">
        <Minus size={16} />
      </button>
      {/* YENİ: isMaximized durumuna göre ikonu ve başlığı değiştiriyoruz. */}
      <button onClick={onMaximize} className="p-1 rounded-full hover:bg-gray-700 transition-colors" title={isMaximized ? 'Önceki Boyut' : 'Tam Ekran'}>
        {isMaximized ? <Minimize2 size={16} /> : <Square size={16} />}
      </button>
      <button onClick={onClose} className="p-1 rounded-full hover:bg-red-500 transition-colors" title="Kapat">
        <X size={16} />
      </button>
    </div>
  );
}

export default WindowControls;