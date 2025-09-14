import React, { useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

const PianoRollTooltip = ({ x, y, content, visible, type = 'info' }) => {
  const tooltipRef = useRef(null);
  
  // GÜNCELLEME: Konum ve opaklık artık animasyonlu geçişler için state'te yönetiliyor.
  const [position, setPosition] = useState({ top: y, left: x });
  const [opacity, setOpacity] = useState(0);
  const [transform, setTransform] = useState('scale(0.95)');

  // Bu effect, ipucunun ekranda en iyi konumu almasını sağlar ve animasyonu tetikler.
  useLayoutEffect(() => {
    if (visible && tooltipRef.current) {
      const { innerWidth, innerHeight } = window;
      const { width, height } = tooltipRef.current.getBoundingClientRect();
      const offset = 22; // İmleçten uzaklık

      let newLeft = x + offset;
      let newTop = y + offset;

      // Yatayda ekran dışına taşıyorsa, pozisyonu imlecin soluna al.
      if (newLeft + width > innerWidth) {
        newLeft = x - width - offset;
      }

      // Dikeyde ekran dışına taşıyorsa, pozisyonu imlecin üstüne al.
      if (newTop + height > innerHeight) {
        newTop = y - height - offset;
      }
      
      setPosition({ top: newTop, left: newLeft });
      // Yumuşak bir "pop" efekti için state'leri güncelle.
      setOpacity(1);
      setTransform('scale(1)');
    } else {
      // Gizlenirken animasyonlu bir şekilde kaybolmasını sağla.
      setOpacity(0);
      setTransform('scale(0.95)');
    }
  }, [x, y, content, visible]);

  // Eğer tamamen görünmez ise, performansı artırmak için hiç render etme.
  if (!visible && opacity === 0) {
    return null;
  }

  // Farklı ipucu türleri için stil tanımlamaları
  const typeStyles = {
    info: 'bg-gray-900 text-white border-gray-700',
    warning: 'bg-yellow-900 text-yellow-100 border-yellow-700',
    error: 'bg-red-900 text-red-100 border-red-700',
    success: 'bg-green-900 text-green-100 border-green-700'
  };

  // Tooltip'in JSX içeriği
  const tooltipContent = (
    <div
      ref={tooltipRef}
      className={`
        fixed z-50 px-3 py-2 text-xs rounded-lg shadow-xl pointer-events-none
        border ${typeStyles[type]}
      `}
      style={{
        // GÜNCELLEME: Stil artık doğrudan state'ten besleniyor.
        left: position.left,
        top: position.top,
        opacity: opacity,
        transform: transform,
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        maxWidth: '200px',
      }}
    >
      {typeof content === 'string' ? <div>{content}</div> : content}
    </div>
  );

  return ReactDOM.createPortal(tooltipContent, document.body);
};

export default PianoRollTooltip;