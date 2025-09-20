import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Power, Settings, Trash2 } from 'lucide-react';
import VolumeKnob from '../../../ui/VolumeKnob';
import { useMixerStore } from '../../../store/useMixerStore';
import { usePanelsStore } from '../../../store/usePanelsStore';

const DND_TYPE = 'EFFECT_SLOT';

export const EffectSlot = ({ effect, trackId, index, moveEffect }) => {
  const ref = useRef(null);
  const { handleMixerEffectChange, handleMixerEffectRemove } = useMixerStore.getState();

  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: { id: effect.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: DND_TYPE,
    hover(item, monitor) {
      if (!ref.current || item.index === index) {
        return;
      }
      moveEffect(item.index, index);
      item.index = index;
    },
  });

  drag(drop(ref));

  // "Mix" ayarı olmayan efektler için (örn: EQ) bu potansı gösterme
  const hasMixControl = effect.settings.wet !== undefined;

  return (
    <div ref={ref} className="effect-slot-v2" style={{ opacity: isDragging ? 0.3 : 1 }}>
      <div className="effect-slot-v2__header">
        <span className="effect-slot-v2__title">{effect.type}</span>
        <div className="effect-slot-v2__header-buttons">
          <button 
            onClick={() => handleMixerEffectChange(trackId, effect.id, 'bypass', !effect.bypass)}
            title={effect.bypass ? "Aktif Et" : "Bypass"}
            className={`effect-slot-v2__icon-btn ${!effect.bypass ? 'active' : ''}`}
          >
            <Power size={14} />
          </button>
          <button 
             onClick={() => usePanelsStore.getState().togglePluginPanel(effect, { id: trackId, name: 'Track' })} // Basitleştirilmiş track objesi
            title="Ayarları Aç" 
            className="effect-slot-v2__icon-btn"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
      <div className="effect-slot-v2__body">
        {hasMixControl && (
          <VolumeKnob
            label="Mix"
            value={(effect.settings.wet || 0) * 100}
            onChange={(val) => handleMixerEffectChange(trackId, effect.id, 'wet', val / 100)}
            min={0}
            max={100}
            defaultValue={100}
            size={32}
            unit="%"
          />
        )}
        {/* Gelecekte diğer hızlı kontroller buraya eklenebilir */}
      </div>
       <button onClick={() => handleMixerEffectRemove(trackId, effect.id)} className="effect-slot-v2__remove-btn">
          <Trash2 size={14} />
        </button>
    </div>
  );
};