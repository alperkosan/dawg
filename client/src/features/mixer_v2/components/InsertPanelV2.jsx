import React from 'react';
import { useMixerStore } from '../../../store/useMixerStore';
import { Plus } from 'lucide-react';

export const InsertPanelV2 = ({ trackId }) => {
    // Sadece bu kanala ait efekt dizisine abone oluyoruz
    const insertEffects = useMixerStore(
        (state) => state.mixerTracks.find(t => t.id === trackId)?.insertEffects || []
    );

    return (
        <div className="expanded-panel insert-panel">
            <h4 className="panel-title">Inserts</h4>
            <div className="panel-content">
                <div className="insert-list">
                    {insertEffects.map((fx, index) => (
                        <div key={fx.id} className="insert-slot">
                            <span>{index + 1}. {fx.type}</span>
                        </div>
                    ))}
                </div>
                <button className="add-insert-button">
                    <Plus size={14} /> Add Effect
                </button>
            </div>
        </div>
    );
};