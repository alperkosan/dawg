import React, { useState } from 'react';
import { SlidersHorizontal, Sparkles, Settings } from 'lucide-react';
import TabButton from '../../../ui/TabButton';
import VolumeKnob from '../../../ui/VolumeKnob';
import EffectSwitch from '../../../ui/EffectSwitch';
import { EffectsRack } from './EffectsRack'; // Yeni raf sistemimizi import ediyoruz

export const ControlDeck = ({ instrument, track, onParamChange }) => {
  const [activeTab, setActiveTab] = useState('main');

  return (
    <div className="control-deck">
      <div className="control-deck__tabs">
        <TabButton label="Ana Ayarlar" icon={Settings} isActive={activeTab === 'main'} onClick={() => setActiveTab('main')} />
        <TabButton label="Real-Time Efektler" icon={Sparkles} isActive={activeTab === 'effects'} onClick={() => setActiveTab('effects')} />
      </div>
      <div className="control-deck__content">
        {activeTab === 'main' && (
          <div className="main-settings-grid">
            <div className="main-settings-grid__group">
              <h4 className="main-settings-grid__group-title">Seviye</h4>
              <VolumeKnob label="Gain" value={instrument.volume ?? 0} onChange={v => onParamChange('volume', v)} min={-48} max={12} defaultValue={0} unit="dB" />
            </div>
            <div className="main-settings-grid__group">
              <h4 className="main-settings-grid__group-title">Ton</h4>
              <VolumeKnob label="Pitch" value={instrument.pitchOffset ?? 0} onChange={v => onParamChange('pitchOffset', v)} min={-24} max={24} defaultValue={0} unit="st" />
            </div>
            <div className="main-settings-grid__group">
              <h4 className="main-settings-grid__group-title">Playback</h4>
               <EffectSwitch label="Cut Itself" isActive={!!instrument.cutItself} onClick={() => onParamChange('cutItself', !instrument.cutItself)} />
            </div>
          </div>
        )}
        {activeTab === 'effects' && track && (
           <EffectsRack track={track} />
        )}
      </div>
    </div>
  );
};