import { useLayoutEffect, useRef } from 'react';

export const useScrollSync = (sourceRef, targets, onScroll) => {
  const rafRef = useRef(null);

  useLayoutEffect(() => {
    const sourceEl = sourceRef.current;
    if (!sourceEl) return;

    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const { scrollLeft, scrollTop } = sourceEl;

        targets.forEach(({ ref, axis }) => {
          if (ref.current) {
            if (axis === 'x') {
              ref.current.style.transform = `translateX(${-scrollLeft}px)`;
            } else if (axis === 'y') {
              ref.current.style.transform = `translateY(${-scrollTop}px)`;
            }
          }
        });

        onScroll(scrollLeft, scrollTop);
      });
    };

    sourceEl.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // İlk senkronizasyon için

    return () => {
      sourceEl.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sourceRef, targets, onScroll]);
};