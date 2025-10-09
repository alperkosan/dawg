import React from 'react';
import { ProfessionalKnob } from '../container/PluginControls';
import { SignalVisualizer } from '../../common/SignalVisualizer';
import { useGhostValue } from '@/hooks/useAudioPlugin';

export const PitchShifterUI = ({ trackId, effect, onChange }) => {
  const { pitch, windowSize, wet } = effect.settings;

  // Ghost values for parameter feedback
  const ghostPitch = useGhostValue(pitch, 400);
  const ghostWindowSize = useGhostValue(windowSize, 400);
  const ghostWet = useGhostValue(wet, 400);

  // Pitch değerine göre renk gradyanı oluştur
  const pitchColor = `hsl(${200 - pitch * 10}, 100%, 60%)`;

  return (
    <div className="pitch-shifter-ui-v2 plugin-content-layout">
      <ProfessionalKnob
        label="Pitch"
        value={pitch}
        onChange={(val) => onChange('pitch', Math.round(val))}
        min={-12} max={12} defaultValue={0}
        size={100} unit="st" precision={0}
      />
      <div className="pitch-shifter-ui-v2__center-stack">
        <SignalVisualizer
          meterId={`${trackId}-waveform`}
          type="scope"
          color={pitchColor}
        />
        <div className="pitch-shifter-ui-v2__side-controls">
          <ProfessionalKnob
            label="Quality"
            value={windowSize}
            onChange={(val) => onChange('windowSize', val)}
            min={0.01} max={0.4} defaultValue={0.1}
            size={64} unit="s" precision={3}
          />
          <ProfessionalKnob
            label="Mix"
            value={wet * 100}
            onChange={(val) => onChange('wet', val/100)}
            min={0} max={100} defaultValue={100}
            size={64} unit="%" precision={0}
          />
        </div>
      </div>
    </div>
  );
};
