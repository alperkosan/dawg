import React, { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useMixerStore } from '../../../store/useMixerStore';
import { usePanelsStore } from '../../../store/usePanelsStore';
import { AddEffectMenu } from '../../../ui/AddEffectMenu';
import { EffectSlot } from './EffectSlot';

export const EffectsRack = ({ track }) => {
  const { handleMixerEffectAdd, reorderEffect } = useMixerStore.getState();
  const { togglePluginPanel } = usePanelsStore.getState();
  const [addEffectMenu, setAddEffectMenu] = useState(null);

  const handleSelectEffect = (effectType) => {
    const newEffect = handleMixerEffectAdd(track.id, effectType);
    if (newEffect) {
      togglePluginPanel(newEffect, track);
    }
    setAddEffectMenu(null);
  };

  const moveEffect = useCallback((dragIndex, hoverIndex) => {
    reorderEffect(track.id, dragIndex, hoverIndex);
  }, [track.id, reorderEffect]);

  return (
    <div className="effects-rack">
      {track.insertEffects.map((effect, i) => (
        <EffectSlot
          key={effect.id}
          index={i}
          effect={effect}
          trackId={track.id}
          moveEffect={moveEffect}
        />
      ))}
      <button 
        className="effects-rack__add-btn" 
        onClick={(e) => {
          e.stopPropagation();
          setAddEffectMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <Plus size={24} />
      </button>
      {addEffectMenu && (
        <AddEffectMenu
          x={addEffectMenu.x}
          y={addEffectMenu.y}
          onClose={() => setAddEffectMenu(null)}
          onSelect={handleSelectEffect}
        />
      )}
    </div>
  );
};