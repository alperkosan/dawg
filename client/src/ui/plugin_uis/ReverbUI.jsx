import React from 'react';
import { ProfessionalKnob } from '../../ui/plugin_system/PluginControls';

// *** ONARIM: Artık bu bileşen PluginContainer'ı render ETMİYOR. ***
// Sadece kendine özgü kontrolleri (knob'ları) render etmekten sorumlu.
export const ReverbUI = ({ effect, onChange, definition }) => {
  return (
    <div className="flex items-center justify-around w-full h-full">
        <ProfessionalKnob 
            label="Decay"
            value={effect.settings.decay}
            onChange={(val) => onChange('decay', val)}
            min={0.1} max={15} defaultValue={2.5}
            unit="s"
            precision={2}
        />
         <ProfessionalKnob 
            label="Pre-Delay"
            value={effect.settings.preDelay}
            onChange={(val) => onChange('preDelay', val)}
            min={0} max={0.2} defaultValue={0.01}
            unit="s"
            precision={3}
        />
        <ProfessionalKnob 
            label="Mix"
            value={effect.settings.wet * 100}
            onChange={(val) => onChange('wet', val / 100)}
            min={0} max={100} defaultValue={40}
            unit="%"
            precision={0}
        />
    </div>
  );
};