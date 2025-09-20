import React from 'react';

export const SendsPanelV2 = ({ trackId }) => {
    // Bu bileşen şimdilik bir yer tutucudur.
    // İleride buraya Send ayarları eklenebilir.
    return (
        <div className="expanded-panel">
            <h4 className="panel-title">Sends</h4>
            <div className="panel-content placeholder">
                Sends Area
            </div>
        </div>
    );
};