import React from 'react';
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager';

const timeOptions = [
    { value: '1n', label: '1/1' }, { value: '2n', label: '1/2' }, { value: '4n', label: '1/4' },
    { value: '8n', label: '1/8' }, { value: '16n', label: '1/16' }, { value: '32n', label: '1/32' },
    { value: '2t', label: '1/2T' }, { value: '4t', label: '1/4T' }, { value: '8t', label: '1/8T' },
    { value: '4n.', label: '1/4D' }, { value: '8n.', label: '1/8D' },
];

export const DelayUI = ({ effect, onChange, definition }) => {
  return (
    <div 
        className="relative w-full h-full p-4 bg-[var(--color-surface)] rounded-lg flex flex-col items-center justify-between"
        style={{
            border: '1px solid var(--color-border)',
            gap: 'var(--gap-container)'
        }}
    >
    <PresetManager 
      pluginType={definition.type} 
      effect={effect}
      factoryPresets={definition.presets} 
      onChange={onChange}
    />
        <div>
            <h3 className="font-bold text-[var(--color-primary)]" style={{ fontSize: 'var(--font-size-header)' }}>{definition.type}</h3>
            <p className="text-center text-[var(--color-muted)] max-w-xs px-2 mt-1" style={{ fontSize: 'var(--font-size-label)' }}>{definition.story}</p>
        </div>
        <div className="flex items-end justify-around w-full mt-4" style={{ gap: 'var(--gap-container)' }}>
            <div className="flex flex-col items-center" style={{ gap: 'var(--gap-controls)' }}>
                <label className="font-bold text-[var(--color-muted)]" style={{ fontSize: 'var(--font-size-label)' }}>Time</label>
                <select 
                    value={effect.settings.delayTime}
                    onChange={(e) => onChange('delayTime', e.target.value)}
                    className="bg-[var(--color-background)] rounded px-4 py-2 focus:outline-none focus:ring-2"
                    style={{
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-body)',
                        ringColor: 'var(--color-primary)'
                    }}
                >
                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <VolumeKnob 
                label="Feedback"
                value={effect.settings.feedback}
                onChange={(val) => onChange('feedback', val)}
                min={0} max={0.95} defaultValue={0.3} size={60}
            />
            <VolumeKnob 
                label="Mix"
                value={effect.settings.wet}
                onChange={(val) => onChange('wet', val)}
                min={0} max={1} defaultValue={0.35} size={60}
            />
        </div>
    </div>
  );
};