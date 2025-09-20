// src/features/piano_roll_v2/hooks/useSmartSnap.js
import { useMemo, useCallback } from 'react';
import { usePianoRollStoreV2 } from '../store/usePianoRollStoreV2';
import * as Tone from 'tone';

const notationToSeconds = (notation) => Tone.Time(notation).toSeconds();

/**
 * Snap modu (hard/soft), zoom seviyesi ve kullanıcı seçimini hesaba katarak
 * o an geçerli olan en mantıklı snap davranışını yöneten akıllı hook.
 */
export const useSmartSnap = (engine) => {
  // === GÜNCELLEME: Artık 'snapMode'u da store'dan okuyoruz ===
  const { gridSnapValue, zoomX, snapMode } = usePianoRollStoreV2();

  const effectiveSnapValue = useMemo(() => {
    const userChoiceInSeconds = notationToSeconds(gridSnapValue);
    const stepWidth = 40 * zoomX;

    let finestVisibleSnap = '4n';
    if (stepWidth > 8) finestVisibleSnap = '8n';
    if (stepWidth > 12) finestVisibleSnap = '16n';
    if (stepWidth > 30) finestVisibleSnap = '32n';
    
    const finestVisibleInSeconds = notationToSeconds(finestVisibleSnap);

    return userChoiceInSeconds > finestVisibleInSeconds ? gridSnapValue : finestVisibleSnap;
  }, [gridSnapValue, zoomX]);

  // === GÜNCELLEME: snapTime fonksiyonu artık iki modu da destekliyor ===
  const snapTime = useCallback((time) => {
    const snapSteps = notationToSeconds(effectiveSnapValue) / notationToSeconds('16n');
    if (snapSteps <= 0) return time; // Sıfıra bölünme hatasını engelle

    const snappedTime = Math.round(time / snapSteps) * snapSteps;

    // Eğer mod 'soft' ise, manyetik davranışı uygula
    if (snapMode === 'soft') {
      const distance = Math.abs(time - snappedTime);
      const threshold = snapSteps * 0.25; // %25'lik bir çekim alanı
      
      // Sadece eşik değerinin içindeyse yapış, değilse serbest bırak
      return distance <= threshold ? snappedTime : time;
    }

    // Değilse ('hard' moddaysa), her zaman yapış
    return snappedTime;
    
  }, [effectiveSnapValue, snapMode]);

  return { snapTime, effectiveSnapValue, snapMode };
};