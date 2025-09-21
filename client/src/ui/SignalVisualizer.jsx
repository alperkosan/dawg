import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../lib/core/MeteringService';

// Değerleri yumuşatmak için kullanılan yardımcı fonksiyon
const lerp = (start, end, amount) => start * (1 - amount) + end * amount;

// === ÇİZİM FONKSİYONLARI ===

const drawScope = (ctx, data, color) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    const centerY = height / 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((val, i) => {
        const x = (i / data.length) * width;
        const y = centerY + val * centerY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
};

const drawSpectrum = (ctx, data, color) => {
    const { width, height } = ctx.canvas.getBoundingClientRect();
    ctx.fillStyle = color;
    const barWidth = width / data.length;
    data.forEach((val, i) => {
        const db = Math.max(-100, val);
        const percent = (db + 100) / 100;
        const barHeight = height * percent;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
    });
};

// === ANA BİLEŞEN ===

export const SignalVisualizer = ({ meterId, type = 'scope', color = '#00E5B5' }) => {
    const canvasRef = useRef(null);
    const animationFrameId = useRef(null);
    
    // === YENİ: VERİ VE YUMUŞATMA İÇİN REF'LER ===
    // Hedef veri (MeteringService'ten gelen ham veri)
    const targetDataRef = useRef(null);
    // Ekrana çizilen yumuşatılmış veri
    const smoothedDataRef = useRef(null);

    useEffect(() => {
        if (!meterId) return;
        const handleData = (newData) => {
            targetDataRef.current = newData;
        };
        MeteringService.subscribe(meterId, handleData);
        return () => MeteringService.unsubscribe(meterId, handleData);
    }, [meterId]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0) {
                animationFrameId.current = requestAnimationFrame(draw);
                return;
            }
            if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
              canvas.width = rect.width * dpr;
              canvas.height = rect.height * dpr;
              ctx.scale(dpr, dpr);
            }

            ctx.clearRect(0, 0, rect.width, rect.height);
            
            const targetData = targetDataRef.current;
            
            // === YUMUŞATMA MANTIĞI ===
            if (targetData && targetData.length > 0) {
                // Eğer yumuşatılmış veri henüz yoksa, hedefi doğrudan kopyala
                if (!smoothedDataRef.current || smoothedDataRef.current.length !== targetData.length) {
                    smoothedDataRef.current = targetData;
                } else {
                    // Her bir veri noktasını hedefe doğru yumuşakça yaklaştır
                    for (let i = 0; i < targetData.length; i++) {
                        smoothedDataRef.current[i] = lerp(smoothedDataRef.current[i], targetData[i], 0.1); // 0.1: yumuşatma miktarı
                    }
                }

                // Ekrana YUMUŞATILMIŞ veriyi çiz
                if (type === 'scope') {
                    drawScope(ctx, smoothedDataRef.current, color);
                } else if (type === 'spectrum') {
                    drawSpectrum(ctx, smoothedDataRef.current, color);
                }
            }
            animationFrameId.current = requestAnimationFrame(draw);
        };
        
        draw();
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [type, color]);

    return (
        <div className="signal-visualizer-container">
            <canvas ref={canvasRef} />
        </div>
    );
};