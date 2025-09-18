import React from 'react';

/**
 * Projenin temasıyla tamamen entegre, yeniden tasarlanmış sekme (tab) butonu.
 * Aktif, pasif ve üzerine gelme (hover) durumları için net görsel geri bildirim sağlar.
 * @param {string} label - Butonda gösterilecek metin.
 * @param {React.ComponentType} icon - Butonda gösterilecek Lucide ikonu.
 * @param {boolean} isActive - Butonun aktif olup olmadığını belirtir.
 * @param {Function} onClick - Butona tıklandığında çalışacak fonksiyon.
 */
function TabButton({ label, icon: Icon, isActive, onClick }) {
  // Stillerimizi CSS değişkenlerinden alıyoruz
  const activeStyle = {
    color: 'var(--color-primary)',
    borderColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-surface)',
  };

  const inactiveStyle = {
    color: 'var(--color-muted)',
    borderColor: 'transparent',
  };

  const hoverStyle = {
    color: 'var(--color-text)',
    backgroundColor: 'var(--color-surface2)',
  };
  
  // React'in stil objelerini dinamik olarak birleştirelim
  const style = {
    ... (isActive ? activeStyle : inactiveStyle),
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--gap-controls)',
    padding: '0.75rem 1rem', // py-3 px-4
    fontWeight: 'bold',
    borderBottomWidth: '2px',
    transition: 'all 200ms ease-in-out',
    outline: 'none',
  };
  
  // Hover efektini yönetmek için
  const handleMouseEnter = (e) => {
    if (!isActive) {
      Object.assign(e.currentTarget.style, hoverStyle);
    }
  };
  
  const handleMouseLeave = (e) => {
    if (!isActive) {
      e.currentTarget.style.color = inactiveStyle.color;
      e.currentTarget.style.backgroundColor = 'transparent';
    }
  };

  return (
    <button
      onClick={onClick}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="tab"
      aria-selected={isActive}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

export default TabButton;