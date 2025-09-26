// src/hooks/useWaveformLoader.js
import { useState, useEffect } from 'react';

export const useWaveformLoader = (url) => {
    const [buffer, setBuffer] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!url) {
            setBuffer(null);
            return;
        }

        let isCancelled = false;
        const loadBuffer = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const audioBuffer = new Tone.ToneAudioBuffer(url, (loadedBuffer) => {
                    if (!isCancelled) {
                        setBuffer(loadedBuffer);
                        setIsLoading(false);
                    }
                }, (err) => {
                     if (!isCancelled) {
                        console.error("Waveform yükleme hatası:", err);
                        setError("Bu ses dosyasının dalga formu yüklenemedi.");
                        setIsLoading(false);
                    }
                });
            } catch (err) {
                 if (!isCancelled) {
                    setError("Buffer oluşturulurken bir hata oluştu.");
                    setIsLoading(false);
                }
            }
        };

        loadBuffer();

        // Component unmount olduğunda veya URL değiştiğinde
        // devam eden yüklemeyi iptal et
        return () => {
            isCancelled = true;
        };
    }, [url]); // Sadece URL değiştiğinde tekrar çalışır

    return { buffer, isLoading, error };
};