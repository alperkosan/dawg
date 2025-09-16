// client/src/hooks/usePlaybackAnimator.js
import { useEffect } from 'react';
import * as Tone from 'tone';

/**
 * Playhead animasyon hook'u - Piano Roll için optimize edilmiş
 */
export const usePlaybackAnimator = (playheadRef, options = {}) => {
  const { 
    fullWidth, 
    offset = 0, 
    smoothing = true, 
    compensation = 'auto' 
  } = options;

  useEffect(() => {
    let animationId = null;
    
    const animate = () => {
      if (!playheadRef.current) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      // Tone.js'den mevcut transport pozisyonunu al
      const currentTime = Tone.Transport.seconds;
      const sixteenthNoteDuration = Tone.Time('16n').toSeconds();
      const stepPosition = currentTime / sixteenthNoteDuration;
      
      // Pixel pozisyonunu hesapla (40px per step * zoom)
      const stepWidth = 40; // Base step width
      const pixelPosition = stepPosition * stepWidth + offset;
      
      // Playhead'i güncelle
      if (fullWidth && pixelPosition > fullWidth) {
        // Loop başına dön
        playheadRef.current.style.left = `${offset}px`;
      } else {
        playheadRef.current.style.left = `${Math.max(offset, pixelPosition)}px`;
      }
      
      // Smooth animation için transform kullan
      if (smoothing) {
        playheadRef.current.style.transform = 'translateZ(0)';
      }
      
      animationId = requestAnimationFrame(animate);
    };

    // Sadece Tone.js transport aktifse animasyonu başlat
    if (Tone.Transport.state === 'started') {
      animationId = requestAnimationFrame(animate);
    }

    // Transport state değişikliklerini dinle
    const handleTransportChange = () => {
      if (Tone.Transport.state === 'started' && !animationId) {
        animationId = requestAnimationFrame(animate);
      } else if (Tone.Transport.state === 'stopped') {
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
        // Playhead'i başa al
        if (playheadRef.current) {
          playheadRef.current.style.left = `${offset}px`;
        }
      }
    };

    // Tone.js event listener'ları (eğer mevcutsa)
    Tone.Transport.on('start', handleTransportChange);
    Tone.Transport.on('stop', handleTransportChange);
    Tone.Transport.on('pause', () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    });

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      // Event listener'ları temizle
      Tone.Transport.off('start', handleTransportChange);
      Tone.Transport.off('stop', handleTransportChange);
      Tone.Transport.off('pause');
    };
  }, [playheadRef, fullWidth, offset, smoothing]);
};