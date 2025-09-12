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
import EnvelopeDisplay from './EnvelopeDisplay'; // Yeni Envelope görselleştirici

// --- ALT BİLEŞENLER (SEKMELER) YENİDEN TASARLANDI ---

function TabButton({ label, icon: Icon, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${
        isActive ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800/70'
      }`}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function SampleTab({ instrument, instrumentBuffer, audioEngineRef }) {
    const { updateInstrument, handleTogglePrecomputedEffect, handlePreviewInstrumentSlice } = useInstrumentsStore.getState();
    const effectsState = instrument.precomputed || {};
    const isProcessing = useInstrumentsStore(state => state.processingEffects[instrument.id]);

    // YENİ: Önizleme oynatıcısının durumunu takip et
    const isPreviewPlaying = usePlaybackStore(state => state.isPreviewPlaying);

    const handlePreview = (e) => {
        e.stopPropagation();
        handlePreviewInstrumentSlice(instrument.id, audioEngineRef.current);
    };

    return (
        <div className="w-full h-full flex gap-4 p-4 text-white bg-gray-800 rounded-b-lg rounded-r-lg">
            {/* Sol Sütun: Kontroller (değişiklik yok) */}
            <div className="w-48 bg-gray-900 rounded-lg p-4 flex flex-col gap-6 shrink-0">
                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider text-center">Trim</h3>
                    <div className="flex items-center justify-around mt-2">
                        {/* --- DEĞİŞİKLİK: onChange artık 'updateInstrument' fonksiyonunu doğru parametrelerle çağırıyor --- */}
                        <VolumeKnob 
                            label="Start" 
                            value={instrument.smpStart || 0} 
                            onChange={(val) => updateInstrument(instrument.id, { smpStart: val }, true, audioEngineRef.current)} 
                            min={0} max={1} defaultValue={0} 
                        />
                        <VolumeKnob 
                            label="Length" 
                            value={instrument.smpLength || 1} 
                            onChange={(val) => updateInstrument(instrument.id, { smpLength: val }, true, audioEngineRef.current)} 
                            min={0.01} max={1} defaultValue={1} 
                        />
                    </div>
                </div>
                <div className="w-full h-[1px] bg-gray-700" />
                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider text-center">Process</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-2 place-items-start">
                        <EffectSwitch label="Normalize" isActive={effectsState.normalize} onClick={() => handleTogglePrecomputedEffect(instrument.id, 'normalize', audioEngineRef.current)} disabled={isProcessing} />
                        <EffectSwitch label="Reverse" isActive={effectsState.reverse} onClick={() => handleTogglePrecomputedEffect(instrument.id, 'reverse', audioEngineRef.current)} disabled={isProcessing} />
                        <EffectSwitch label="Rev Polarity" isActive={effectsState.reversePolarity} onClick={() => handleTogglePrecomputedEffect(instrument.id, 'reversePolarity', audioEngineRef.current)} disabled={isProcessing}/>
                        <EffectSwitch label="Remove DC" isActive={effectsState.removeDCOffset} onClick={() => handleTogglePrecomputedEffect(instrument.id, 'removeDCOffset', audioEngineRef.current)} disabled={isProcessing}/>
                    </div>
                </div>
            </div>

            {/* Sağ Sütun: Dalga Formu */}
            <div className="flex-grow bg-gray-900 rounded-lg relative flex items-center justify-center">
                {isProcessing ? (
                    <div className="flex flex-col items-center gap-2 text-cyan-400">
                        <Loader2 className="animate-spin" size={32} />
                        <span className="text-sm font-bold">Dalga formu işleniyor...</span>
                    </div>
                ) : (
                    <>
                        {/* --- YENİ OYNATMA BUTONU --- */}
                        <button 
                            onClick={handlePreview}
                            className="absolute z-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white rounded-full p-3 transition-colors"
                        >
                            {isPreviewPlaying ? <Pause size={28} /> : <Play size={28} />}
                        </button>
                        <WaveformDisplay
                          buffer={instrumentBuffer}
                          className="w-full h-full"
                        />
                    </>
                )}
            </div>
        </div>
    );
}


// --- Envelope Sekmesi (Yeni 2 Sütunlu Tasarım) ---
function EnvelopeTab({ instrument, audioEngineRef }) {
    const handleInstrumentSynthParamChange = useInstrumentsStore(state => state.handleInstrumentSynthParamChange);
    const envelope = instrument.envelope || { attack: 0.01, decay: 0.1, sustain: 0.9, release: 1.0 };

    return (
        <div className="w-full h-full flex gap-4 p-4 text-white bg-gray-800 rounded-b-lg rounded-r-lg">
            {/* Sol Sütun: Kontroller */}
            <div className="w-48 bg-gray-900 rounded-lg p-4 flex flex-col justify-center gap-6 shrink-0">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider text-center absolute top-8 left-1/2 -translate-x-1/2 w-48">Volume Envelope</h3>
                <VolumeKnob label="Attack" value={envelope.attack} onChange={(val) => handleInstrumentSynthParamChange(instrument.id, 'envelope.attack', val, audioEngineRef.current)} min={0.001} max={2} defaultValue={0.01} />
                <VolumeKnob label="Decay" value={envelope.decay} onChange={(val) => handleInstrumentSynthParamChange(instrument.id, 'envelope.decay', val, audioEngineRef.current)} min={0.001} max={2} defaultValue={0.1} />
                <VolumeKnob label="Sustain" value={envelope.sustain} onChange={(val) => handleInstrumentSynthParamChange(instrument.id, 'envelope.sustain', val, audioEngineRef.current)} min={0} max={1} defaultValue={0.9} />
                <VolumeKnob label="Release" value={envelope.release} onChange={(val) => handleInstrumentSynthParamChange(instrument.id, 'envelope.release', val, audioEngineRef.current)} min={0.001} max={5} defaultValue={1.0} />
            </div>
            {/* Sağ Sütun: Envelope Grafiği */}
            <div className="flex-grow relative flex items-center justify-center">
                <EnvelopeDisplay envelope={envelope} />
            </div>
        </div>
    );
}

// --- Effects Sekmesi (Mevcut Tasarım Korundu) ---
function EffectsTab({ track, audioEngineRef }) {
    const focusedEffect = useMixerStore(state => state.focusedEffect);
    const { setFocusedEffect, handleMixerEffectChange, handleMixerEffectAdd, handleMixerEffectRemove } = useMixerStore.getState();
    const { instruments } = useInstrumentsStore.getState();
    const [menuState, setMenuState] = useState({ isOpen: false, x: 0, y: 0 });
    const addButtonRef = useRef(null);

    const currentEffect = focusedEffect && focusedEffect.trackId === track.id
      ? track.insertEffects.find(fx => fx.id === focusedEffect.effectId)
      : null;
      
    const pluginDefinition = currentEffect ? pluginRegistry[currentEffect.type] : null;
    const PluginUIComponent = pluginDefinition ? pluginDefinition.uiComponent : null;

    const handleSelectEffect = (effectType) => {
        handleMixerEffectAdd(track.id, effectType, instruments, audioEngineRef.current);
        setMenuState({ isOpen: false, x: 0, y: 0 });
    };
    
    const handleAddButtonClick = () => {
        if (addButtonRef.current) {
            const rect = addButtonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const estimatedMenuHeight = 250; // Menünün yaklaşık yüksekliği (piksel)

            let menuY;

            // Eğer aşağıda yeterli alan yoksa VE yukarıda yeterli alan varsa, menüyü yukarıya aç.
            if (spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight) {
                menuY = rect.top - estimatedMenuHeight;
            } else {
                // Varsayılan olarak menüyü aşağıya aç.
                menuY = rect.bottom + 5;
            }

            setMenuState(prevState => ({
                isOpen: !prevState.isOpen,
                x: rect.left,
                y: menuY
            }));
        }
    };

    const handlePluginChange = (paramId, value) => {
        if (currentEffect) {
            // --- DEĞİŞİKLİK BURADA: audioEngineRef.current'i eyleme iletiyoruz ---
            handleMixerEffectChange(track.id, currentEffect.id, paramId, value, audioEngineRef.current);
        }
    };

    return (
        <div className="w-full h-full flex gap-4 p-4 text-white bg-gray-800 rounded-b-lg rounded-r-lg">
            {/* Sol Sütun: Efekt Listesi */}
            <div className="w-48 bg-gray-900 rounded-lg p-2 flex flex-col gap-1 shrink-0">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center p-2">Inserts on '{track.name}'</h3>
                <div className="flex-grow min-h-0 overflow-y-auto pr-1 flex flex-col gap-1 mt-1">
                    {track.insertEffects.map((effect) => (
                         <div
                          key={effect.id}
                          onClick={() => setFocusedEffect({ trackId: track.id, effectId: effect.id })}
                          className={`p-2 rounded text-sm cursor-pointer transition-colors flex items-center justify-between ${currentEffect?.id === effect.id ? 'bg-cyan-700' : 'bg-gray-700/50 hover:bg-gray-700'}`}
                        >
                            <span className="truncate font-bold">{effect.type}</span>
                            <div className="flex items-center">
                                <EffectSwitch isActive={!effect.bypass} onClick={(e) => { e.stopPropagation(); handleMixerEffectChange(track.id, effect.id, 'bypass', !effect.bypass, audioEngineRef.current)}} />
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleMixerEffectRemove(track.id, effect.id, instruments, audioEngineRef.current)}}
                                    className="ml-1 text-gray-500 hover:text-red-500" title="Efekti Sil">
                                    <X size={14}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="relative mt-auto pt-2 border-t border-gray-700">
                   <button 
                        ref={addButtonRef}
                        onClick={handleAddButtonClick} 
                        className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-xs bg-gray-700 hover:bg-cyan-600 rounded"
                   >
                       <Plus size={14}/> 
                       <span>Efekt Ekle</span>
                   </button>
                   {menuState.isOpen && (
                       <AddEffectMenu 
                           onSelect={handleSelectEffect} 
                           onClose={() => setMenuState({ isOpen: false, x: 0, y: 0 })}
                           x={menuState.x}
                           y={menuState.y}
                       />
                   )}
                </div>
            </div>
            {/* Sağ Sütun: Plugin Arayüzü */}
            <div className="flex-grow bg-gray-900 rounded-lg p-2 flex flex-col">
                {pluginDefinition && PluginUIComponent ? (
                    <PluginUIComponent
                        effect={currentEffect}
                        onChange={handlePluginChange} 
                        definition={pluginDefinition}
                        trackId={track.id}
                        audioEngineRef={audioEngineRef}
                    />
                ) : (
                    <div className="text-center text-gray-500 m-auto">
                        <p>Ayarlarını görmek için soldaki listeden bir efekt seçin veya yeni bir efekt ekleyin.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Ana SampleEditor Bileşeni ---
const SampleEditor = React.memo(function SampleEditor({ instrument, audioEngineRef }) {
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));
  const [activeTab, setActiveTab] = useState('sample');
  const instrumentBuffer = usePanelsStore(state => state.editorBuffer); 

  if (!instrument || !track) {
    return <div className="p-4 bg-gray-800 text-red-500">Enstrüman veya bağlı olduğu mixer kanalı bulunamadı. Lütfen pencereyi kapatıp tekrar açın.</div>;
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