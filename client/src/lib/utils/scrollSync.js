/**
 * @file scrollSync.js
 * @description Farklı DOM elemanları arasında scroll pozisyonunu senkronize etmek
 * ve mouse tekerleği olaylarını yönlendirmek için yardımcı fonksiyonlar.
 * Bu, Piano Roll gibi karmaşık arayüzlerde performansı yüksek tutmak için kritiktir.
 */

/**
 * Bir ana kaydırma alanının pozisyonunu, bir veya daha fazla hedef alana senkronize eder.
 * @param {React.RefObject} sourceRef - Ana kaydırılabilir alanın referansı.
 * @param {Array<{ref: React.RefObject, axis: 'x'|'y'|'both'}>} targets - Pozisyonları senkronize edilecek hedef alanlar.
 * @returns {function} Olay dinleyicilerini temizleyen bir cleanup fonksiyonu.
 */
export const createScrollSynchronizer = (sourceRef, targets, onScrollChange) => {
  let isSyncing = false;
  let rafId = null;

  const handleScroll = () => {
      if (!sourceRef.current || isSyncing) return;
      
      // Önceki frame'i iptal et
      if (rafId) cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
          isSyncing = true;
          const { scrollLeft, scrollTop } = sourceRef.current;

          targets.forEach(({ ref, axis = 'both' }) => {
              if (ref.current) {
                  // Her iki ekseni tek transform'da birleştir
                  let transformX = 0;
                  let transformY = 0;
                  
                  if (axis === 'x' || axis === 'both') {
                      transformX = -scrollLeft;
                  }
                  if (axis === 'y' || axis === 'both') {
                      transformY = -scrollTop;
                  }
                  
                  // Tek bir transform ataması yap
                  ref.current.style.transform = 
                      `translate3d(${transformX}px, ${transformY}px, 0)`;
              }
          });

          // Callback varsa çağır
          if (onScrollChange) {
              onScrollChange(scrollLeft, scrollTop);
          }
          
          isSyncing = false;
      });
  };

  const sourceElement = sourceRef.current;
  if (sourceElement) {
      sourceElement.addEventListener('scroll', handleScroll, { passive: true });
      // İlk senkronizasyonu yap
      handleScroll();
  }

  return () => {
      if (sourceElement) {
          sourceElement.removeEventListener('scroll', handleScroll);
      }
      if (rafId) {
          cancelAnimationFrame(rafId);
      }
  };
};

/**
 * Bir eleman üzerindeki mouse tekerleği olaylarını başka bir elemana yönlendirir.
 * Örn: Enstrüman listesi üzerinde tekerleği çevirince ana grid'i kaydırmak için.
 * @param {React.RefObject} sourceRef - Olayların yakalanacağı kaynak.
 * @param {React.RefObject} targetRef - Olayların yönlendirileceği hedef.
 * @param {'x' | 'y'} axis - Hangi eksendeki kaydırmanın yönlendirileceği.
 * @returns {function} Cleanup fonksiyonu.
 */
export const createWheelForwarder = (sourceRef, targetRef, axis = 'y') => {
  const handleWheel = (e) => {
    if (targetRef.current) {
      // Varsayılan sayfa kaydırmasını engelle
      e.preventDefault();
      
      if (axis === 'y') {
        targetRef.current.scrollTop += e.deltaY;
      }
      if (axis === 'x') {
        targetRef.current.scrollLeft += e.deltaX;
      }
    }
  };
  
  const sourceElement = sourceRef.current;
  if (sourceElement) {
    sourceElement.addEventListener('wheel', handleWheel, { passive: false });
  }

  return () => {
    if (sourceElement) {
      sourceElement.removeEventListener('wheel', handleWheel);
    }
  };
};
