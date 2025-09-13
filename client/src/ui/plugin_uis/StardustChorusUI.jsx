import React from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const StardustChorusUI = ({ trackId, effect, onChange, definition }) => {

  const handleMixChange = (uiValue) => {
    onChange('wet', uiValue / 100);
  };
  
  const handleDepthChange = (uiValue) => {
    onChange('depth', uiValue / 100);
  };

  return (
    <div className="flex items-center justify-center h-full gap-8">
      <ProfessionalKnob
        label="Rate"
        value={effect.settings.frequency}
        onChange={(val) => onChange('frequency', val)}
        min={0.1} max={10} defaultValue={1.5}
        unit=" Hz" precision={2} size={72}
      />
      <ProfessionalKnob
        label="Depth"
        value={effect.settings.depth * 100}
        onChange={handleDepthChange}
        min={0} max={100} defaultValue={70}
        unit="%" precision={0} size={60}
      />
      <ProfessionalKnob
        label="Delay"
        value={effect.settings.delayTime}
        onChange={(val) => onChange('delayTime', val)}
        min={2} max={20} defaultValue={3.5}
        unit=" ms" precision={1} size={60}
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