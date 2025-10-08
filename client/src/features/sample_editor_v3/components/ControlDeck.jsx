import React, { useState } from 'react';
import { SlidersHorizontal, Sparkles, Settings, Play, Square } from 'lucide-react';
import TabButton from '@/components/common/TabButton';
import { Knob } from '@/components/controls';
import EffectSwitch from '@/components/controls/base/EffectSwitch';
import { EffectsRack } from './EffectsRack'; // Yeni raf sistemimizi import ediyoruz
import EffectsPanel from './EffectsPanel'; // Yeni efekt panelimiz
import { AudioContextService } from '@/lib/services/AudioContextService';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { EffectFactory } from '@/lib/audio/effects';
import { v4 as uuidv4 } from 'uuid';

export const ControlDeck = ({ instrument, track, onParamChange }) => {
  const [activeTab, setActiveTab] = useState('main');
  const [isPlaying, setIsPlaying] = useState(false);
  const updateInstrument = useInstrumentsStore(state => state.updateInstrument);

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

  // ✅ NEW: Effect chain handlers
  const handleEffectAdd = (effectType) => {
    console.log('Adding effect:', effectType, 'to instrument:', instrument.id);

    const currentChain = instrument.effectChain || [];
    const newEffect = {
      id: uuidv4(),
      type: effectType,
      name: effectType.charAt(0).toUpperCase() + effectType.slice(1),
      parameters: getDefaultEffectParameters(effectType),
      enabled: true
    };

    const updatedChain = [...currentChain, newEffect];

    // Update store
    updateInstrument(instrument.id, { effectChain: updatedChain });

    // Update audio engine
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const audioInstrument = audioEngine.instruments.get(instrument.id);
      if (audioInstrument && typeof audioInstrument.setEffectChain === 'function') {
        audioInstrument.setEffectChain(updatedChain);
        console.log('✅ Effect chain updated in audio engine');

        // CRITICAL: Reconnect instrument output to track after effect chain change
        if (instrument.mixerTrackId) {
          audioEngine.reconnectInstrumentToTrack(instrument.id, instrument.mixerTrackId);
          console.log('✅ Instrument reconnected to track after effect chain update');
        }
      }
    }
  };

  const handleEffectRemove = (effectId) => {
    console.log('Removing effect:', effectId);

    const currentChain = instrument.effectChain || [];
    const updatedChain = currentChain.filter(e => e.id !== effectId);

    // Update store
    updateInstrument(instrument.id, { effectChain: updatedChain });

    // Update audio engine
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const audioInstrument = audioEngine.instruments.get(instrument.id);
      if (audioInstrument && typeof audioInstrument.setEffectChain === 'function') {
        audioInstrument.setEffectChain(updatedChain);

        // CRITICAL: Reconnect instrument output to track after effect chain change
        if (instrument.mixerTrackId) {
          audioEngine.reconnectInstrumentToTrack(instrument.id, instrument.mixerTrackId);
        }
      }
    }
  };

  const handleEffectUpdate = (effectId, paramName, value) => {
    console.log('Updating effect:', effectId, paramName, value);

    const currentChain = instrument.effectChain || [];
    const updatedChain = currentChain.map(effect => {
      if (effect.id === effectId) {
        return {
          ...effect,
          parameters: {
            ...effect.parameters,
            [paramName]: { ...effect.parameters[paramName], value }
          }
        };
      }
      return effect;
    });

    // Update store
    updateInstrument(instrument.id, { effectChain: updatedChain });

    // Update audio engine
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const audioInstrument = audioEngine.instruments.get(instrument.id);
      if (audioInstrument && typeof audioInstrument.setEffectChain === 'function') {
        audioInstrument.setEffectChain(updatedChain);

        // CRITICAL: Reconnect instrument output to track after effect chain change
        if (instrument.mixerTrackId) {
          audioEngine.reconnectInstrumentToTrack(instrument.id, instrument.mixerTrackId);
        }
      }
    }
  };

  const getDefaultEffectParameters = (effectType) => {
    // Get default parameters directly from EffectFactory definition
    const workletDef = EffectFactory.workletEffects[effectType];
    if (workletDef && workletDef.params) {
      const params = {};
      Object.keys(workletDef.params).forEach(key => {
        params[key] = {
          ...workletDef.params[key],
          value: workletDef.params[key].defaultValue
        };
      });
      return params;
    }

    return {};
  };

  return (
    <div className="control-deck">
      <div className="control-deck__tabs">
        <TabButton label="Ana Ayarlar" icon={Settings} isActive={activeTab === 'main'} onClick={() => setActiveTab('main')} />
        <TabButton label="Efektler" icon={Sparkles} isActive={activeTab === 'effects'} onClick={() => setActiveTab('effects')} />
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
        {activeTab === 'effects' && (
           <EffectsPanel
             instrument={instrument}
             onEffectAdd={handleEffectAdd}
             onEffectRemove={handleEffectRemove}
             onEffectUpdate={handleEffectUpdate}
           />
        )}
      </div>
    </div>
  );
};