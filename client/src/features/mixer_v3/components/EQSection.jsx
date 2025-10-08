import React, { useMemo } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { Knob } from '@/components/controls/base/Knob';

const EQSection = React.memo(({ trackId }) => {
  // Simple store subscription to avoid infinite loop
  const track = useMixerStore(state =>
    state.mixerTracks.find(t => t.id === trackId)
  );

  // Get stable reference to store action
  const storeActions = useMemo(() => {
    const state = useMixerStore.getState();
    return {
      handleMixerParamChange: state.handleMixerParamChange
    };
  }, []);

  if (!track) return null;

  const eq = track.eq || {
    highGain: 0,
    highFreq: 12000,
    midGain: 0,
    midFreq: 2500,
    midQ: 1,
    lowGain: 0,
    lowFreq: 80
  };

  return (
    <div className="eq-section">
      <div className="eq-section__header">
        <span className="eq-section__title">EQ</span>
        <button
          className="eq-section__bypass"
          onClick={() => storeActions.handleMixerParamChange(trackId, 'eqBypassed', !track.eqBypassed)}
          title="Bypass EQ"
        >
          {track.eqBypassed ? 'OFF' : 'ON'}
        </button>
      </div>

      <div className="eq-section__controls">
        {/* High Band */}
        <div className="eq-band eq-band--high">
          <div className="eq-band__header">HIGH</div>
          <Knob
            value={eq.highGain}
            min={-15}
            max={15}
            defaultValue={0}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.highGain', value)}
            size={28}
            unit="dB"
            precision={1}
            variant="mixer"
            showValue={false}
          />
          <Knob
            value={eq.highFreq}
            min={5000}
            max={20000}
            defaultValue={12000}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.highFreq', value)}
            size={28}
            unit="Hz"
            precision={0}
            variant="mixer"
            showValue={false}
          />
        </div>

        {/* Mid Band */}
        <div className="eq-band eq-band--mid">
          <div className="eq-band__header">MID</div>
          <Knob
            value={eq.midGain}
            min={-15}
            max={15}
            defaultValue={0}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.midGain', value)}
            size={28}
            unit="dB"
            precision={1}
            variant="mixer"
            showValue={false}
          />
          <Knob
            value={eq.midFreq}
            min={200}
            max={8000}
            defaultValue={2500}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.midFreq', value)}
            size={28}
            unit="Hz"
            precision={0}
            variant="mixer"
            showValue={false}
          />
          <Knob
            value={eq.midQ}
            min={0.1}
            max={10}
            defaultValue={1}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.midQ', value)}
            size={28}
            unit=""
            precision={1}
            variant="mixer"
            showValue={false}
          />
        </div>

        {/* Low Band */}
        <div className="eq-band eq-band--low">
          <div className="eq-band__header">LOW</div>
          <Knob
            value={eq.lowGain}
            min={-15}
            max={15}
            defaultValue={0}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.lowGain', value)}
            size={28}
            unit="dB"
            precision={1}
            variant="mixer"
            showValue={false}
          />
          <Knob
            value={eq.lowFreq}
            min={20}
            max={500}
            defaultValue={80}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.lowFreq', value)}
            size={28}
            unit="Hz"
            precision={0}
            variant="mixer"
            showValue={false}
          />
        </div>
      </div>
    </div>
  );
});

// Define display name for React.memo
EQSection.displayName = 'EQSection';

export default EQSection;