import React from 'react';
import { RotateCcw, Waves, ArrowLeftRight, Volume2, Settings } from 'lucide-react';
import VolumeKnob from '../../../ui/VolumeKnob'; // VolumeKnob'u tekrar import ettik

const InspectorAction = ({ label, icon: Icon, isActive, onClick }) => (
  <button onClick={onClick} className={`inspector-action ${isActive ? 'inspector-action--active' : ''}`}>
    <Icon size={16} />
    <span>{label}</span>
  </button>
);

export const InspectorPanel = ({ instrument, onParamChange, onPrecomputedChange }) => {
  const precomputed = instrument.precomputed || {};

  return (
    <div className="inspector-panel">
      <h2 className="panel-header"><Settings size={16}/> Inspector</h2>
      <div className="inspector-panel__content">
        <div className="inspector-panel__group">
          <h3 className="inspector-panel__group-title">Temel Ayarlar</h3>
          <div className="inspector-panel__knob-grid">
            {/* DÜZELTME: Kayıp knob'lar geri eklendi */}
            <VolumeKnob label="Gain" value={instrument.volume ?? 0} onChange={v => onParamChange('volume', v)} min={-48} max={12} defaultValue={0} unit="dB" />
            <VolumeKnob label="Pitch" value={instrument.pitchOffset ?? 0} onChange={v => onParamChange('pitchOffset', v)} min={-24} max={24} defaultValue={0} unit="st" />
          </div>
        </div>
        <div className="inspector-panel__group">
          <h3 className="inspector-panel__group-title">İşlemler</h3>
          <InspectorAction label="Reverse" icon={RotateCcw} isActive={!!precomputed.reverse} onClick={() => onPrecomputedChange('reverse', !precomputed.reverse)} />
          <InspectorAction label="Normalize" icon={Waves} isActive={!!precomputed.normalize} onClick={() => onPrecomputedChange('normalize', !precomputed.normalize)} />
          <InspectorAction label="Invert Polarity" icon={ArrowLeftRight} isActive={!!precomputed.reversePolarity} onClick={() => onPrecomputedChange('reversePolarity', !precomputed.reversePolarity)} />
        </div>
        <div className="inspector-panel__group">
          <h3 className="inspector-panel__group-title">Playback</h3>
          <InspectorAction label="Cut Itself" icon={Volume2} isActive={!!instrument.cutItself} onClick={() => onParamChange('cutItself', !instrument.cutItself)} />
        </div>
      </div>
    </div>
  );
};