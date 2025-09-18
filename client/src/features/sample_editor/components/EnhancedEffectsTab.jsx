// enhanced-effects-tab.tsx dosyasının içeriğini buraya yapıştırın.
import React, { useState, useRef } from 'react';
import { Plus, X, Power, SlidersHorizontal } from 'lucide-react';
import { useMixerStore } from '../../../store/useMixerStore';
import { pluginRegistry } from '../../../config/pluginConfig';

// Modern Effect Chain Visualization
const EffectChainVisualizer = ({ effects, onReorder, onBypass, onRemove, focusedEffectId }) => {
  return (
    <div className="space-y-2">
      {effects.map((effect, index) => {
        const isFocused = focusedEffectId === effect.id;
        const isBypassed = effect.bypass;
        return (
          <div
            key={effect.id}
            className={`group relative p-3 rounded-lg border-2 transition-all cursor-move ${
              isFocused ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-700/50'
            } ${isBypassed ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm">{effect.type}</h4>
              <button
                onClick={() => onRemove?.(effect.id)}
                className="p-1 text-gray-500 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Enhanced Effects Tab Component
const EnhancedEffectsTab = ({ track, audioEngineRef }) => {
  const focusedEffect = useMixerStore(state => state.focusedEffect);
  const { handleMixerEffectChange, handleMixerEffectAdd, handleMixerEffectRemove } = useMixerStore.getState();
  const [showEffectBrowser, setShowEffectBrowser] = useState(false);
  const addButtonRef = useRef(null);
  const currentEffect = focusedEffect && focusedEffect.trackId === track.id
    ? track.insertEffects.find(fx => fx.id === focusedEffect.effectId)
    : null;
      
  const handleAddEffect = (effectType) => {
    handleMixerEffectAdd(track.id, effectType);
    setShowEffectBrowser(false);
  };

  const handleRemoveEffect = (effectId) => {
      handleMixerEffectRemove(track.id, effectId);
  };

  return (
    <div className="w-full h-full bg-gray-900 text-white flex">
      <div className="w-80 bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <SlidersHorizontal size={18} />
            Effects Chain
          </h3>
          <button
            ref={addButtonRef}
            onClick={() => setShowEffectBrowser(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium text-sm transition-colors mt-3"
          >
            <Plus size={14} />
            Add Effect
          </button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <EffectChainVisualizer
            effects={track.insertEffects}
            onRemove={handleRemoveEffect}
            focusedEffectId={currentEffect?.id}
          />
        </div>
      </div>
      <div className="flex-1 flex flex-col">
          {/* Effect Parameters will be rendered here */}
      </div>
    </div>
  );
};

export default EnhancedEffectsTab;