import { useLayoutEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

export const useWavesurfer = (containerRef, buffer) => {
  const wavesurferRef = useRef(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Temadan renkleri alıyoruz
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim();
    
    // Sadece bir kere wavesurfer instance'ı oluştur
    if (!wavesurferRef.current) {
      console.log("%c[WaveSurfer] Instance oluşturuluyor...", "color: orange");
      wavesurferRef.current = WaveSurfer.create({
        container: containerRef.current,
        waveColor: mutedColor,
        progressColor: primaryColor,
        cursorColor: 'white',
        cursorWidth: 2,
        barWidth: 3,
        barRadius: 3,
        barGap: 2,
        height: 'auto', // Yüksekliği konteynere bırak
        normalize: true,
      });
    }

    const ws = wavesurferRef.current;

    const loadAndRender = async () => {
      if (buffer && ws) {
        const audioBuffer = buffer.get ? buffer.get() : buffer;
        if (audioBuffer instanceof AudioBuffer) {
          console.log("%c[WaveSurfer] Geçerli buffer bulundu, yükleniyor...", "color: cyan");
          try {
            await ws.load(audioBuffer);
            console.log("%c[WaveSurfer] Yükleme ve çizim tamamlandı!", "color: lightgreen");
          } catch (error) {
            if (error.name !== 'AbortError') {
              console.error('[WaveSurfer] Yükleme hatası:', error);
            }
          }
        }
      }
    };
    
    loadAndRender();

  }, [containerRef, buffer]); // Sadece buffer değiştiğinde yeniden yükleme yap

  return wavesurferRef.current;
};