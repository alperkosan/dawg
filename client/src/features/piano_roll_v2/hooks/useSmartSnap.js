// src/features/piano_roll_v2/hooks/useSmartSnap.js
import { useMemo, useCallback } from 'react';
import { usePianoRollStoreV2 } from '../store/usePianoRollStoreV2';
import { NativeTimeUtils } from '../../../lib/utils/NativeTimeUtils';

const notationToSeconds = (notation) => {
  try {
    return NativeTimeUtils.parseTime(notation, 120); // Default 120 BPM
  } catch (error) {
    return 0.25; // Fallback: 16th note at 120 BPM
  }
};

/**
 * Snap modu (hard/soft), zoom seviyesi ve kullanıcı seçimini hesaba katarak
 * o an geçerli olan en mantıklı snap davranışını yöneten akıllı hook.
 */
export const useSmartSnap = (engine) => {
  // === GÜNCELLEME: Artık 'snapMode'u da store'dan okuyoruz ===
  // Optimize state selectors - separate selectors for better caching
  const gridSnapValue = usePianoRollStoreV2(state => state.gridSnapValue);
  const zoomX = usePianoRollStoreV2(state => state.zoomX);
  const snapMode = usePianoRollStoreV2(state => state.snapMode);

  const effectiveSnapValue = useMemo(() => {
    // Kullanıcının seçtiği snap değerini her zaman kullan
    // Zoom seviyesi ne olursa olsun, kullanıcı 1/32 seçtiyse 1/32 snap yap
    return gridSnapValue;
  }, [gridSnapValue]);

  // === IMPROVED: Smart magnetic snap for better mouse tracking ===
  const snapTime = useCallback((time, options = {}) => {
    const { isResizing = false, previousValue = null } = options;
    const snapSteps = notationToSeconds(effectiveSnapValue) / notationToSeconds('16n');


    if (snapSteps <= 0) return time;

    const snappedTime = Math.round(time / snapSteps) * snapSteps;
    const distance = Math.abs(time - snappedTime);

    if (snapMode === 'soft') {
      // IMPROVED: Adaptive threshold based on context
      let threshold = snapSteps * 0.4; // Increased from 0.25 - wider magnetic area

      // During resize, make snap more forgiving
      if (isResizing) {
        threshold = snapSteps * 0.6; // Even wider during resize

        // Hysteresis: Once snapped, harder to unsnap
        if (previousValue !== null && Math.abs(previousValue - snappedTime) < 0.001) {
          threshold = snapSteps * 0.3; // Sticky behavior
        }
      }

      const result = distance <= threshold ? snappedTime : time;
      return result;
    }

    // Hard mode: Always snap in hard mode, even during resize
    if (snapMode === 'hard') {
      return snappedTime;
    }


    return snappedTime;
  }, [effectiveSnapValue, snapMode]);

  return { snapTime, effectiveSnapValue, snapMode };
};