// src/features/piano_roll_v2/components/Playhead.jsx
import React, { useRef, useEffect } from 'react';
import { usePlaybackStore } from '../../../store/usePlaybackStore';
import { PlaybackAnimatorService } from '../../../lib/core/PlaybackAnimatorService';

export const Playhead = React.memo(({ engine }) => {
  const playheadRef = useRef(null);
  // `playbackState`'e ek olarak, duraklatıldığındaki konumu bilmek için `transportStep`'i de alıyoruz.
  const { playbackState, transportStep, audioLoopLength } = usePlaybackStore();

  // Bu effect, 'playing' durumundaki akıcı animasyondan sorumlu.
  useEffect(() => {
    const updatePlayheadPosition = (progress) => {
      // Sadece ve sadece çalma durumundaysa animasyon servisinden gelen veriyi kullan
      if (playheadRef.current && playbackState === 'playing') {
        const position = progress * audioLoopLength * engine.stepWidth;
        playheadRef.current.style.transform = `translateX(${position}px)`;
      }
    };

    PlaybackAnimatorService.subscribe(updatePlayheadPosition);
    return () => PlaybackAnimatorService.unsubscribe(updatePlayheadPosition);
  }, [playbackState, engine.stepWidth, audioLoopLength]);

  // Bu effect, 'stopped' ve 'paused' gibi statik durumlardan sorumlu.
  useEffect(() => {
    if (!playheadRef.current) return;

    if (playbackState === 'stopped') {
      // Durdurulduğunda pozisyonu sıfırla
      playheadRef.current.style.transform = `translateX(0px)`;
    } else if (playbackState === 'paused') {
      // Duraklatıldığında, en son bilinen adıma göre pozisyonu ayarla
      const position = transportStep * engine.stepWidth;
      playheadRef.current.style.transform = `translateX(${position}px)`;
    }
  }, [playbackState, transportStep, engine.stepWidth]);

  // HATA DÜZELTMESİ: Bileşenin kaybolmasına neden olan `if` bloğu kaldırıldı.
  // Playhead artık her zaman render ediliyor ve pozisyonu `useEffect`'ler tarafından yönetiliyor.
  return (
    <div 
      ref={playheadRef} 
      className="prv2-playhead" 
      style={{ height: engine.gridHeight }} 
    />
  );
});