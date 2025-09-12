import { useEffect, useRef } from 'react';
import { PlaybackAnimatorService } from '../lib/core/PlaybackAnimatorService';

/**
 * @param {React.RefObject<HTMLElement>} elementRef - Canlandırılacak olan DOM elemanının ref'i.
 * @param {object} options - Animasyon için gerekli parametreler.
 * @param {number} options.fullWidth - Animasyonun gerçekleşeceği toplam genişlik (pixel).
 * @param {number} [options.offset=0] - Animasyonun başlayacağı yatay boşluk (pixel).
 */
export const usePlaybackAnimator = (elementRef, { fullWidth, offset = 0 }) => {
  const animationFrameId = useRef(null);
  const latestProgress = useRef(0);

  useEffect(() => {
    const handleProgressUpdate = (progress) => {
      latestProgress.current = progress;
    };

    PlaybackAnimatorService.subscribe(handleProgressUpdate);

    const animate = () => {
      if (elementRef.current) {
        // En son bilinen ilerlemeye göre elemanın olması gereken X pozisyonunu hesapla.
        const newX = latestProgress.current * fullWidth;
        // Konumu, ofseti de hesaba katarak 'transform' özelliği ile ayarla.
        elementRef.current.style.transform = `translateX(${offset + newX}px)`;
      }
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      PlaybackAnimatorService.unsubscribe(handleProgressUpdate);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [fullWidth, offset, elementRef]); // Bağımlılıklara 'offset' eklendi.
};