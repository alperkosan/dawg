import React, { useRef, useEffect } from 'react';
import { ProfessionalKnob, ProfessionalFader } from '../plugin_system/PluginControls';
import { PluginTypography } from '../plugin_system/PluginDesignSystem';

const timeOptions = [
    { value: '1n', label: '1/1' }, { value: '2n', 'label': '1/2' }, { value: '4n', label: '1/4' },
    { value: '8n', label: '1/8' }, { value: '16n', label: '1/16' }, { value: '4t', label: '1/4T' }, 
    { value: '8t', label: '1/8T' }, { value: '16t', label: '1/16T' }
];

const drawLfoWave = (ctx, width, height, rate, stretch) => {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(165, 180, 252, 0.8)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(165, 180, 252, 0.5)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    const cycleWidth = width / 2;
    for (let x = 0; x < width; x++) {
        const phase = (x % cycleWidth) / cycleWidth;
        const y = (phase < 0.5) ? height * 0.2 : height * 0.8;
        const stretchedY = y + (stretch - 0.5) * (height * 0.4);
        if (x === 0) ctx.moveTo(x, stretchedY); else ctx.lineTo(x, stretchedY);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
};

export const GhostLFOUI = ({ trackId, effect, onChange, definition }) => {
    const canvasRef = useRef(null);
    const { rate, stretch, atmosphere, glitch } = effect.settings;

    useEffect(() => {
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        drawLfoWave(ctx, rect.width, rect.height, rate, stretch);
    }, [rate, stretch]);

    return (
        <div className="flex w-full h-full items-center justify-center gap-8 pt-4">
            <div className="flex flex-col items-center gap-3">
                <label style={PluginTypography.label} className="text-white/90">Rate</label>
                <select 
                    value={rate}
                    onChange={(e) => onChange('rate', e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 text-center"
                >
                    {timeOptions.map(opt => <option key={opt.value} value={opt.value} className="bg-gray-800">{opt.label}</option>)}
                </select>
                <canvas ref={canvasRef} className="w-32 h-16 rounded border border-white/10" />
            </div>
            <ProfessionalFader
                label="Stretch"
                value={stretch}
                onChange={(val) => onChange('stretch', val)}
                min={0} max={1}
            />
            <div className="flex flex-col h-full justify-around gap-4">
                    <ProfessionalKnob 
                    label="Atmosfer"
                    value={atmosphere}
                    onChange={(val) => onChange('atmosphere', val)}
                    min={0} max={1} defaultValue={0.3} size={80}
                    displayMultiplier={100} unit="%" precision={0}
                />
                    <ProfessionalKnob 
                    label="Bozulma"
                    value={glitch}
                    onChange={(val) => onChange('glitch', val)}
                    min={0} max={1} defaultValue={0.1} size={60}
                    displayMultiplier={100} unit="%" precision={0}
                />
            </div>
        </div>
    );
};