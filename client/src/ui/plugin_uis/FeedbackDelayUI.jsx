import React from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { PluginTypography } from '../plugin_system/PluginDesignSystem';

const timeOptions = [
    { value: '1n', label: '1/1' }, { value: '2n', label: '1/2' }, { value: '4n', label: '1/4' },
    { value: '8n', label: '1/8' }, { value: '16n', label: '1/16' }, { value: '32n', label: '1/32' },
    { value: '2t', label: '1/2T' }, { value: '4t', label: '1/4T' }, { value: '8t', label: '1/8T' },
    { value: '4n.', label: '1/4D' }, { value: '8n.', label: '1/8D' },
];

export const FeedbackDelayUI = ({ trackId, effect, onChange, definition }) => {

  const handleMixChange = (uiValue) => {
    onChange('wet', uiValue / 100);
  };
  
  const handleFeedbackChange = (uiValue) => {
    onChange('feedback', uiValue / 100);
  };

  return (
    <div className="flex items-center justify-center h-full gap-10">
      <div className="flex flex-col items-center gap-2">
          <label style={PluginTypography.label} className="text-white/90">Time</label>
          <select
              value={effect.settings.delayTime}
              onChange={(e) => onChange('delayTime', e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
              {timeOptions.map(opt => <option key={opt.value} value={opt.value} className="bg-gray-800">{opt.label}</option>)}
          </select>
      </div>
      <ProfessionalKnob
        label="Feedback"
        value={effect.settings.feedback * 100}
        onChange={handleFeedbackChange}
        min={0} max={95} defaultValue={40}
        unit="%" precision={0} size={72}
      />
      <ProfessionalKnob
        label="Mix"
        value={effect.settings.wet * 100}
        onChange={handleMixChange}
        min={0} max={100} defaultValue={40}
        unit="%" precision={0} size={72}
      />
    </div>
  );
};