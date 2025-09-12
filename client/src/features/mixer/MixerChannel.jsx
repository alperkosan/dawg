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

  return (
    <div className={`flex flex-col border rounded-lg p-2 w-28 shrink-0 bg-gray-800 shadow-lg relative ${isMaster ? 'border-amber-500' : 'border-gray-700'}`}>
      <div className="h-32 bg-gray-900/50 rounded p-1 flex flex-col gap-1 mb-2 text-xs text-gray-500">
        <span className="font-bold text-center sticky top-0 bg-gray-900/50 py-1">INSERTS</span>
        <div className="flex-grow min-h-0 overflow-y-auto pr-1 flex flex-col gap-1">
          {track.insertEffects.map(effect => (
             <div key={effect.id} className="bg-gray-700/50 p-1 rounded text-xs flex items-center justify-between">
              <span className="truncate text-cyan-400">{effect.type}</span>
              <div className="flex items-center">
                 <EffectSwitch isActive={!effect.bypass} onClick={() => handleMixerEffectChange(track.id, effect.id, 'bypass', !effect.bypass, audioEngineRef.current)} />
                 <button onClick={() => handleMixerEffectRemove(track.id, effect.id)} className="ml-1 text-gray-500 hover:text-red-500" title="Efekti Sil">
                    <X size={12}/>
                 </button>
              </div>
            </div>
          ))}
        </div>
        <div className="relative mt-auto">
            <button ref={addButtonRef} onClick={handleAddButtonClick} className="w-full mt-1 text-cyan-500 hover:text-cyan-300 text-xs flex items-center justify-center gap-1">
                <Plus size={12}/> <span>Ekle</span>
            </button>
            {menuState.isOpen && (
                <AddEffectMenu onSelect={handleSelectEffect} onClose={() => setMenuState({ isOpen: false, x: 0, y: 0 })} x={menuState.x} y={menuState.y} />
            )}
        </div>
      </div>
      {!isMaster && (
        <div className="flex justify-center mb-2">
            <VolumeKnob label="Pan" value={track.pan} onChange={(val) => handleMixerParamChange(track.id, 'pan', val)} min={-1} max={1} defaultValue={0}/>
        </div>
      )}
      <div className="flex-grow h-40">
        <Fader value={track.volume} onChange={(val) => handleMixerParamChange(track.id, 'volume', val)} />
      </div>
      <div className="bg-gray-900 rounded mt-2 p-2 text-center h-10 flex items-center justify-center">
        <span className="font-bold text-sm truncate">{track.name}</span>
      </div>
    </div>
  );
});

export default MixerChannel;
