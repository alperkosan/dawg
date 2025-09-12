import React from 'react';

// FL Studio'daki gibi, aktif olduğunda yanan bir LED'i olan
// yeniden kullanılabilir bir efekt anahtarı.
function EffectSwitch({ label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
    >
      {/* LED Göstergesi */}
      <div className="w-4 h-4 rounded-full flex items-center justify-center bg-gray-900 shadow-inner">
        <div
          className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
            isActive ? 'bg-cyan-400 shadow-[0_0_5px_1px_rgba(56,189,248,0.7)]' : 'bg-gray-600'
          }`}
        />
      </div>
      <span>{label}</span>
    </button>
  );
}

export default EffectSwitch;
