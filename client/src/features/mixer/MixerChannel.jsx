import React, { useState, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import VolumeKnob from '../../ui/VolumeKnob';
import Fader from '../../ui/Fader';
import EffectSwitch from '../../ui/EffectSwitch';
import { useMixerStore } from '../../store/useMixerStore';
import { AddEffectMenu } from '../../ui/AddEffectMenu';

const MixerChannel = React.memo(function MixerChannel({ trackId, audioEngineRef }) {
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === trackId));
  const { handleMixerParamChange, handleMixerEffectChange, handleMixerEffectAdd, handleMixerEffectRemove } = useMixerStore.getState();
  const [menuState, setMenuState] = useState({ isOpen: false, x: 0, y: 0 });
  const addButtonRef = useRef(null);

  if (!track) return null;

  const isMaster = track.type === 'master';

  const handleSelectEffect = (effectType) => {
    handleMixerEffectAdd(track.id, effectType);
    setMenuState({ isOpen: false, x: 0, y: 0 });
  };

  const handleAddButtonClick = () => {
    if (addButtonRef.current) {
        const rect = addButtonRef.current.getBoundingClientRect();
        setMenuState({ isOpen: true, x: rect.right + 5, y: rect.top });
    }
  };

  const channelStyle = {
    backgroundColor: 'var(--color-surface)',
    border: `1px solid ${isMaster ? 'var(--color-accent)' : 'var(--color-border)'}`,
    borderRadius: 'var(--border-radius)',
    color: 'var(--color-text)',
  };

  const insertsContainerStyle = {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 'var(--border-radius)',
  };
  
  const trackNameStyle = {
      backgroundColor: 'var(--color-background)',
      borderRadius: 'var(--border-radius)',
  };

  return (
    <div className="flex flex-col p-2 w-28 shrink-0 shadow-lg relative" style={channelStyle}>
      <div className="h-32 p-1 flex flex-col gap-1 mb-2 text-xs" style={insertsContainerStyle}>
        <span className="font-bold text-center sticky top-0 py-1" style={{ fontSize: 'var(--font-size-label)', color: 'var(--color-muted)' }}>INSERTS</span>
        <div className="flex-grow min-h-0 overflow-y-auto pr-1 flex flex-col gap-1">
          {track.insertEffects.map(effect => (
             <div key={effect.id} className="bg-[var(--color-surface2)] p-1 rounded text-xs flex items-center justify-between">
              <span className="truncate" style={{ color: 'var(--color-primary)' }}>{effect.type}</span>
              <div className="flex items-center">
                 <EffectSwitch isActive={!effect.bypass} onClick={() => handleMixerEffectChange(track.id, effect.id, 'bypass', !effect.bypass, audioEngineRef.current)} />
                 <button onClick={() => handleMixerEffectRemove(track.id, effect.id)} className="ml-1 text-[var(--color-muted)] hover:text-[var(--color-accent)]" title="Efekti Sil">
                    <X size={12}/>
                 </button>
              </div>
            </div>
          ))}
        </div>
        <div className="relative mt-auto">
            <button ref={addButtonRef} onClick={handleAddButtonClick} className="w-full mt-1 text-[var(--color-primary)] hover:text-[var(--color-text)] text-xs flex items-center justify-center gap-1">
                <Plus size={12}/> <span>Ekle</span>
            </button>
            {menuState.isOpen && (
                <AddEffectMenu onSelect={handleSelectEffect} onClose={() => setMenuState({ isOpen: false, x: 0, y: 0 })} x={menuState.x} y={menuState.y} />
            )}
        </div>
      </div>
      {!isMaster && (
        <div className="flex justify-center mb-2">
            <VolumeKnob label="Pan" value={track.pan} onChange={(val) => handleMixerParamChange(track.id, 'pan', val, audioEngineRef.current)} min={-1} max={1} defaultValue={0}/>
        </div>
      )}
      <div className="flex-grow h-40">
        <Fader value={track.volume} onChange={(val) => handleMixerParamChange(track.id, 'volume', val, audioEngineRef.current)} />
      </div>
      <div className="rounded mt-2 p-2 text-center h-10 flex items-center justify-center" style={trackNameStyle}>
        <span className="font-bold truncate" style={{ fontSize: 'var(--font-size-body)' }}>{track.name}</span>
      </div>
    </div>
  );
});

export default MixerChannel;