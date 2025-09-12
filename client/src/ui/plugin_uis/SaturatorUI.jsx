import React from 'react';
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager'; // Preset yöneticisini import et

export const SaturatorUI = ({ effect, onChange, definition }) => {
  return (
    <div className="relative w-full h-full p-4 bg-gray-800 rounded-lg flex flex-col items-center justify-between border border-gray-700
                    bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-orange-900/40 to-gray-800">
    <PresetManager 
      pluginType={definition.type} 
      effect={effect} // Efektin tüm verisini gönderiyoruz
      factoryPresets={definition.presets} 
      onChange={onChange}
    />
        <div>
            <h3 className="text-lg font-bold text-orange-300">{definition.type}</h3>
            <p className="text-xs text-center text-gray-400 max-w-xs px-2 mt-1">{definition.story}</p>
        </div>
        <div className="flex items-end justify-around w-full mt-4 gap-8">
            <VolumeKnob 
                label="Drive"
                value={effect.settings.distortion}
                onChange={(val) => onChange('distortion', val)}
                min={0} max={40} defaultValue={10} size={72}
            />
            <VolumeKnob 
                label="Mix"
                value={effect.settings.wet}
                onChange={(val) => onChange('wet', val)}
                min={0} max={1} defaultValue={1.0} size={54}
            />
        </div>
    </div>
  );
};

