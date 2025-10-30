import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Sparkles, Settings, Play, Square } from 'lucide-react';
import TabButton from '@/components/common/TabButton';
import { Knob } from '@/components/controls';
import EffectSwitch from '@/components/controls/base/EffectSwitch';
import { EffectsRack } from './EffectsRack'; // Yeni raf sistemimizi import ediyoruz
import EffectsPanel from './EffectsPanel'; // Yeni efekt panelimiz
import { AudioContextService } from '@/lib/services/AudioContextService';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { EffectFactory } from '@/lib/audio/effects';
import { v4 as uuidv4 } from 'uuid';

export const ControlDeck = ({ instrument, track, onParamChange }) => {
  const [activeTab, setActiveTab] = useState('main');
  const [isPlaying, setIsPlaying] = useState(false);
  const [mixerTracks, setMixerTracks] = useState([]);
  const updateInstrument = useInstrumentsStore(state => state.updateInstrument);
  const allMixerTracks = useMixerStore(state => state.mixerTracks);

  // Load available mixer tracks
  useEffect(() => {
    setMixerTracks(allMixerTracks);
  }, [allMixerTracks]);

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
    // Update UI state (store)
    onParamChange(param, value);

    // Update audio engine in real-time
    const engineParams = ['volume', 'pitchOffset', 'cutItself', 'attack', 'decay', 'sustain', 'release', 'filterType', 'filterCutoff', 'filterResonance'];

    if (engineParams.includes(param)) {
      const audioEngine = AudioContextService.getAudioEngine();
      if (audioEngine) {
        const audioInstrument = audioEngine.instruments.get(instrument.id);
        if (audioInstrument && typeof audioInstrument.updateParameters === 'function') {
          audioInstrument.updateParameters({ [param]: value });
          console.log(`🎛️ Updated ${param} = ${value} in audio engine`);
        }
      }
    }
  };

  // Handle mixer track change
  const handleMixerTrackChange = (newTrackId) => {
    console.log('🎛️ Changing mixer track from', instrument.mixerTrackId, 'to', newTrackId);

    // Update instrument in store
    updateInstrument(instrument.id, { mixerTrackId: newTrackId });

    // Reconnect in audio engine
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      // Disconnect from old track
      if (instrument.mixerTrackId) {
        audioEngine.disconnectInstrumentFromTrack(instrument.id, instrument.mixerTrackId);
      }

      // Connect to new track
      if (newTrackId) {
        audioEngine.reconnectInstrumentToTrack(instrument.id, newTrackId);
        console.log('✅ Instrument reconnected to new mixer track:', newTrackId);
      }
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
          <>
            <div className="main-settings-grid">
              {/* Mixer Track Selector */}
              <div className="main-settings-grid__group" style={{ gridColumn: '1 / -1' }}>
                <h4 className="main-settings-grid__group-title">Routing</h4>
                <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                    Mixer Channel
                  </label>
                  <select
                    value={instrument.mixerTrackId || ''}
                    onChange={(e) => handleMixerTrackChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select Channel...</option>
                    {mixerTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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

            {/* ADSR Envelope Section */}
            <div className="main-settings-grid" style={{ marginTop: '20px' }}>
            <div className="main-settings-grid__group">
              <h4 className="main-settings-grid__group-title">Envelope (ADSR)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <Knob
                  label="Attack"
                  value={instrument.attack ?? 5}
                  onChange={v => handleParamChangeWithEngine('attack', v)}
                  min={0}
                  max={1000}
                  defaultValue={5}
                  unit="ms"
                />
                <Knob
                  label="Decay"
                  value={instrument.decay ?? 100}
                  onChange={v => handleParamChangeWithEngine('decay', v)}
                  min={0}
                  max={2000}
                  defaultValue={100}
                  unit="ms"
                />
                <Knob
                  label="Sustain"
                  value={instrument.sustain ?? 100}
                  onChange={v => handleParamChangeWithEngine('sustain', v)}
                  min={0}
                  max={100}
                  defaultValue={100}
                  unit="%"
                />
                <Knob
                  label="Release"
                  value={instrument.release ?? 50}
                  onChange={v => handleParamChangeWithEngine('release', v)}
                  min={0}
                  max={2000}
                  defaultValue={50}
                  unit="ms"
                />
              </div>
            </div>
          </div>

          {/* Filter Section */}
          <div className="main-settings-grid" style={{ marginTop: '20px' }}>
            <div className="main-settings-grid__group">
              <h4 className="main-settings-grid__group-title">Filter</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', display: 'block' }}>
                    Type
                  </label>
                  <select
                    value={instrument.filterType || 'lowpass'}
                    onChange={(e) => handleParamChangeWithEngine('filterType', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="lowpass">Low Pass</option>
                    <option value="highpass">High Pass</option>
                    <option value="bandpass">Band Pass</option>
                    <option value="notch">Notch</option>
                  </select>
                </div>
                <Knob
                  label="Cutoff"
                  value={instrument.filterCutoff ?? 20000}
                  onChange={v => handleParamChangeWithEngine('filterCutoff', v)}
                  min={20}
                  max={20000}
                  defaultValue={20000}
                  logarithmic
                  unit="Hz"
                />
                <Knob
                  label="Resonance"
                  value={instrument.filterResonance ?? 1}
                  onChange={v => handleParamChangeWithEngine('filterResonance', v)}
                  min={0.1}
                  max={20}
                  defaultValue={1}
                  step={0.1}
                />
              </div>
            </div>
          </div>
          </>
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