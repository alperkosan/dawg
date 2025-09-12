import React from 'react';
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager'; // Preset yöneticisini import et

export const TidalFilterUI = ({ effect, onChange, definition }) => {
  return (
    <div className="relative w-full h-full p-4 bg-gray-800 rounded-lg flex flex-col items-center justify-between border border-gray-700
                    bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/40 to-gray-800">
    <PresetManager 
      pluginType={definition.type} 
      effect={effect} // Efektin tüm verisini gönderiyoruz
      factoryPresets={definition.presets} 
      onChange={onChange}
    />
        <div>
            <h3 className="text-lg font-bold text-teal-300">{definition.type}</h3>
            <p className="text-xs text-center text-gray-400 max-w-xs px-2 mt-1">{definition.story}</p>
        </div>
        <div className="flex items-end justify-around w-full mt-4 gap-6">
            <VolumeKnob 
                label="Cutoff"
                value={effect.settings.baseFrequency}
                onChange={(val) => onChange('baseFrequency', val)}
                min={20} max={10000} defaultValue={400} size={72}
            />
            <VolumeKnob 
                label="Depth"
                value={effect.settings.octaves}
                onChange={(val) => onChange('octaves', val)}
                min={0} max={8} defaultValue={2} size={54}
            />
            <VolumeKnob 
                label="Rate"
                value={effect.settings.frequency}
                onChange={(val) => onChange('frequency', val)}
                min={0.1} max={20} defaultValue={2} size={54}
            />
        </div>
    </div>
  );
};
