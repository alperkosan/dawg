// src/features/sample_editor/SampleEditor.jsx - GÜNCELLENMİŞ

import React, { useState, useRef } from 'react';
import { Waves, SlidersHorizontal, Zap, Play, Pause, Loader2, Plus, X } from 'lucide-react';
import WaveformDisplay from './WaveformDisplay';
import VolumeKnob from '../../ui/VolumeKnob';
import EffectSwitch from '../../ui/EffectSwitch';
import { pluginRegistry } from '../../config/pluginConfig.jsx';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { AddEffectMenu } from '../../ui/AddEffectMenu';
import EnvelopeDisplay from './EnvelopeDisplay';
// YENİ: Artık doğrudan PluginContainer'ı kullanacağız
import PluginContainer from '../../ui/plugin_system/PluginContainer';

// --- TabButton, SampleTab, EnvelopeTab (DEĞİŞİKLİK YOK) ---
// Bu alt bileşenler aynı kalabilir.
function TabButton({ label, icon: Icon, isActive, onClick }) {
    const style = {
        backgroundColor: isActive ? 'var(--color-surface)' : 'var(--color-background)',
        color: isActive ? 'var(--color-text)' : 'var(--color-muted)',
        padding: 'var(--padding-controls) calc(var(--padding-container) / 2)',
        gap: 'var(--gap-controls)',
        fontSize: 'var(--font-size-body)',
        borderTopLeftRadius: 'var(--border-radius)',
        borderTopRightRadius: 'var(--border-radius)',
    };
    return (
        <button onClick={onClick} className="flex items-center font-bold transition-colors" style={style}>
            <Icon size={16} />
            <span>{label}</span>
        </button>
    );
}

function SampleTab({ instrument, instrumentBuffer, audioEngineRef }) {
    const { updateInstrument, handleTogglePrecomputedEffect, handlePreviewInstrumentSlice } = useInstrumentsStore.getState();
    const effectsState = instrument.precomputed || {};
    const isProcessing = useInstrumentsStore(state => state.processingEffects[instrument.id]);
    const isPreviewPlaying = usePlaybackStore(state => state.isPreviewPlaying);

    const handlePreview = (e) => {
        e.stopPropagation();
        handlePreviewInstrumentSlice(instrument.id, audioEngineRef.current);
    };

    return (
        <div className="w-full h-full flex" style={{ padding: 'var(--padding-container)', gap: 'var(--padding-container)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-48 shrink-0 flex flex-col" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', padding: 'var(--padding-container)', gap: 'var(--gap-container)'}}>
                <div>
                    <h3 className="text-center font-bold uppercase" style={{ fontSize: 'var(--font-size-label)', color: 'var(--color-muted)', marginBottom: 'var(--gap-controls)' }}>Trim</h3>
                    <div className="flex items-center justify-around mt-2">
                        <VolumeKnob label="Start" value={instrument.smpStart || 0} onChange={(val) => updateInstrument(instrument.id, { smpStart: val }, true, audioEngineRef.current)} min={0} max={1} defaultValue={0} />
                        <VolumeKnob label="Length" value={instrument.smpLength || 1} onChange={(val) => updateInstrument(instrument.id, { smpLength: val }, true, audioEngineRef.current)} min={0.01} max={1} defaultValue={1} />
                    </div>
                </div>
                <div className="w-full h-[1px]" style={{backgroundColor: 'var(--color-border)'}}/>
                <div>
                    <h3 className="text-center font-bold uppercase" style={{ fontSize: 'var(--font-size-label)', color: 'var(--color-muted)', marginBottom: 'var(--gap-controls)' }}>Process</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-2 place-items-start">
                        <EffectSwitch label="Normalize" isActive={effectsState.normalize} onClick={() => handleTogglePrecomputedEffect(instrument.id, 'normalize', audioEngineRef.current)} disabled={isProcessing} />
                        <EffectSwitch label="Reverse" isActive={effectsState.reverse} onClick={() => handleTogglePrecomputedEffect(instrument.id, 'reverse', audioEngineRef.current)} disabled={isProcessing} />
                        <EffectSwitch label="Rev Polarity" isActive={effectsState.reversePolarity} onClick={() => handleTogglePrecomputedEffect(instrument.id, 'reversePolarity', audioEngineRef.current)} disabled={isProcessing}/>
                        <EffectSwitch label="Remove DC" isActive={effectsState.removeDCOffset} onClick={() => handleTogglePrecomputedEffect(instrument.id, 'removeDCOffset', audioEngineRef.current)} disabled={isProcessing}/>
                    </div>
                </div>
            </div>

            <div className="flex-grow rounded-lg relative flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)'}}>
                {isProcessing ? (
                    <div className="flex flex-col items-center gap-2" style={{color: 'var(--color-primary)'}}>
                        <Loader2 className="animate-spin" size={32} />
                        <span className="text-sm font-bold">Dalga formu işleniyor...</span>
                    </div>
                ) : (
                    <>
                        <button onClick={handlePreview} className="absolute z-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white rounded-full p-3 transition-colors">
                            {isPreviewPlaying ? <Pause size={28} /> : <Play size={28} />}
                        </button>
                        <WaveformDisplay buffer={instrumentBuffer} className="w-full h-full" />
                    </>
                )}
            </div>
        </div>
    );
}

function EnvelopeTab({ instrument, audioEngineRef }) {
    const handleInstrumentSynthParamChange = useInstrumentsStore(state => state.handleInstrumentSynthParamChange);
    const envelope = instrument.envelope || { attack: 0.01, decay: 0.1, sustain: 0.9, release: 1.0 };

    return (
        <div className="w-full h-full flex" style={{ padding: 'var(--padding-container)', gap: 'var(--padding-container)', backgroundColor: 'var(--color-surface)' }}>
            <div className="w-48 shrink-0 flex flex-col" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', padding: 'var(--padding-container)', gap: 'var(--gap-container)'}}>
                <h3 className="text-center font-bold uppercase" style={{ fontSize: 'var(--font-size-label)', color: 'var(--color-muted)', marginBottom: 'var(--gap-controls)' }}>Volume Envelope</h3>
                <VolumeKnob label="Attack" value={envelope.attack} onChange={(val) => handleInstrumentSynthParamChange(instrument.id, 'envelope.attack', val, audioEngineRef.current)} min={0.001} max={2} defaultValue={0.01} />
                <VolumeKnob label="Decay" value={envelope.decay} onChange={(val) => handleInstrumentSynthParamChange(instrument.id, 'envelope.decay', val, audioEngineRef.current)} min={0.001} max={2} defaultValue={0.1} />
                <VolumeKnob label="Sustain" value={envelope.sustain} onChange={(val) => handleInstrumentSynthParamChange(instrument.id, 'envelope.sustain', val, audioEngineRef.current)} min={0} max={1} defaultValue={0.9} />
                <VolumeKnob label="Release" value={envelope.release} onChange={(val) => handleInstrumentSynthParamChange(instrument.id, 'envelope.release', val, audioEngineRef.current)} min={0.001} max={5} defaultValue={1.0} />
            </div>
            <div className="flex-grow relative flex items-center justify-center">
                <EnvelopeDisplay envelope={envelope} />
            </div>
        </div>
    );
}


// --- Effects Sekmesi (MİMARİ OLARAK GÜNCELLENDİ) ---
function EffectsTab({ track, audioEngineRef }) {
    // Verileri ve eylemleri doğrudan store'dan alıyoruz
    const focusedEffect = useMixerStore(state => state.focusedEffect);
    const { setFocusedEffect, handleMixerEffectChange, handleMixerEffectAdd, handleMixerEffectRemove } = useMixerStore.getState();
    
    const [menuState, setMenuState] = useState({ isOpen: false, x: 0, y: 0 });
    const addButtonRef = useRef(null);

    // Açık olan (focus'lanmış) efekti bul
    const currentEffect = focusedEffect && focusedEffect.trackId === track.id
      ? track.insertEffects.find(fx => fx.id === focusedEffect.effectId)
      : null;
      
    const pluginDefinition = currentEffect ? pluginRegistry[currentEffect.type] : null;
    const PluginUIComponent = pluginDefinition ? pluginDefinition.uiComponent : null;

    const handleSelectEffect = (effectType) => {
        handleMixerEffectAdd(track.id, effectType);
        setMenuState({ isOpen: false });
    };
    
    const handleAddButtonClick = () => {
        if (addButtonRef.current) {
            const rect = addButtonRef.current.getBoundingClientRect();
            setMenuState(prev => ({ isOpen: !prev.isOpen, x: rect.left, y: rect.bottom + 5 }));
        }
    };

    // Bu fonksiyon artık hem tekil parametreleri hem de preset objelerini yönetir
    const handlePluginChange = (paramOrSettings, value) => {
        if (currentEffect) {
            handleMixerEffectChange(track.id, currentEffect.id, paramOrSettings, value, audioEngineRef.current);
        }
    };

    return (
        <div className="w-full h-full flex" style={{ padding: 'var(--padding-container)', gap: 'var(--padding-container)', backgroundColor: 'var(--color-surface)' }}>
            {/* Sol Taraf: Efekt Listesi (DEĞİŞİKLİK YOK) */}
            <div className="w-48 shrink-0 flex flex-col" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', padding: 'var(--padding-container)', gap: 'var(--gap-container)'}}>
                <h3 className="text-center font-bold uppercase" style={{ fontSize: 'var(--font-size-label)', color: 'var(--color-muted)', marginBottom: 'var(--gap-controls)' }}>Inserts on '{track.name}'</h3>
                <div className="flex-grow min-h-0 overflow-y-auto pr-1 flex flex-col gap-1 mt-1">
                    {track.insertEffects.map((effect) => (
                         <div
                          key={effect.id}
                          onClick={() => setFocusedEffect({ trackId: track.id, effectId: effect.id })}
                          className={`p-2 rounded text-sm cursor-pointer transition-colors flex items-center justify-between ${currentEffect?.id === effect.id ? 'bg-blue-700' : 'bg-gray-700/50 hover:bg-gray-700'}`}
                        >
                            <span className="truncate font-bold">{effect.type}</span>
                            <div className="flex items-center">
                                <EffectSwitch isActive={!effect.bypass} onClick={(e) => { e.stopPropagation(); handleMixerEffectChange(track.id, effect.id, 'bypass', !effect.bypass, audioEngineRef.current)}} />
                                <button onClick={(e) => { e.stopPropagation(); handleMixerEffectRemove(track.id, effect.id)}} className="ml-1 text-gray-500 hover:text-red-500" title="Efekti Sil">
                                    <X size={14}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="relative mt-auto pt-2 border-t border-gray-700">
                   <button ref={addButtonRef} onClick={handleAddButtonClick} className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-xs bg-gray-700 hover:bg-blue-600 rounded">
                       <Plus size={14}/> <span>Efekt Ekle</span>
                   </button>
                   {menuState.isOpen && (<AddEffectMenu onSelect={handleSelectEffect} onClose={() => setMenuState({ isOpen: false })} x={menuState.x} y={menuState.y} />)}
                </div>
            </div>

            {/* Sağ Taraf: Plugin Arayüzü (GÜNCELLENDİ) */}
            <div className="flex-grow bg-gray-900 rounded-lg p-2 flex flex-col">
                {pluginDefinition && PluginUIComponent && currentEffect ? (
                    <PluginContainer
                        key={currentEffect.id} // ID değiştiğinde yeniden render olmasını sağlar
                        trackId={track.id}
                        effect={currentEffect}
                        definition={pluginDefinition}
                        onChange={handlePluginChange}
                    >
                        {/* Eklentinin kendine özel arayüzü (knob'lar vb.) children olarak içeriye aktarılıyor */}
                        <PluginUIComponent
                            trackId={track.id}
                            effect={currentEffect}
                            onChange={(param, value) => handlePluginChange(param, value)}
                            definition={pluginDefinition}
                        />
                    </PluginContainer>
                ) : (
                    <div className="text-center text-gray-500 m-auto">
                        <p>Ayarlarını görmek için soldaki listeden bir efekt seçin veya yeni bir efekt ekleyin.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Ana SampleEditor Bileşeni (DEĞİŞİKLİK YOK) ---
const SampleEditor = React.memo(function SampleEditor({ instrument, audioEngineRef }) {
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));
  const [activeTab, setActiveTab] = useState('effects');
  const instrumentBuffer = usePanelsStore(state => state.editorBuffer); 

  if (!instrument || !track) {
    return <div style={{padding: 'var(--padding-container)', color: 'var(--color-accent)'}}>Enstrüman veya bağlı olduğu mixer kanalı bulunamadı.</div>;
  }

  return (
    <div className="w-full h-full flex flex-col">
        <div className="flex flex-row">
            <TabButton label="Sample" icon={Waves} isActive={activeTab === 'sample'} onClick={() => setActiveTab('sample')} />
            <TabButton label="Envelope" icon={Zap} isActive={activeTab === 'envelope'} onClick={() => setActiveTab('envelope')} />
            <TabButton label="Effects" icon={SlidersHorizontal} isActive={activeTab === 'effects'} onClick={() => setActiveTab('effects')} />
        </div>
        <div className="flex-grow min-h-0">
            {activeTab === 'sample' && <SampleTab instrument={instrument} instrumentBuffer={instrumentBuffer} audioEngineRef={audioEngineRef} />}
            {activeTab === 'envelope' && <EnvelopeTab instrument={instrument} audioEngineRef={audioEngineRef} />}
            {activeTab === 'effects' && <EffectsTab track={track} audioEngineRef={audioEngineRef} />}
        </div>
    </div>
  );
});

export default SampleEditor;