import React, { useState, useEffect } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { SignalVisualizer } from '../SignalVisualizer';
import { MeteringService } from '../../lib/core/MeteringService';

export const VortexPhaserUI = ({ trackId, effect, onChange }) => {
    const { frequency, octaves, wet } = effect.settings;
    const [inputLevel, setInputLevel] = useState(-60);

    useEffect(() => {
        const meterId = `${trackId}-input`;
        const handleLevel = (db) => setInputLevel(db);
        MeteringService.subscribe(meterId, handleLevel);
        return () => MeteringService.unsubscribe(meterId, handleLevel);
    }, [trackId]);
    
    // Sinyal gücüne göre renk ve parlaklığı ayarla
    const normalizedGain = (Math.max(-60, inputLevel) + 60) / 66;
    const color = `rgba(236, 72, 153, ${0.4 + normalizedGain * 0.6})`;

    return (
        <div className="phaser-ui-v2 plugin-content-layout">
            <ProfessionalKnob label="Depth" value={octaves} onChange={(v) => onChange('octaves', v)} min={1} max={8} defaultValue={3} unit="oct" precision={1} size={80} />
            <div className="phaser-ui-v2__visualizer">
                <SignalVisualizer meterId={`${trackId}-fft`} type="spectrum" color={color} />
            </div>
            <div className="phaser-ui-v2__side-controls">
                <ProfessionalKnob label="Rate" value={frequency} onChange={(v) => onChange('frequency', v)} min={0.1} max={8} defaultValue={0.5} unit="Hz" precision={2} size={70} />
                <ProfessionalKnob label="Mix" value={wet * 100} onChange={(v) => onChange('wet', v / 100)} min={0} max={100} defaultValue={50} unit="%" precision={0} size={70} />
            </div>
        </div>
    );
};
