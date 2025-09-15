import { useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { usePlaybackStore } from '../store/usePlaybackStore';

/**
 * @file usePlaybackAnimator.js - NİHAİ SÜRÜM
 * @description Playhead pozisyonunu, döngü uzunluğundan tamamen bağımsız,
 * doğrudan BPM ve anlık transport zamanına göre hesaplayan, tam senkronize animasyon kancası.
 */
export const usePlaybackAnimator = (elementRef, options = {}) => {
  const { stepWidth, playbackState } = options;
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Çalma durumu 'playing' ise animasyon döngüsünü başlat
    if (playbackState === 'playing') {
      const animate = () => {
        // Doğrudan Tone.js'ten anlık saniyeyi al
        const transportSeconds = Tone.Transport.seconds;
        
        // Saniyeyi 16'lık nota adımına çevir
        const sixteenthNoteDuration = Tone.Time('16n').toSeconds();
        const currentStep = transportSeconds / sixteenthNoteDuration;
        
        // Adımı piksel pozisyonuna çevir
        const xPosition = currentStep * stepWidth;

        // Pozisyonu güncelle
        element.style.transform = `translateX(${xPosition}px)`;
        
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    } 
    // Çalma durduysa veya duraklatıldıysa döngüyü temizle
    else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Eğer tamamen durduysa, başa sar
      if (playbackState === 'stopped') {
        element.style.transform = 'translateX(0px)';
      }
    }

    // Temizlik fonksiyonu
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playbackState, stepWidth, elementRef]); // Sadece bu değerler değiştiğinde effect yeniden çalışır
};