// src/features/piano_roll_v2/components/Playhead.jsx
import React, { useRef, useEffect } from 'react';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
// KALDIRILDI: Artık bu servise ihtiyacımız yok. Hatanın ana kaynağı buydu.
// import { PlaybackAnimatorService } from '../../../lib/core/PlaybackAnimatorService';

export const Playhead = React.memo(({ engine }) => {
  const playheadRef = useRef(null);
  
  // GÜNCELLENDİ: Sadece store'dan gelen verileri kullanacağız.
  const { playbackState, transportStep } = usePlaybackStore();

  // GÜNCELLENDİ: İki ayrı useEffect'i tek bir merkezi useEffect'te birleştiriyoruz.
  // Bu hook, tüm çalma durumlarını (playing, paused, stopped) yönetir.
  useEffect(() => {
    const playhead = playheadRef.current;
    if (!playhead) return;

    // Durum 'stopped' ise, playhead'i anında başa al.
    if (playbackState === 'stopped') {
      playhead.style.transform = 'translateX(0px)';
      return;
    }

    // Durum 'playing' veya 'paused' ise, anlık pozisyonu store'dan gelen
    // `transportStep` değerine göre hesapla.
    const newXPosition = transportStep * engine.stepWidth;
    playhead.style.transform = `translateX(${newXPosition}px)`;

  }, [playbackState, transportStep, engine.stepWidth]); // Bu değerler değiştiğinde effect yeniden çalışır.


  // HATA DÜZELTMESİ: Playhead artık her durumda render ediliyor.
  // Pozisyonu yukarıdaki useEffect tarafından yönetiliyor.
  return (
    <div 
      ref={playheadRef} 
      className="prv2-playhead" 
      style={{ 
        height: engine.gridHeight,
        // Yüksek performans için tarayıcıya ipucu veriyoruz.
        willChange: 'transform' 
      }} 
    />
  );
});