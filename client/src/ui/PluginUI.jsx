import React from 'react';
import VolumeKnob from './VolumeKnob';
import Fader from './Fader'; // Fader'ı da kullanalım

// Knob (Potansiyometre) ile kontrol edilen parametreler için
export const PluginParamKnob = ({ effect, param, onChange, trackId }) => (
  <VolumeKnob 
    label={param.label}
    value={effect.settings[param.id]}
    onChange={(val) => onChange(trackId, effect.id, param.id, val)}
    min={param.min}
    max={param.max}
    defaultValue={param.defaultValue}
  />
);

// Dropdown (Açılır menü) ile kontrol edilen parametreler için (örn: EQ Tipi)
export const PluginParamSelector = ({ effect, param, onChange, trackId }) => (
  <div className="flex flex-col items-center gap-2">
    <label className="text-xs text-gray-400">{param.label}</label>
    <select 
      value={effect.settings[param.id]} 
      onChange={(e) => onChange(trackId, effect.id, param.id, e.target.value)}
      className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
    >
      {param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

// Gelecekte eklenecek diğer UI bileşenleri (Slider, Switch vb.) buraya gelecek.