import React, { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { useMixerStore } from '../../../store/useMixerStore';
import { pluginRegistry } from '../../../config/pluginConfig';
import { AddEffectMenu } from '../../../ui/AddEffectMenu';
import PluginContainer from '../../../ui/plugin_system/PluginContainer';
import EffectSwitch from '../../../ui/EffectSwitch';

function EffectsTab({ track, audioEngineRef }) {
    const { handleMixerEffectChange, handleMixerEffectAdd, handleMixerEffectRemove } = useMixerStore.getState();
    const [focusedEffectId, setFocusedEffectId] = useState(track.insertEffects[0]?.id || null);
    const [menuState, setMenuState] = useState({ isOpen: false, x: 0, y: 0 });
    const addButtonRef = useRef(null);
    
    const currentEffect = track.insertEffects.find(fx => fx.id === focusedEffectId);
    const pluginDefinition = currentEffect ? pluginRegistry[currentEffect.type] : null;
    const PluginUIComponent = pluginDefinition ? pluginDefinition.uiComponent : null;

    const handleSelectEffect = (effectType) => {
        const newEffect = handleMixerEffectAdd(track.id, effectType, audioEngineRef.current);
        if (newEffect) setFocusedEffectId(newEffect.id);
        setMenuState({ isOpen: false });
    };

    const handleAddButtonClick = () => {
        if (addButtonRef.current) {
            const rect = addButtonRef.current.getBoundingClientRect();
            setMenuState(prev => ({ isOpen: !prev.isOpen, x: rect.left, y: rect.bottom + 5 }));
        }
    };

    const handlePluginChange = (paramOrSettings, value) => {
        if (currentEffect) {
            handleMixerEffectChange(track.id, currentEffect.id, paramOrSettings, value, audioEngineRef.current);
        }
    };

    return (
        <div className="w-full h-full flex p-4 gap-4 bg-[var(--color-surface)]">
            <div className="w-48 shrink-0 flex flex-col bg-[var(--color-background)] rounded-lg p-4 gap-4">
                <h3 className="text-center font-bold uppercase text-xs text-[var(--color-muted)]">Inserts on '{track.name}'</h3>
                <div className="flex-grow min-h-0 overflow-y-auto pr-1 flex flex-col gap-1">
                    {track.insertEffects.map((effect) => (
                         <div
                          key={effect.id}
                          onClick={() => setFocusedEffectId(effect.id)}
                          className={`p-2 rounded text-sm cursor-pointer transition-colors flex items-center justify-between ${focusedEffectId === effect.id ? 'bg-blue-700' : 'bg-gray-700/50 hover:bg-gray-700'}`}
                        >
                            <span className="truncate font-bold">{effect.type}</span>
                            <div className="flex items-center">
                                <EffectSwitch isActive={!effect.bypass} onClick={(e) => { e.stopPropagation(); handleMixerEffectChange(track.id, effect.id, 'bypass', !effect.bypass, audioEngineRef.current)}} />
                                <button onClick={(e) => { e.stopPropagation(); handleMixerEffectRemove(track.id, effect.id, audioEngineRef.current)}} className="ml-1 text-gray-500 hover:text-red-500" title="Remove Effect">
                                    <X size={14}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="relative mt-auto pt-2 border-t border-[var(--color-border)]">
                   <button ref={addButtonRef} onClick={handleAddButtonClick} className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-xs bg-gray-700 hover:bg-blue-600 rounded">
                       <Plus size={14}/> <span>Add Effect</span>
                   </button>
                   {menuState.isOpen && (<AddEffectMenu onSelect={handleSelectEffect} onClose={() => setMenuState({ isOpen: false })} x={menuState.x} y={menuState.y} />)}
                </div>
            </div>
            <div className="flex-grow bg-gray-900 rounded-lg p-2 flex flex-col">
                {pluginDefinition && PluginUIComponent && currentEffect ? (
                    <PluginContainer
                        key={currentEffect.id}
                        trackId={track.id}
                        effect={currentEffect}
                        definition={pluginDefinition}
                        onChange={handlePluginChange}
                    >
                        <PluginUIComponent
                            trackId={track.id}
                            effect={currentEffect}
                            onChange={(param, value) => handlePluginChange(param, value)}
                            definition={pluginDefinition}
                        />
                    </PluginContainer>
                ) : (
                    <div className="text-center text-gray-500 m-auto">
                        <p>Select an effect from the list or add a new one.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default EffectsTab;