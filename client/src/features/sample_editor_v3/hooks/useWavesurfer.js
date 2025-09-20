import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

export const useWavesurfer = (containerRef, buffer) => {
  const wavesurferRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Temadan renkleri alıyoruz
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim();
    
    // Sadece bir kere wavesurfer instance'ı oluştur
    if (!wavesurferRef.current) {
        wavesurferRef.current = WaveSurfer.create({
            container: containerRef.current,
            waveColor: mutedColor,
            progressColor: primaryColor,
            cursorColor: 'white',
            cursorWidth: 2,
            barWidth: 3,
            barRadius: 3,
            barGap: 2,
            height: 'auto',
            normalize: true,
            dragToSeek: true,
            autoplay: false,
        });
    }

    const ws = wavesurferRef.current;

    // Buffer mevcut ve geçerli ise yükle
    if (buffer && ws) {
        const audioBuffer = buffer.get ? buffer.get() : buffer;
        if (audioBuffer instanceof AudioBuffer) {
            ws.load(audioBuffer).catch(error => {
                if (error.name === 'AbortError') {
                    console.log('Waveform yüklemesi bilinçli olarak iptal edildi.');
                } else {
                    console.error('Waveform yükleme hatası:', error);
                }
            });
        }
    }

    // Component unmount olduğunda instance'ı yok et
    return () => {
      // Not: Bu cleanup, sadece ana component (SampleEditor) kapandığında
      // çalışacak şekilde ayarlanmalı. Şimdilik bu şekilde bırakıyoruz.
      // Eğer sample'lar arası geçişte sorun olursa, bu destroy'u daha
      // üst seviyede yönetmek gerekebilir.
    };
  }, [containerRef, buffer]); // Sadece buffer değiştiğinde yeniden yükleme yap

  return wavesurferRef.current;
};