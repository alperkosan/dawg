import React, { useState } from 'react';
import { SlidersHorizontal, Sparkles, Settings, Play, Square } from 'lucide-react';
import TabButton from '@/components/common/TabButton';
import { Knob } from '@/components/controls';
import EffectSwitch from '../../../ui/EffectSwitch';
import { EffectsRack } from './EffectsRack'; // Yeni raf sistemimizi import ediyoruz
import { AudioContextService } from '@/lib/services/AudioContextService';

export const ControlDeck = ({ instrument, track, onParamChange }) => {
  const [activeTab, setActiveTab] = useState('main');
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePreview = () => {
    if (isPlaying) {
      AudioContextService.stopSamplePreview(instrument.id);
      setIsPlaying(false);
    } else {
      AudioContextService.previewSample(instrument.id, track.id, 0.8);
      setIsPlaying(true);
      // Auto stop after 3 seconds
      setTimeout(() => {
        setIsPlaying(false);
      }, 3000);
    }
  };

  const handleParamChangeWithEngine = (param, value) => {
    // Update UI state
    onParamChange(param, value);

    // Update audio engine in real-time
    if (param === 'volume' || param === 'pitchOffset') {
      AudioContextService.updateInstrumentParams(instrument.id, { [param]: value });
    }
  };

  return (
    <div className="control-deck">
      <div className="control-deck__tabs">
        <TabButton label="Ana Ayarlar" icon={Settings} isActive={activeTab === 'main'} onClick={() => setActiveTab('main')} />
        <TabButton label="Real-Time Efektler" icon={Sparkles} isActive={activeTab === 'effects'} onClick={() => setActiveTab('effects')} />
      </div>

      {/* Preview Controls */}
      <div className="control-deck__preview">
        <button
          className={`control-deck__preview-btn ${isPlaying ? 'playing' : ''}`}
          onClick={handlePreview}
          title={isPlaying ? 'Stop Preview' : 'Preview Sample'}
        >
          {isPlaying ? <Square size={16} /> : <Play size={16} />}
          {isPlaying ? 'Stop' : 'Preview'}
        </button>
      </div>

      <div className="control-deck__content">
        {activeTab === 'main' && (
          <div className="main-settings-grid">
            <div className="main-settings-grid__group">
              <h4 className="main-settings-grid__group-title">Seviye</h4>
              <Knob
                label="Gain"
                value={instrument.volume ?? 0}
                onChange={v => handleParamChangeWithEngine('volume', v)}
                min={-48}
                max={12}
                defaultValue={0}
                unit="dB"
              />
            </div>
            <div className="main-settings-grid__group">
              <h4 className="main-settings-grid__group-title">Ton</h4>
              <Knob
                label="Pitch"
                value={instrument.pitchOffset ?? 0}
                onChange={v => handleParamChangeWithEngine('pitchOffset', v)}
                min={-24}
                max={24}
                defaultValue={0}
                unit="st"
              />
            </div>
            <div className="main-settings-grid__group">
              <h4 className="main-settings-grid__group-title">Playback</h4>
               <EffectSwitch
                 label="Cut Itself"
                 isActive={!!instrument.cutItself}
                 onClick={() => handleParamChangeWithEngine('cutItself', !instrument.cutItself)}
               />
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