import { useEffect, useRef } from 'react';
import { PlaybackAnimatorService } from '../lib/core/PlaybackAnimatorService';

export const usePlaybackAnimator = (elementRef, options = {}) => {
  // YENİ: seçeneklerden playbackState'i alıyoruz
  const { fullWidth, offset = 0, smoothing = false, playbackState } = options;
  
  const lastProgressRef = useRef(0);
  const smoothProgressRef = useRef(0);
  const animationRef = useRef(null);

  // YENİ: Playback durumu değiştiğinde pozisyonu sıfırlayan useEffect
  useEffect(() => {
    if (playbackState === 'stopped') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Playback durduğunda, pozisyonu anında ve animasyonsuz olarak başa al.
      if (elementRef.current) {
        elementRef.current.style.transition = 'none'; // Anlık değişim için geçişi kaldır
        elementRef.current.style.transform = `translateX(${offset}px)`;
        // Kısa bir süre sonra geçişi tekrar ekle
        setTimeout(() => {
            if(elementRef.current) elementRef.current.style.transition = '';
        }, 50);
      }
      lastProgressRef.current = 0;
      smoothProgressRef.current = 0;
    }
  }, [playbackState, offset, elementRef]);

  useEffect(() => {
    if (!elementRef?.current || typeof fullWidth !== 'number' || fullWidth <= 0) return;

    const handleProgressUpdate = (progress) => {
      // Çalma durumu 'playing' değilse güncelleme yapma (duraklatıldığında pozisyonda kalır)
      if (playbackState !== 'playing' || !elementRef.current) return;
      
      const isLoopRestart = progress < lastProgressRef.current && lastProgressRef.current > 0.9;
      if (isLoopRestart) {
        smoothProgressRef.current = progress;
      }
      lastProgressRef.current = progress;

      const updatePosition = () => {
          if (!elementRef.current) return;
          let currentProgress = progress;
          if (smoothing && !isLoopRestart) {
              const smoothFactor = 0.2;
              smoothProgressRef.current += (progress - smoothProgressRef.current) * smoothFactor;
              currentProgress = smoothProgressRef.current;
          } else {
              smoothProgressRef.current = progress;
          }
          const xPosition = (currentProgress * fullWidth) + offset;
          elementRef.current.style.transform = `translateX(${xPosition}px)`;
          if (smoothing && Math.abs(currentProgress - progress) > 0.001) {
            animationRef.current = requestAnimationFrame(updatePosition);
          }
      };
      
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(updatePosition);
    };

    PlaybackAnimatorService.subscribe(handleProgressUpdate);

    return () => {
      PlaybackAnimatorService.unsubscribe(handleProgressUpdate);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [fullWidth, offset, smoothing, elementRef, playbackState]);

  return {};
};