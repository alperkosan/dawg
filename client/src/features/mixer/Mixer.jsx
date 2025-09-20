import React, { useMemo, useState, useRef } from 'react';
import MixerChannel from './MixerChannel';
import { useMixerStore } from '../../store/useMixerStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { SlidersHorizontal, Plus, Trash2, Power, ArrowDownUp } from 'lucide-react';
import { AddEffectMenu } from '../../ui/AddEffectMenu';
import ChannelContextMenu from '../../components/ChannelContextMenu';

// Insert Paneli, artık kendi state'ini ve event'lerini daha temiz yönetiyor.
const InsertPanel = ({ activeTrack }) => {
    const { handleMixerEffectAdd, handleMixerEffectRemove, handleMixerEffectChange, reorderEffect } = useMixerStore.getState();
    const { togglePluginPanel } = usePanelsStore.getState();
    
    const [addEffectMenu, setAddEffectMenu] = useState(null); 
    const addButtonRef = useRef(null);
    const draggedItemIndex = useRef(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const handleAddButtonClick = (e) => {
        e.stopPropagation();
        if (addButtonRef.current) {
            const rect = addButtonRef.current.getBoundingClientRect();
            setAddEffectMenu({ isOpen: true, x: rect.left, y: rect.bottom + 5 });
        }
    };

    const handleSelectEffect = (effectType) => {
        handleMixerEffectAdd(activeTrack.id, effectType);
        setAddEffectMenu(null);
    };

    const onDragStart = (e, index) => {
        draggedItemIndex.current = index;
        e.dataTransfer.effectAllowed = 'move';
    };
    const onDragEnd = () => {
        draggedItemIndex.current = null;
        setDragOverIndex(null);
    };
    const onDrop = (dropIndex) => {
        const sourceIndex = draggedItemIndex.current;
        if (sourceIndex !== null && sourceIndex !== dropIndex) {
            reorderEffect(activeTrack.id, sourceIndex, dropIndex);
        }
    };
    
    if (!activeTrack) {
        return (
            <aside className="mixer-insert-panel">
                <div className="flex flex-col items-center justify-center text-center text-[var(--color-text-secondary)] h-full">
                    <SlidersHorizontal size={32} className="mb-2 opacity-50"/>
                    <p className="text-sm">Efektlerini görmek için bir kanal seçin.</p>
                </div>
            </aside>
        );
    }
    
    return (
        <aside className="mixer-insert-panel">
            <h3 className="mixer-insert-panel__header truncate">
                Inserts: <span className="text-white font-normal">{activeTrack.name}</span>
            </h3>
            <div className="mixer-insert-panel__list" onDragOver={(e) => e.preventDefault()}>
                 {activeTrack.insertEffects.map((effect, index) => (
                    <div key={effect.id}>
                        {dragOverIndex === index && <div className="h-1 bg-blue-500 rounded-full my-1" />}
                        <div
                            draggable
                            onDragStart={(e) => onDragStart(e, index)}
                            onDragEnter={() => setDragOverIndex(index)}
                            onDragEnd={onDragEnd}
                            onDrop={() => onDrop(index)}
                            onClick={() => togglePluginPanel(effect, activeTrack)}
                            className={`group flex items-center justify-between p-2 rounded-md cursor-grab active:cursor-grabbing transition-all ${effect.bypass ? 'bg-gray-700/50' : 'bg-gray-700 hover:bg-gray-600/80'}`}
                            title={`Slot ${index + 1}: ${effect.type}\n(Açmak için tıkla, sıralamak için sürükle)`}
                        >
                            <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); handleMixerEffectChange(activeTrack.id, effect.id, 'bypass', !effect.bypass);}} title={effect.bypass ? 'Aktif Et' : 'Bypass'}>
                                    <Power size={14} className={effect.bypass ? 'text-gray-500' : 'text-green-400'}/>
                                </button>
                                <span className={`text-xs font-semibold truncate ${effect.bypass ? 'text-gray-500' : 'text-gray-200'}`}>
                                    {index + 1}. {effect.type}
                                </span>
                            </div>
                            <div className="flex items-center">
                                <button onClick={(e) => { e.stopPropagation(); handleMixerEffectRemove(activeTrack.id, effect.id);}} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Efekti kaldır">
                                    <Trash2 size={14}/>
                                </button>
                                <ArrowDownUp size={12} className="text-gray-500 ml-1 opacity-20 group-hover:opacity-50" />
                            </div>
                        </div>
                    </div>
                ))}
                <div onDragEnter={() => setDragOverIndex(activeTrack.insertEffects.length)} onDrop={() => onDrop(activeTrack.insertEffects.length)} className="h-full"/>
                {dragOverIndex === activeTrack.insertEffects.length && <div className="h-1 bg-blue-500 rounded-full my-1" />}
            </div>
            <div className="mt-auto pt-3 border-t border-[var(--color-border)]">
                <button ref={addButtonRef} onClick={handleAddButtonClick} className="mixer-insert-panel__add-btn">
                    <Plus size={14}/> Add Effect
                </button>
                {addEffectMenu?.isOpen && (
                    <AddEffectMenu 
                        x={addEffectMenu.x} 
                        y={addEffectMenu.y} 
                        onClose={() => setAddEffectMenu(null)} 
                        onSelect={handleSelectEffect}
                    />
                )}
            </div>
        </aside>
    );
};

function Mixer() {
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  const activeChannelId = useMixerStore(state => state.activeChannelId);
  const { setTrackColor, setTrackName, setTrackOutput, resetTrack } = useMixerStore.getState();
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
              const newName = prompt('Yeni isim girin:', track.name);
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
            {trackChannels.map(track => <MixerChannel key={track.id} trackId={track.id} onContextMenu={handleContextMenu}/>)}
            {busChannels.length > 0 && <div className="mixer-channel__separator" />}
            {busChannels.map(track => <MixerChannel key={track.id} trackId={track.id} onContextMenu={handleContextMenu}/>)}
            <div className="mixer-channel__separator" />
            {masterTracks.map(track => <MixerChannel key={track.id} trackId={track.id} onContextMenu={handleContextMenu}/>)}
        </div>
      </div>
      <InsertPanel activeTrack={activeTrack} />
      {contextMenu && <ChannelContextMenu x={contextMenu.x} y={contextMenu.y} options={getContextMenuOptions()} onClose={() => setContextMenu(null)} />}
    </div>
  );
}

export default Mixer;
