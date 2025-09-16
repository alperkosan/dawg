import React from 'react';
import DraggableWindow from '../ui/DraggableWindow';
import FileBrowserPanel from '../features/file_browser/FileBrowserPanel';

// Gerekli tüm store'ları import ediyoruz
import { usePanelsStore } from '../store/usePanelsStore';
import { useInstrumentsStore } from '../store/useInstrumentsStore';
import { useArrangementStore } from '../store/useArrangementStore';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { panelRegistry, panelDefinitions } from '../config/panelConfig';

function WorkspacePanel({ audioEngineRef }) {
  // --- Panellerin genel durumunu yöneten store ---
  const {
    panels, panelStack, fullscreenPanel, pianoRollInstrumentId, editingInstrumentId,
    bringPanelToFront, togglePanel, handleMinimize, handleMaximize, updatePanelState
  } = usePanelsStore();

  const instruments = useInstrumentsStore(state => state.instruments);

  // --- ANAHTAR DÜZELTME BURADA ---
  // Piano Roll için seçili olan tam enstrüman nesnesini ID'sini kullanarak buluyoruz.
  const pianoRollInstrument = instruments.find(i => i.id === pianoRollInstrumentId);
  const editingInstrument = instruments.find(i => i.id === editingInstrumentId);

  // --- YENİ: Piano Roll için gerekli verileri ilgili store'lardan çekiyoruz ---
  const { patterns, activePatternId, updatePatternNotes } = useArrangementStore();
  const { playbackState, transportPosition } = usePlaybackStore();

  // Aktif pattern verisini alıyoruz
  const activePattern = patterns[activePatternId];

  const baseZIndex = 10;

  return (
    <div className="w-full h-full bg-gray-900 relative overflow-hidden flex">
      <FileBrowserPanel />
      <div className="flex-grow relative">
        {Object.values(panels).map(panel => {
          if (fullscreenPanel && fullscreenPanel !== panel.id) return null;
          if (!panel.isOpen || panel.isMinimized) return null;

          const definition = panelDefinitions[panel.id];
          const PanelComponent = panelRegistry[panel.id];

          if (!definition || !PanelComponent) return null;
          
          // YENİ: Her panel için props'ları burada dinamik olarak belirliyoruz
          const componentProps = {};

          if (panel.id === 'sample-editor') {
            componentProps.instrument = editingInstrument;
            componentProps.audioEngineRef = audioEngineRef;
          }

          if (panel.id === 'piano-roll') {
            // ✅ DÜZELTME: Props'ları doğru formatta hazırlıyoruz

            componentProps.instrument = pianoRollInstrument;
            componentProps.audioEngineRef = audioEngineRef;

            // Aktif pattern'in bu enstrümana ait notalarını alıyoruz
            const instrumentNotes = activePattern?.data[pianoRollInstrumentId] || [];

            componentProps.pattern = {
              id: activePattern?.id || 'default',
              name: activePattern?.name || 'Pattern 1',
              notes: instrumentNotes
            };

            // Notalar değiştiğinde ana state'i güncelleyecek fonksiyon
            /*componentProps.onPatternChange = (newPatternData) => {
              if (pianoRollInstrumentId && newPatternData.notes) {
                updatePatternNotes(pianoRollInstrumentId, newPatternData.notes);
              }
            };*/

            // Playback state'i doğru formatta gönderiyoruz
            componentProps.playbackState = {
              isPlaying: playbackState === 'playing',
              position: transportPosition || 0,
            };
          }

          if (panel.id === 'channel-rack' || panel.id === 'mixer' || panel.id === 'arrangement' || panel.id === 'piano-roll') {
            componentProps.audioEngineRef = audioEngineRef;
          }

          return (
            <DraggableWindow
              key={panel.id}
              id={panel.id}
              title={panel.title}
              position={panel.position}
              size={panel.size}
              minSize={definition.minSize}
              disableResizing={definition.disableResizing}
              zIndex={baseZIndex + panelStack.indexOf(panel.id)}
              onPositionChange={(newPos) => updatePanelState(panel.id, { position: newPos })}
              onSizeChange={(newSize) => updatePanelState(panel.id, { size: newSize })}
              onFocus={() => bringPanelToFront(panel.id)}
              onClose={() => togglePanel(panel.id)}
              onMinimize={() => handleMinimize(panel.id, definition.title)}
              onMaximize={() => handleMaximize(panel.id)}
              isMaximized={fullscreenPanel === panel.id}
            >
              <PanelComponent {...componentProps} />
            </DraggableWindow>
          );
        })}
      </div>
    </div>
  );
}

export default WorkspacePanel;