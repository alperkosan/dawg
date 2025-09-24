// src/features/piano_roll_v2/components/Playhead.jsx
import React, { useRef, useEffect } from 'react';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
// KALDIRILDI: Artık bu servise ihtiyacımız yok. Hatanın ana kaynağı buydu.
// import { PlaybackAnimatorService } from '../../../lib/core/PlaybackAnimatorService';

export const Playhead = React.memo(({ engine }) => {
  const playheadRef = useRef(null);

  // GÜNCELLENDİ: Sadece store'dan gelen verileri kullanacağız.
  const { playbackState, transportStep } = usePlaybackStore();

  // ✅ DEBUG: Log store values
  console.log('🎯 Playhead render - store values:', { playbackState, transportStep });

  // GÜNCELLENDİ: İki ayrı useEffect'i tek bir merkezi useEffect'te birleştiriyoruz.
  // Bu hook, tüm çalma durumlarını (playing, paused, stopped) yönetir.
  useEffect(() => {
    const playhead = playheadRef.current;
    if (!playhead) return;

    console.log('🎯 Playhead useEffect triggered:', { playbackState, transportStep, stepWidth: engine.stepWidth });

    // Durum 'stopped' ise, playhead'i anında başa al.
    if (playbackState === 'stopped') {
      console.log('🎯 Setting playhead to position 0 (stopped)');
      playhead.style.transform = 'translateX(0px)';
      return;
    }

    // Durum 'playing' veya 'paused' ise, anlık pozisyonu store'dan gelen
    // `transportStep` değerine göre hesapla.
    const newXPosition = transportStep * engine.stepWidth;
    console.log('🎯 Setting playhead position:', { transportStep, stepWidth: engine.stepWidth, newXPosition });
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