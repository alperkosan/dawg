import React, { useRef, useEffect } from 'react';
import { PresetManager } from '../PresetManager';
import VolumeKnob from '../VolumeKnob';
import Fader from '../Fader';

// Delay'dekine benzer ritmik seçenekler
const timeOptions = [
    { value: '1n', label: '1/1' }, { value: '2n', 'label': '1/2' }, { value: '4n', label: '1/4' },
    { value: '8n', label: '1/8' }, { value: '16n', label: '1/16' }, { value: '4t', label: '1/4T' }, 
    { value: '8t', label: '1/8T' }, { value: '16t', label: '1/16T' }
];

// LFO dalgasını çizen yardımcı fonksiyon
const drawLfoWave = (ctx, width, height, rate, stretch) => {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(165, 180, 252, 0.8)'; // indigo-300
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(165, 180, 252, 0.5)';
    ctx.shadowBlur = 8;
    
    ctx.beginPath();
    const cycleWidth = width / 2; // Ekranda 2 tam döngü gösterelim
    for (let x = 0; x < width; x++) {
        // Kare dalga (stutter efekti için)
        const phase = (x % cycleWidth) / cycleWidth;
        const y = (phase < 0.5) ? height * 0.2 : height * 0.8;
        // Stretch parametresi dalganın dikey genliğini etkiler
        const stretchedY = y + (stretch - 0.5) * (height * 0.4);

        if (x === 0) ctx.moveTo(x, stretchedY);
        else ctx.lineTo(x, stretchedY);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
};

export const GhostLFOUI = ({ effect, onChange, definition }) => {
    const canvasRef = useRef(null);
    const { rate, stretch, atmosphere, glitch } = effect.settings;

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        drawLfoWave(ctx, rect.width, rect.height, rate, stretch);
    }, [rate, stretch]);

    return (
        <div className="relative w-full h-full p-4 bg-gray-900 rounded-lg flex flex-col items-center justify-between border-2 border-gray-950
                        bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 to-gray-900 font-mono">
            <PresetManager 
                pluginType={definition.type} 
                effect={effect}
                factoryPresets={definition.presets} 
                onChange={onChange}
            />
            <div className="w-full text-center pt-8">
                <h3 className="text-2xl font-bold text-indigo-300" style={{ textShadow: '2px 2px #4f46e5' }}>{definition.type}</h3>
                <p className="text-xs text-center text-gray-500 max-w-xs px-2 mt-1 mx-auto">{definition.story}</p>
            </div>

            <div className="flex w-full h-full items-center justify-center gap-6 pt-4">
                {/* Sol Taraf: Ana Kontroller */}
                <div className="flex flex-col items-center gap-4">
                    <label className="text-xs font-bold text-gray-400">HAYALET FREKANSI</label>
                    <select 
                        value={rate}
                        onChange={(e) => onChange('rate', e.target.value)}
                        className="bg-gray-950 border border-indigo-800 rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32 text-center"
                    >
                        {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <canvas ref={canvasRef} className="w-32 h-16 rounded border border-indigo-900/50" />
                </div>

                {/* Orta: Zaman Esnetme */}
                <div className="h-full w-20 flex flex-col items-center gap-2">
                     <label className="text-xs font-bold text-gray-400">ZAMAN ESNEMESİ</label>
                     <div className="h-full w-full bg-black/50 rounded-lg p-2 border border-indigo-900/50">
                        <Fader value={stretch} onChange={(val) => onChange('stretch', val)} minDb={0} maxDb={1}/>
                     </div>
                </div>

                {/* Sağ Taraf: Atmosfer ve Karakter */}
                <div className="flex flex-col h-full justify-around">
                     <VolumeKnob 
                        label="Atmosfer"
                        value={atmosphere}
                        onChange={(val) => onChange('atmosphere', val)}
                        min={0} max={1} defaultValue={0.3} size={72}
                    />
                     <VolumeKnob 
                        label="Bozulma"
                        value={glitch}
                        onChange={(val) => onChange('glitch', val)}
                        min={0} max={1} defaultValue={0.1} size={54}
                    />
                </div>
            </div>
        </div>
    );
};