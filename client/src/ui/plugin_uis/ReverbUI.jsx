import React from 'react';
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager'; // Preset yöneticisini import et

export const ReverbUI = ({ effect, onChange, definition }) => {
  return (
    <div className="relative w-full h-full p-4 bg-gray-800 rounded-lg flex flex-col items-center gap-4 border border-gray-700">
    <PresetManager 
      pluginType={definition.type} 
      effect={effect} // Efektin tüm verisini gönderiyoruz
      factoryPresets={definition.presets} 
      onChange={onChange}
    />
        <h3 className="text-lg font-bold text-cyan-400">{definition.type}</h3>
        <p className="text-xs text-center text-gray-400 max-w-xs px-2">{definition.story}</p>
        <div className="flex items-center justify-around w-full mt-4 gap-6">
            <VolumeKnob 
                label="Decay"
                value={effect.settings.decay}
                onChange={(val) => onChange('decay', val)}
                min={0.1} max={15} defaultValue={2.5} size={60}
            />
             <VolumeKnob 
                label="Pre-Delay"
                value={effect.settings.preDelay}
                onChange={(val) => onChange('preDelay', val)}
                min={0} max={0.2} defaultValue={0.01} size={42}
            />
            <VolumeKnob 
                label="Mix"
                value={effect.settings.wet}
                onChange={(val) => onChange('wet', val)}
                min={0} max={1} defaultValue={0.4} size={60}
            />
        </div>
    </div>
  );
};
