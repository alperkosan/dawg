// src/features/piano_roll/useGridSnapping.js

import { useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import { usePianoRollStore } from '../store/usePianoRollStore';

/**
 * Grid snapping hook - Piano Roll için nota hizalama sistemi
 * Hata düzeltmesi: Props undefined kontrolü eklendi
 */
export const useGridSnapping = (customSettings = {}) => {
  // Store'dan snap ayarlarını al
  const { gridSnapValue, snapMode } = usePianoRollStore();
  
  // Varsayılan ayarlarla birleştir
  const snapSettings = useMemo(() => ({
    enabled: true, // Varsayılan olarak aktif
    value: gridSnapValue || '16n', // Varsayılan snap değeri
    mode: snapMode || 'hard', // 'hard' veya 'soft'
    ...customSettings // Özel ayarları üzerine yaz
  }), [gridSnapValue, snapMode, customSettings]);

  // Snap step'lerini hesapla
  const snapSteps = useMemo(() => {
    if (!snapSettings.enabled) return 1;
    
    try {
      return Tone.Time(snapSettings.value).toSeconds() / Tone.Time('16n').toSeconds();
    } catch (error) {
      console.warn('Invalid snap value:', snapSettings.value, 'using default 16n');
      return 1; // 16n step size
    }
  }, [snapSettings.enabled, snapSettings.value]);

  // Time snapping fonksiyonu
  const snapTime = useCallback((time) => {
    if (!snapSettings.enabled || snapSteps <= 0) {
      return time;
    }
    
    if (snapSettings.mode === 'soft') {
      // Soft snapping - sadece yakınsa hizala
      const snapped = Math.round(time / snapSteps) * snapSteps;
      const distance = Math.abs(time - snapped);
      const threshold = snapSteps * 0.25; // %25 eşik
      
      return distance <= threshold ? snapped : time;
    } else {
      // Hard snapping - her zaman hizala
      return Math.round(time / snapSteps) * snapSteps;
    }
  }, [snapSettings.enabled, snapSettings.mode, snapSteps]);

  // Pitch snapping (isteğe bağlı - yarı ton hizalaması)
  const snapPitch = useCallback((pitchIndex) => {
    // Piano Roll'da pitch genellikle tam sayı olarak gelir
    return Math.round(pitchIndex);
  }, []);

  // Delta snapping - fare hareketlerini snap'le
  const snapDelta = useCallback((deltaTime) => {
    if (!snapSettings.enabled || snapSteps <= 0) {
      return deltaTime;
    }
    
    return Math.round(deltaTime / snapSteps) * snapSteps;
  }, [snapSettings.enabled, snapSteps]);

  // Koordinat snapping
  const snapCoordinates = useCallback(({ time, pitch }) => {
    return {
      time: snapTime(time),
      pitch: snapPitch(pitch)
    };
  }, [snapTime, snapPitch]);

  // Snap bilgilerini görselleştirme için
  const getSnapInfo = useCallback(() => ({
    enabled: snapSettings.enabled,
    value: snapSettings.value,
    mode: snapSettings.mode,
    stepSize: snapSteps,
    description: `${snapSettings.value} (${snapSettings.mode})`
  }), [snapSettings, snapSteps]);

  return {
    // Ana snap fonksiyonları
    snapTime,
    snapPitch,
    snapDelta,
    snapCoordinates,
    
    // Ayarlar
    snapSettings,
    snapSteps,
    
    // Utility
    getSnapInfo,
    
    // Backward compatibility
    enabled: snapSettings.enabled,
    value: snapSettings.value,
    mode: snapSettings.mode
  };
};