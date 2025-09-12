// Başlangıç pozisyonu ve her yeni pencere için eklenecek ofset miktarı
const CASCADE_OFFSET = 25;
const INITIAL_POS = { x: 300, y: 50 };

/**
 * Yeni açılacak bir pencere için en uygun pozisyonu hesaplar.
 * @param {Object} panels - Mevcut tüm panellerin state'ini içeren nesne (usePanelsStore'dan).
 * @returns {{x: number, y: number}} - Yeni pencere için hesaplanmış x ve y koordinatları.
 */
export const getNextCascadePosition = (panels) => {
  // Açık ve küçültülmemiş olan pencereleri bul
  const openPanels = Object.values(panels).filter(p => p.isOpen && !p.isMinimized);

  // Eğer hiç açık pencere yoksa veya sadece 1 tane (kendisi) varsa, başlangıç pozisyonunu kullan
  if (openPanels.length <= 1) {
    return INITIAL_POS;
  }

  // En son açılan pencereyi bulmak için pozisyonlarını karşılaştır
  let lastPosition = { x: -1, y: -1 };
  let topPanel = null;

  openPanels.forEach(panel => {
    if (panel.position.y > lastPosition.y) {
      lastPosition = panel.position;
      topPanel = panel;
    } else if (panel.position.y === lastPosition.y && panel.position.x > lastPosition.x) {
      lastPosition = panel.position;
      topPanel = panel;
    }
  });

  if (!topPanel) {
    return INITIAL_POS;
  }
  
  // Yeni pozisyonu, son pencerenin pozisyonuna ofset ekleyerek hesapla
  return {
    x: topPanel.position.x + CASCADE_OFFSET,
    y: topPanel.position.y + CASCADE_OFFSET
  };
};