import React from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const VortexPhaserUI = ({ trackId, effect, onChange, definition }) => {
  
  const handleMixChange = (uiValue) => {
    onChange('wet', uiValue / 100);
  };

  return (
    <div className="flex items-center justify-center h-full gap-8">
      <ProfessionalKnob
        label="Rate"
        value={effect.settings.frequency}
        onChange={(val) => onChange('frequency', val)}
        min={0.1} max={8} defaultValue={0.5}
        unit=" Hz" precision={2} size={72}
      />
      <ProfessionalKnob
        label="Depth"
        value={effect.settings.octaves}
        onChange={(val) => onChange('octaves', val)}
        min={1} max={8} defaultValue={3}
        unit=" oct" precision={1} size={60}
      />
      <ProfessionalKnob
        label="Base Freq"
        value={effect.settings.baseFrequency}
        onChange={(val) => onChange('baseFrequency', val)}
        min={100} max={2000} defaultValue={350}
        unit=" Hz" precision={0} size={60} logarithmic
      />
      <ProfessionalKnob
        label="Mix"
        value={effect.settings.wet * 100}
        onChange={handleMixChange}
        min={0} max={100} defaultValue={50}
        unit="%" precision={0} size={72}
      />
    </div>
  );
};