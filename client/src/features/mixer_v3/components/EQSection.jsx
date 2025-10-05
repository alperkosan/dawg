import React, { useMemo } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import VolumeKnob from './VolumeKnob';

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
          <VolumeKnob
            value={eq.highGain}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.highGain', value)}
            min={-15}
            max={15}
            size="mini"
            bipolar={true}
            showValue={false}
          />
          <VolumeKnob
            value={eq.highFreq}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.highFreq', value)}
            min={5000}
            max={20000}
            size="mini"
            label="Hz"
            showValue={false}
          />
        </div>

        {/* Mid Band */}
        <div className="eq-band eq-band--mid">
          <div className="eq-band__header">MID</div>
          <VolumeKnob
            value={eq.midGain}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.midGain', value)}
            min={-15}
            max={15}
            size="mini"
            bipolar={true}
            showValue={false}
          />
          <VolumeKnob
            value={eq.midFreq}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.midFreq', value)}
            min={200}
            max={8000}
            size="mini"
            label="Hz"
            showValue={false}
          />
          <VolumeKnob
            value={eq.midQ}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.midQ', value)}
            min={0.1}
            max={10}
            size="mini"
            label="Q"
            showValue={false}
          />
        </div>

        {/* Low Band */}
        <div className="eq-band eq-band--low">
          <div className="eq-band__header">LOW</div>
          <VolumeKnob
            value={eq.lowGain}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.lowGain', value)}
            min={-15}
            max={15}
            size="mini"
            bipolar={true}
            showValue={false}
          />
          <VolumeKnob
            value={eq.lowFreq}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'eq.lowFreq', value)}
            min={20}
            max={500}
            size="mini"
            label="Hz"
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