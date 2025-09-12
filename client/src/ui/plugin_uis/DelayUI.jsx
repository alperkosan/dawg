import React from 'react';
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager'; // Preset yöneticisini import et

const timeOptions = [
    { value: '1n', label: '1/1' }, { value: '2n', label: '1/2' }, { value: '4n', label: '1/4' },
    { value: '8n', label: '1/8' }, { value: '16n', label: '1/16' }, { value: '32n', label: '1/32' },
    { value: '2t', label: '1/2T' }, { value: '4t', label: '1/4T' }, { value: '8t', label: '1/8T' },
    { value: '4n.', label: '1/4D' }, { value: '8n.', label: '1/8D' },
];

export const DelayUI = ({ effect, onChange, definition }) => {
  return (
    <div className="relative w-full h-full p-4 bg-gray-800 rounded-lg flex flex-col items-center justify-between border border-gray-700
                    bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-blue-900/40 to-gray-800">
    <PresetManager 
      pluginType={definition.type} 
      effect={effect} // Efektin tüm verisini gönderiyoruz
      factoryPresets={definition.presets} 
      onChange={onChange}
    />
        <div>
            <h3 className="text-lg font-bold text-blue-300">{definition.type}</h3>
            <p className="text-xs text-center text-gray-400 max-w-xs px-2 mt-1">{definition.story}</p>
        </div>
        <div className="flex items-end justify-around w-full mt-4 gap-6">
            <div className="flex flex-col items-center gap-2">
                <label className="text-xs font-bold text-gray-400">Time</label>
                <select 
                    value={effect.settings.delayTime}
                    onChange={(e) => onChange('delayTime', e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

