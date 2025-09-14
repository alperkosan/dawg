import React from 'react';

// Kalem aracıyla notanın üzerine gelindiğinde, nota oluşturulmadan önce
// yerini gösteren bir önizleme bileşeni.
const GhostNote = ({ position, dimensions, isValid }) => {
  if (!position) return null;

  const baseClasses = "absolute pointer-events-none rounded transition-all duration-100";
  const stateClasses = isValid 
    ? 'bg-cyan-400/30 border-2 border-dashed border-cyan-400' 
    : 'bg-red-400/30 border-2 border-dashed border-red-400';

  return (
    <div
      className={`${baseClasses} ${stateClasses}`}
      style={{
        left: position.x,
        top: position.y,
        width: dimensions.width,
        height: dimensions.height,
        transform: 'scale(1.02)', // Hafif büyük göster
        boxShadow: `0 0 15px ${isValid ? 'rgba(56,189,248,0.4)' : 'rgba(248,113,113,0.4)'}`
      }}
    />
  );
};

export default GhostNote;