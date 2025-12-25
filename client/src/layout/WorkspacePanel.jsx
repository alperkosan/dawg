// src/layout/WorkspacePanel.jsx

import React, { Suspense } from 'react';
import DraggableWindow from '@/components/layout/DraggableWindow';
import FileBrowserPanel from '@/features/file_browser/FileBrowserPanel';
import CoProducerPanel from '@/features/co_producer/CoProducerPanel';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { useThemeStore } from '@/store/useThemeStore';
import { panelRegistry, panelDefinitions } from '@/config/panelConfig';
import { pluginRegistry } from '@/config/pluginConfig';
import PluginContainer from '@/components/plugins/container/PluginContainer';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { EffectService } from '@/lib/services/EffectService';

// Atmospheric effects
import MatrixRain from '@/components/effects/MatrixRain';
import CyberpunkScanlines from '@/components/effects/CyberpunkScanlines';
import OceanBubbles from '@/components/effects/OceanBubbles';
import RetroMiamiGrid from '@/components/effects/RetroMiamiGrid';
import ParticlesEffect from '@/components/effects/ParticlesEffect';

import { useFileBrowserStore } from '@/store/useFileBrowserStore';
import AudioRecordingPanel from '@/components/audio/AudioRecordingPanel';


function WorkspacePanel() {
  const {
    panels, panelStack, fullscreenPanel, pianoRollInstrumentId, editingInstrumentId,
    bringPanelToFront, togglePanel, handleMinimize, handleMaximize, updatePanelState
  } = usePanelsStore();

  const isBrowserVisible = useFileBrowserStore(state => state.isBrowserVisible);
  const isCoProducerOpen = usePanelsStore(state => state.isCoProducerOpen);
  const [sidebarWidth, setSidebarWidth] = React.useState(280);
  const [rightSidebarWidth, setRightSidebarWidth] = React.useState(300);
  const [isResizing, setIsResizing] = React.useState(false);
  const [isResizingRight, setIsResizingRight] = React.useState(false);
  const [isAudioRecordingOpen, setIsAudioRecordingOpen] = React.useState(false);

  // Keyboard shortcut for audio recording (Ctrl+Shift+R)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setIsAudioRecordingOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Right Sidebar Resizing
  const handleMouseDownRight = (e) => {
    e.preventDefault();
    setIsResizingRight(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  React.useEffect(() => {
    if (!isResizingRight) return;

    const handleMouseMove = (e) => {
      const newWidth = Math.max(250, Math.min(500, window.innerWidth - e.clientX));
      setRightSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingRight]);

  const instruments = useInstrumentsStore(state => state.instruments);
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  const { handleMixerEffectChange } = useMixerStore.getState();
  const pianoRollInstrument = instruments.find(i => i.id === pianoRollInstrumentId);
  const editingInstrument = instruments.find(i => i.id === editingInstrumentId);

  // Get active theme for atmospheric effects
  const activeTheme = useThemeStore(state => {
    const { themes, activeThemeId } = state;
    return themes.find(t => t.id === activeThemeId);
  });
  const themeName = activeTheme?.name || '';

  const baseZIndex = 10;

  // Mobile detection
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render appropriate effect based on theme
  const renderThemeEffect = () => {
    switch (themeName) {
      case 'Matrix Code':
        return <MatrixRain opacity={0.15} fontSize={14} speed={0.4} />;

      case 'Cyberpunk Neon':
        return <CyberpunkScanlines opacity={0.15} speed={0.8} />;

      case 'Ocean Deep':
        return <OceanBubbles opacity={0.18} count={12} />;

      case 'Retro Miami':
        return <RetroMiamiGrid opacity={0.12} speed={0.5} />;

      case '8-Bit Night':
        return (
          <ParticlesEffect
            type="stars"
            count={40}
            color="#4ade80"
            opacity={0.2}
            speed={0.3}
            size={{ min: 1, max: 2 }}
          />
        );

      case 'Midnight Purple':
        return (
          <ParticlesEffect
            type="stars"
            count={60}
            color="#C77DFF"
            secondaryColor="#9D4EDD"
            opacity={0.25}
            speed={0.2}
            size={{ min: 1, max: 3 }}
          />
        );

      case 'Arctic Minimal':
        return (
          <ParticlesEffect
            type="snow"
            count={30}
            color="#E0F7FF"
            opacity={0.15}
            speed={0.6}
            size={{ min: 2, max: 4 }}
          />
        );

      case 'Lavender Dreams':
        return (
          <ParticlesEffect
            type="petals"
            count={20}
            color="#E6B8FF"
            secondaryColor="#D4A5FF"
            opacity={0.2}
            speed={0.4}
            size={{ min: 2, max: 5 }}
          />
        );

      case 'Anime Vibes':
        return (
          <ParticlesEffect
            type="petals"
            count={25}
            color="#FF1744"
            secondaryColor="#E040FB"
            opacity={0.18}
            speed={0.5}
            size={{ min: 2, max: 4 }}
          />
        );

      case 'Forest Twilight':
        return (
          <ParticlesEffect
            type="fireflies"
            count={15}
            color="#32CD32"
            opacity={0.3}
            speed={0.25}
            size={{ min: 1.5, max: 3 }}
          />
        );

      case 'Sunset Vibes':
        return (
          <ParticlesEffect
            type="sparkles"
            count={20}
            color="#FF6B35"
            secondaryColor="#F7931E"
            opacity={0.15}
            speed={0.3}
            size={{ min: 1, max: 2 }}
          />
        );

      case 'Desert Heat':
        return (
          <ParticlesEffect
            type="sparkles"
            count={15}
            color="#FFB627"
            opacity={0.12}
            speed={0.2}
            size={{ min: 1, max: 2 }}
          />
        );

      default:
        return null; // No effect for other themes
    }
  };

  return (
    // 'workspace' sınıfı artık display: flex kullanıyor.
    <div className="workspace">
      {isBrowserVisible && (
        <>
          {/* Mobile Backdrop */}
          {isMobile && (
            <div
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }}
              onClick={() => useFileBrowserStore.getState().setBrowserVisible(false)}
            />
          )}
          <div style={{
            width: isMobile ? '80%' : sidebarWidth,
            maxWidth: isMobile ? '300px' : 'none',
            position: isMobile ? 'absolute' : 'relative',
            flexShrink: 0,
            height: '100%',
            zIndex: isMobile ? 200 : 'auto',
            background: 'var(--zenith-bg-secondary)',
            boxShadow: isMobile ? '4px 0 12px rgba(0,0,0,0.5)' : 'none'
          }}>
            <FileBrowserPanel />
            {!isMobile && (
              <div
                onMouseDown={handleMouseDown}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: -4,
                  width: 8,
                  height: '100%',
                  cursor: 'col-resize',
                  zIndex: 100,
                  // Visual indicator on hover/drag
                  background: isResizing ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}
                className="hover:bg-white/5 transition-colors"
              />
            )}
          </div>
        </>
      )}
      {/* 'workspace__main-content' flex-grow: 1 ile geri kalan alanı kaplayacak */}
      <div className="workspace__main-content">
        {/* Atmospheric effects based on active theme */}
        {renderThemeEffect()}
        {Object.values(panels).map(panel => {
          // ✅ MOBILE: Force maximize if on mobile
          const isMaximized = isMobile ? true : (fullscreenPanel === panel.id);

          if (fullscreenPanel && fullscreenPanel !== panel.id && !isMobile) return null;
          if (!panel.isOpen || panel.isMinimized) return null;

          // Mobile: Only show the "topmost" or specifically active panel if multiple are open?
          // For now, we rely on z-index or maybe we should only render the last touched one?
          // Let's stick to DraggableWindow but forced to full size.

          let PanelContent;
          let panelDef = panelDefinitions[panel.id];
          const componentProps = { key: panel.id };
          const isPanelVisible = panel.isOpen && !panel.isMinimized && (!fullscreenPanel || fullscreenPanel === panel.id);
          componentProps.isVisible = isPanelVisible;

          if (panel.type === 'plugin') {
            const track = mixerTracks.find(t => t.id === panel.trackId);
            const effect = track?.insertEffects?.find(fx => fx.id === panel.effectId) || track?.effects?.find(fx => fx.id === panel.effectId);

            if (!track || !effect) {
              // Auto-close the orphaned panel
              setTimeout(() => togglePanel(panel.id), 100);
              return null;
            }

            const definition = pluginRegistry[effect.type];
            const PluginUIComponent = definition?.uiComponent;

            if (!PluginUIComponent) {
              console.warn('⚠️ Plugin UI component not found for:', effect.type);
              return <div>Plugin UI for {effect.type} not found.</div>;
            }

            const handlePluginChange = (param, value) => {
              handleMixerEffectChange(track.id, effect.id, param, value);
            };

            panelDef = {
              minSize: definition.minSize || { width: 350, height: 200 },
              initialSize: definition.initialSize || { width: 450, height: 300 }
            };

            // Get the effect node for visualization
            const effectNode = EffectService.getEffectNode(track.id, effect.id);

            // Check if plugin uses v2.0 (has its own PluginContainerV2)
            const usesV2Container = ['MultiBandEQ', 'ModernDelay', 'OTT', 'ModernReverb', 'Compressor', 'Saturator', 'TidalFilter', 'StardustChorus', 'VortexPhaser', 'OrbitPanner', 'ArcadeCrusher', 'PitchShifter', 'BassEnhancer808', 'TransientDesigner', 'HalfTime', 'Limiter', 'Clipper', 'RhythmFX', 'Maximizer', 'Imager'].includes(effect.type);

            PanelContent = usesV2Container ? (
              // v2.0: Plugin has its own container
              <Suspense fallback={<div className="p-4">Loading UI...</div>}>
                <PluginUIComponent
                  trackId={track.id}
                  effect={effect}
                  effectNode={effectNode}
                  onChange={handlePluginChange}
                  definition={definition}
                />
              </Suspense>
            ) : (
              // v1.0: Wrap with PluginContainer
              <PluginContainer trackId={track.id} effect={effect} definition={definition}>
                <Suspense fallback={<div className="p-4">Loading UI...</div>}>
                  <PluginUIComponent
                    trackId={track.id}
                    effect={effect}
                    effectNode={effectNode}
                    onChange={handlePluginChange}
                    definition={definition}
                  />
                </Suspense>
              </PluginContainer>
            );

          } else {
            const PanelComponent = panelRegistry[panel.id];
            if (!panelDef || !PanelComponent) return null;

            // Sample Editor: Pass editingInstrument (can be null for audio clip mode)
            if (panel.id === 'sample-editor') {
              componentProps.instrument = editingInstrument;
            }

            if (panel.id === 'piano-roll') {
              componentProps.instrument = pianoRollInstrument;
            }

            if (panel.id === 'instrument-editor-forgesynth') {
              componentProps.instrument = editingInstrument;
            }

            PanelContent = <PanelComponent {...componentProps} />;
          }

          return (
            <DraggableWindow
              key={panel.id}
              id={panel.id}
              title={panel.title}
              position={isMobile ? { x: 0, y: 0 } : panel.position}
              zIndex={baseZIndex + panelStack.indexOf(panel.id)}
              onPositionChange={(newPos) => !isMobile && updatePanelState(panel.id, { position: newPos })}
              onSizeChange={(newSize) => !isMobile && updatePanelState(panel.id, { size: newSize })}
              onFocus={() => bringPanelToFront(panel.id)}
              onClose={() => togglePanel(panel.id)}
              onMinimize={() => handleMinimize(panel.id, panel.title)}
              onMaximize={() => handleMaximize(panel.id)}
              isMaximized={isMaximized}
              size={isMaximized ? { width: '100%', height: '100%' } : (panel.size || panelDef.initialSize)}
              minSize={panelDef?.minSize}
              onContextMenu={(e) => e.preventDefault()}
              // ✅ MOBILE: Disable dragging on mobile
              draggable={!isMobile}
              resizable={!isMobile}
            >
              {PanelContent}
            </DraggableWindow>
          );
        })}
      </div>

      {isCoProducerOpen && (
        <>
          {/* Mobile Backdrop for CoProducer */}
          {isMobile && (
            <div
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }}
              onClick={() => usePanelsStore.getState().toggleCoProducer()}
            />
          )}
          <div style={{
            width: isMobile ? '85%' : rightSidebarWidth,
            maxWidth: isMobile ? '350px' : 'none',
            position: isMobile ? 'absolute' : 'relative',
            right: isMobile ? 0 : 'auto',
            flexShrink: 0,
            height: '100%',
            zIndex: isMobile ? 200 : 'auto',
            background: 'var(--zenith-bg-secondary)',
            boxShadow: isMobile ? '-4px 0 12px rgba(0,0,0,0.5)' : 'none'
          }}>
            {!isMobile && (
              <div
                onMouseDown={handleMouseDownRight}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: -4,
                  width: 8,
                  height: '100%',
                  cursor: 'col-resize',
                  zIndex: 100,
                  background: isResizingRight ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}
                className="hover:bg-white/5 transition-colors"
              />
            )}
            <CoProducerPanel />
          </div>
        </>
      )}

      {/* Audio Recording Panel */}
      {isAudioRecordingOpen && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          zIndex: 1000
        }}>
          <AudioRecordingPanel
            isOpen={isAudioRecordingOpen}
            onClose={() => setIsAudioRecordingOpen(false)}
          />
        </div>
      )}
    </div>

  );
}

export default WorkspacePanel;