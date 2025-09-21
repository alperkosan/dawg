import React from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { SignalVisualizer } from '../SignalVisualizer'; // Yeni bileşenimizi import ediyoruz

export const PitchShifterUI = ({ trackId, effect, onChange }) => {
  return (
    <div className="pitch-shifter-ui-v2 plugin-content-layout">
      <ProfessionalKnob
        label="Pitch" value={effect.settings.pitch} onChange={(val) => onChange('pitch', val)}
        min={-12} max={12} defaultValue={0} size={100} unit=" st" precision={0}
      />
      <div className="pitch-shifter-ui-v2__center-stack">
        
        {/* ESKİ CANVAS YERİNE ARTIK BU KADAR BASİT! */}
        <SignalVisualizer 
          meterId={`${trackId}-waveform`} 
          type="scope"
          color="#ec4899" /* Pembe */
        />
        
        <div className="pitch-shifter-ui-v2__side-controls">
            <ProfessionalKnob label="Quality" value={effect.settings.windowSize} onChange={(val) => onChange('windowSize', val)} min={0.01} max={0.4} defaultValue={0.1} size={64} unit="s" precision={3} />
            <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(val) => onChange('wet', val/100)} min={0} max={100} defaultValue={100} size={64} unit="%" precision={0} />
        </div>
      </div>
    </div>
  );
};