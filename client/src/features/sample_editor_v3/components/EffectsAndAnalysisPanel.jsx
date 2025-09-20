import React, { useState } from 'react';
import { SlidersHorizontal, Bot, Plus, X, ArrowDownUp } from 'lucide-react';
import { useMixerStore } from '../../../store/useMixerStore';
import { usePanelsStore } from '../../../store/usePanelsStore';
import EffectSwitch from '../../../ui/EffectSwitch';
import { EffectBrowser } from './EffectBrowser'; 
import AIAnalysisTab from '../../sample_editor/components/AIAnalysisTab'; 
import TabButton from '../../../ui/TabButton';

const EffectSlot = ({ effect, trackId, onRemove, onBypass, onOpenUI }) => (
  <div onClick={onOpenUI} className="effect-slot" title={`Efekti aç: ${effect.type}`}>
    <div className="effect-slot__info">
      <EffectSwitch isActive={!effect.bypass} onClick={(e) => { e.stopPropagation(); onBypass(); }} />
      <span className={`effect-slot__name ${effect.bypass ? 'effect-slot__name--bypassed' : ''}`}>{effect.type}</span>
    </div>
    <div className="effect-slot__actions">
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="effect-slot__remove-btn" title="Efekti kaldır"><X size={14} /></button>
      <ArrowDownUp size={12} className="effect-slot__drag-handle" />
    </div>
  </div>
);

export const EffectsAndAnalysisPanel = ({ instrument, instrumentBuffer, track }) => {
  const [activeTab, setActiveTab] = useState('effects');
  const [view, setView] = useState('list');
  const { handleMixerEffectAdd, handleMixerEffectRemove, handleMixerEffectChange } = useMixerStore.getState();
  const { togglePluginPanel } = usePanelsStore.getState();

  const handleSelectEffect = (effectType) => {
    const newEffect = handleMixerEffectAdd(track.id, effectType);
    if (newEffect) {
      togglePluginPanel(newEffect, track);
    }
    setView('list');
  };

  return (
    <aside className="effects-analysis-panel">
      <div className="effects-analysis-panel__tabs">
        <TabButton label="Efektler" icon={SlidersHorizontal} isActive={activeTab === 'effects'} onClick={() => setActiveTab('effects')} />
        <TabButton label="AI Analiz" icon={Bot} isActive={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
      </div>
      <div className="effects-analysis-panel__content">
        {activeTab === 'effects' && track && (
          <div className="effects-panel__view-container"> {/* Yeni Wrapper */}
            <div className={`effects-panel__view ${view === 'browser' ? 'effects-panel__view--exiting' : ''}`}>
              <div className="effects-panel__list">
                {track.insertEffects.map((effect) => (
                  <EffectSlot
                    key={effect.id} effect={effect} trackId={track.id}
                    onBypass={() => handleMixerEffectChange(track.id, effect.id, 'bypass', !effect.bypass)}
                    onRemove={() => handleMixerEffectRemove(track.id, effect.id)}
                    onOpenUI={() => togglePluginPanel(effect, track)}
                  />
                ))}
              </div>
              <div className="effects-panel__footer">
                <button onClick={() => setView('browser')} className="effects-panel__add-btn"><Plus size={14} /> Efekt Ekle</button>
              </div>
            </div>
            {view === 'browser' && (
              <div className="effects-panel__view effects-panel__view--entering">
                <EffectBrowser onSelect={handleSelectEffect} onBack={() => setView('list')} />
              </div>
            )}
          </div>
        )}
        {activeTab === 'ai' && (
          <AIAnalysisTab instrument={instrument} instrumentBuffer={instrumentBuffer} />
        )}
      </div>
    </aside>
  );
};