import React from 'react';
// YENİ: Profesyonel sistem bileşenlerini import ediyoruz
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { PluginTypography } from '../plugin_system/PluginDesignSystem'; // Stil için

const timeOptions = [
    { value: '1n', label: '1/1' }, { value: '2n', label: '1/2' }, { value: '4n', label: '1/4' },
    { value: '8n', label: '1/8' }, { value: '16n', label: '1/16' }, { value: '32n', label: '1/32' },
    { value: '2t', label: '1/2T' }, { value: '4t', label: '1/4T' }, { value: '8t', label: '1/8T' },
    { value: '4n.', label: '1/4D' }, { value: '8n.', label: '1/8D' },
];

export const DelayUI = ({ trackId, effect, onChange, definition }) => {
  // Select menüsü için yeni profesyonel stil
  const selectStyle = {
    ...PluginTypography.value,
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    padding: '0.5rem 1rem',
    color: '#fff',
    WebkitAppearance: 'none',
    appearance: 'none',
    textAlign: 'center',
    cursor: 'pointer',
  };

  return (
    <div className="flex items-center justify-center h-full gap-8">
      <div className="flex flex-col items-center gap-2">
          <label style={PluginTypography.label} className="text-white/80">Time</label>
          <select
              value={effect.settings.delayTime}
              onChange={(e) => onChange('delayTime', e.target.value)}
              style={selectStyle}
          >
              {timeOptions.map(opt => <option key={opt.value} value={opt.value} style={{backgroundColor: '#1f2937'}}>{opt.label}</option>)}
          </select>
      </div>
      <ProfessionalKnob
          label="Feedback"
          value={effect.settings.feedback}
          onChange={(val) => onChange('feedback', val)}
          min={0} max={0.95} defaultValue={0.3} size={70}
          precision={2}
      />
      <ProfessionalKnob
          label="Mix"
          value={effect.settings.wet}
          onChange={(val) => onChange('wet', val)}
          min={0} max={1} defaultValue={0.35} size={70}
          unit="%" precision={0}
      />
    </div>
  );
};