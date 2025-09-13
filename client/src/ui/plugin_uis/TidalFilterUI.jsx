import React from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const TidalFilterUI = ({ trackId, effect, onChange, definition }) => {

  const handleMixChange = (uiValue) => {
    onChange('wet', uiValue / 100);
  };

  return (
    <div className="flex items-center justify-center h-full gap-8">
      <ProfessionalKnob
        label="Cutoff"
        value={effect.settings.baseFrequency}
        onChange={(val) => onChange('baseFrequency', val)}
        min={20} max={10000} defaultValue={400}
        size={80} unit=" Hz" precision={0} logarithmic
      />
      <ProfessionalKnob
        label="Depth"
        value={effect.settings.octaves}
        onChange={(val) => onChange('octaves', val)}
        min={0} max={8} defaultValue={2}
        size={60} unit=" oct" precision={1}
      />
      <ProfessionalKnob
        label="Rate"
        value={effect.settings.frequency}
        onChange={(val) => onChange('frequency', val)}
        min={0.1} max={20} defaultValue={2}
        size={60} unit=" Hz" precision={2}
      />
        <ProfessionalKnob
        label="Mix"
        value={effect.settings.wet * 100}
        onChange={handleMixChange}
        min={0} max={100} defaultValue={100}
        unit="%" precision={0} size={72}
      />
    </div>
  );
};