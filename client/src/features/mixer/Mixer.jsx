import React, { useMemo, useState } from 'react';
import MixerChannel from './MixerChannel';
import { useMixerStore } from '../../store/useMixerStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { SlidersHorizontal, Plus, Trash2, Power, ArrowDownUp } from 'lucide-react';
import { AddEffectMenu } from '../../ui/AddEffectMenu';
import ChannelContextMenu from '../../components/ChannelContextMenu';

// InsertPanel bileşenini Mixer dosyasının içine taşıdım, çünkü sadece burada kullanılıyor.
const InsertPanel = ({ activeTrack }) => {
    const { handleMixerEffectAdd, handleMixerEffectRemove, handleMixerEffectChange, reorderEffect } = useMixerStore.getState();
    const { togglePluginPanel } = usePanelsStore.getState();
    const [addEffectMenu, setAddEffectMenu] = useState(null);

    if (!activeTrack) {
        return (
            <aside className="mixer-insert-panel">
                <div className="flex flex-col items-center justify-center text-center text-gray-500 h-full">
                    <SlidersHorizontal size={32} className="mb-2"/>
                    <p className="text-sm">Select a channel to see its effects.</p>
                </div>
            </aside>
        );
    }
    
    return (
        <aside className="mixer-insert-panel">
            <h3 className="mixer-insert-panel__header truncate">
                Inserts: <span className="text-white font-normal">{activeTrack.name}</span>
            </h3>
            <div className="mixer-insert-panel__list">
                {activeTrack.insertEffects.map((effect, index) => (
                    <div
                        key={effect.id}
                        onClick={() => togglePluginPanel(effect, activeTrack)}
                        className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-all ${effect.bypass ? 'bg-gray-700/50' : 'bg-gray-700 hover:bg-gray-600/80'}`}
                        title={`Slot ${index + 1}: ${effect.type}`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <button onClick={(e) => { e.stopPropagation(); handleMixerEffectChange(activeTrack.id, effect.id, 'bypass', !effect.bypass);}} title={effect.bypass ? 'Enable' : 'Bypass'}>
                                <Power size={14} className={effect.bypass ? 'text-gray-500' : 'text-green-400'}/>
                            </button>
                            <span className={`text-sm font-semibold truncate ${effect.bypass ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                {effect.type}
                            </span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleMixerEffectRemove(activeTrack.id, effect.id);}} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove effect">
                            <Trash2 size={14}/>
                        </button>
                    </div>
                ))}
            </div>
            <button onClick={(e) => setAddEffectMenu({x: e.clientX, y: e.clientY})} className="mixer-insert-panel__add-btn">
                <Plus size={14}/> Add Effect
            </button>
            {addEffectMenu && <AddEffectMenu x={addEffectMenu.x} y={addEffectMenu.y} onClose={()=>setAddEffectMenu(null)} onSelect={(type) => { handleMixerEffectAdd(activeTrack.id, type); setAddEffectMenu(null); }}/>}
        </aside>
    );
};

function Mixer() {
  const { mixerTracks, activeChannelId, setTrackColor, setTrackName, setTrackOutput, resetTrack } = useMixerStore();
  const [contextMenu, setContextMenu] = useState(null);

  const activeTrack = useMemo(() => mixerTracks.find(t => t.id === activeChannelId), [mixerTracks, activeChannelId]);

  const { masterTracks, trackChannels, busChannels } = useMemo(() => ({
    masterTracks: mixerTracks.filter(t => t.type === 'master'),
    trackChannels: mixerTracks.filter(t => t.type === 'track'),
    busChannels: mixerTracks.filter(t => t.type === 'bus'),
  }), [mixerTracks]);
  
  const handleContextMenu = (e, track) => {
      e.preventDefault();
      e.stopPropagation();
      useMixerStore.getState().setActiveChannelId(track.id);
      setContextMenu({ x: e.clientX, y: e.clientY, track });
  };
  
  const getContextMenuOptions = () => {
      if (!contextMenu?.track) return [];
      const track = contextMenu.track;
      const availableOutputs = mixerTracks.filter(t => (t.type === 'bus' || t.type === 'master') && t.id !== track.id);
      const colorOptions = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'];

      return [
          { label: 'Rename', action: () => {
              const newName = prompt('Enter new name:', track.name);
              if (newName) setTrackName(track.id, newName);
          }},
          { label: 'Reset channel', action: () => resetTrack(track.id) },
          { type: 'separator' },
          { label: 'Change Color', children: colorOptions.map(color => ({
              label: <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />,
              action: () => setTrackColor(track.id, color)
          }))},
          { label: 'Route to', children: [
              ...availableOutputs.map(bus => ({
                  label: bus.name,
                  isActive: track.output === bus.id,
                  action: () => setTrackOutput(track.id, bus.id)
              })),
              { type: 'separator' },
              { label: 'Master', isActive: !track.output, action: () => setTrackOutput(track.id, null)}
          ]},
      ];
  };

  return (
    <div className="mixer-container" onClick={() => setContextMenu(null)}>
      <div className="mixer-channels-area">
        <div className="mixer-channels-wrapper">
          {masterTracks.map(track => <MixerChannel key={track.id} trackId={track.id} onContextMenu={handleContextMenu}/>)}
          
          {busChannels.length > 0 && <div className="mixer-channel__separator" />}
          {busChannels.map(track => <MixerChannel key={track.id} trackId={track.id} onContextMenu={handleContextMenu}/>)}
          
          {trackChannels.length > 0 && <div className="mixer-channel__separator" />}
          {trackChannels.map(track => <MixerChannel key={track.id} trackId={track.id} onContextMenu={handleContextMenu}/>)}
        </div>
      </div>
      <InsertPanel activeTrack={activeTrack} />
      {contextMenu && <ChannelContextMenu x={contextMenu.x} y={contextMenu.y} options={getContextMenuOptions()} onClose={() => setContextMenu(null)} />}
    </div>
  );
}

export default Mixer;
