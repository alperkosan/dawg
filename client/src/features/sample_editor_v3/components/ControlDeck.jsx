import React, { useState } from 'react';
import { SlidersHorizontal, Sparkles, Plus, X, ArrowDownUp, Settings } from 'lucide-react';
import TabButton from '../../../ui/TabButton';
import VolumeKnob from '../../../ui/VolumeKnob';
import { useMixerStore } from '../../../store/useMixerStore';
import { usePanelsStore } from '../../../store/usePanelsStore';
import EffectSwitch from '../../../ui/EffectSwitch';
// Not: EffectBrowser.jsx'in var olduğunu ve doğru yolda olduğunu varsayıyoruz.
import { EffectBrowser } from '../../sample_editor_v2/components/EffectBrowser'; 

const EffectSlot = ({ effect, track, onRemove, onBypass, onOpenUI }) => (
    <div onClick={() => onOpenUI(effect, track)} className="effect-slot">
        <div className="effect-slot__info">
            <EffectSwitch isActive={!effect.bypass} onClick={(e) => { e.stopPropagation(); onBypass(effect.id, !effect.bypass); }} />
            <span className={`effect-slot__name ${effect.bypass ? 'effect-slot__name--bypassed' : ''}`}>{effect.type}</span>
        </div>
        <div className="effect-slot__actions">
            <button onClick={(e) => { e.stopPropagation(); onRemove(effect.id); }} className="effect-slot__remove-btn"><X size={14} /></button>
            <ArrowDownUp size={12} className="effect-slot__drag-handle" />
        </div>
    </div>
);

export const ControlDeck = ({ instrument, track, onParamChange }) => {
  const [activeTab, setActiveTab] = useState('main');
  const [effectsView, setEffectsView] = useState('list'); // 'list' veya 'browser'

  const { handleMixerEffectAdd, handleMixerEffectRemove, handleMixerEffectChange } = useMixerStore.getState();
  const { togglePluginPanel } = usePanelsStore.getState();

  const handleSelectEffect = (effectType) => {
    const newEffect = handleMixerEffectAdd(track.id, effectType);
    if (newEffect) {
      togglePluginPanel(newEffect, track);
    }
    setEffectsView('list');
  };

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
           <div className="effects-panel">
                <div className="effects-panel__content">
                    <div className={`effects-panel__view ${effectsView === 'browser' ? 'effects-panel__view--exiting' : ''}`}>
                        <div className="effects-panel__list">
                        {track.insertEffects.map((effect) => (
                            <EffectSlot key={effect.id} effect={effect} track={track} onBypass={(id, val) => handleMixerEffectChange(track.id, id, 'bypass', val)} onRemove={(id) => handleMixerEffectRemove(track.id, id)} onOpenUI={togglePluginPanel} />
                        ))}
                        </div>
                        <div className="effects-panel__footer">
                        <button onClick={() => setEffectsView('browser')} className="effects-panel__add-btn"><Plus size={14} /> Efekt Ekle</button>
                        </div>
                    </div>
                    {effectsView === 'browser' && (
                        <div className="effects-panel__view effects-panel__view--entering">
                        <EffectBrowser onSelect={handleSelectEffect} onBack={() => setEffectsView('list')} />
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};