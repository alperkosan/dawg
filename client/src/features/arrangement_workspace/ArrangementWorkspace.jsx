/**
 * ARRANGEMENT WORKSPACE
 *
 * Advanced multi-arrangement workspace with:
 * - Tabbed arrangement system
 * - Pattern library (left panel)
 * - Audio file browser (right panel)
 * - Advanced editing tools
 * - Inspiring and creative workspace design
 */

import React, { useState, useCallback } from 'react';
import {
  Plus, Copy, Edit3, Trash2, Music,
  Search, Filter, Layout, Maximize2, Settings,
  Play, Pause, SkipBack, SkipForward, Clock
} from 'lucide-react';
import { useArrangementWorkspaceStore } from '@/store/useArrangementWorkspaceStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { ArrangementTabs } from './components/ArrangementTabs';
import { PatternLibrary } from './components/PatternLibrary';
import RenderDialog from './components/RenderDialog';
import { ArrangementCanvas } from './ArrangementCanvas';
import { ArrangementToolbar } from './components/ArrangementToolbar';
import { useAudioRenderer } from '../../hooks/useAudioRenderer';
import './ArrangementWorkspace.css';

const ArrangementWorkspace = () => {
  // Store state
  const {
    arrangements,
    activeArrangementId,
    leftPanelWidth,
    patternLibrary,
    createArrangement,
    duplicateArrangement,
    renameArrangement,
    deleteArrangement,
    setActiveArrangement,
    togglePatternLibrary,
    setPanelWidth
  } = useArrangementWorkspaceStore();

  // Additional stores
  const { patterns } = useArrangementStore();

  // Audio renderer hook
  const { renderPattern, renderTrack, isRendering } = useAudioRenderer();

  // Local state
  const [showArrangementMenu, setShowArrangementMenu] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [renderDialog, setRenderDialog] = useState({ isOpen: false, options: {} });

  // Get active arrangement
  const activeArrangement = arrangements[activeArrangementId];

  // =================== ARRANGEMENT ACTIONS ===================

  const handleCreateArrangement = useCallback(() => {
    const name = prompt('Yeni arrangement adı:');
    if (name) {
      createArrangement(name);
    }
  }, [createArrangement]);

  const handleDuplicateArrangement = useCallback((id) => {
    duplicateArrangement(id);
  }, [duplicateArrangement]);

  const handleRenameArrangement = useCallback((id) => {
    const currentName = arrangements[id]?.name;
    const newName = prompt('Yeni arrangement adı:', currentName);
    if (newName && newName !== currentName) {
      renameArrangement(id, newName);
    }
  }, [arrangements, renameArrangement]);

  const handleDeleteArrangement = useCallback((id) => {
    if (confirm('Bu arrangementi silmek istediğinizden emin misiniz?')) {
      deleteArrangement(id);
    }
  }, [deleteArrangement]);

  // =================== PANEL RESIZING ===================

  const handleLeftPanelResize = useCallback((e) => {
    if (!isResizingLeft) return;

    const newWidth = Math.max(200, Math.min(500, e.clientX));
    setPanelWidth('left', newWidth);
  }, [isResizingLeft, setPanelWidth]);


  // =================== RENDER ===================

  return (
    <div className="arrangement-workspace" onMouseMove={handleLeftPanelResize}>
      {/* Main Header */}
      <div className="arrangement-workspace__header">
        {/* Panel Toggles */}
        <div className="arrangement-workspace__panel-toggles">
          <button
            onClick={togglePatternLibrary}
            className={`arrangement-workspace__toggle arrangement-workspace__toggle--compact ${patternLibrary.isOpen ? 'active' : ''}`}
            title="Pattern Library"
          >
            <Music size={14} />
          </button>
        </div>

        {/* Arrangement Management */}
        <div className="arrangement-workspace__header-center">
          <ArrangementTabs
            arrangements={arrangements}
            activeArrangementId={activeArrangementId}
            onSelectArrangement={setActiveArrangement}
            onCreateArrangement={handleCreateArrangement}
            onDuplicateArrangement={handleDuplicateArrangement}
            onRenameArrangement={handleRenameArrangement}
            onDeleteArrangement={handleDeleteArrangement}
          />
        </div>

        {/* Workspace Info & Controls */}
        <div className="arrangement-workspace__header-right">
          <button
            className="arrangement-workspace__btn"
            onClick={() => setShowArrangementMenu(!showArrangementMenu)}
            title="Arrangement Settings"
          >
            <Settings size={16} />
          </button>

          <button
            className="arrangement-workspace__btn"
            title="Fullscreen Mode"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="arrangement-workspace__content">

        {/* Left Panel - Pattern Library */}
        {patternLibrary.isOpen && (
          <>
            <div
              className="arrangement-workspace__left-panel"
              style={{ width: leftPanelWidth }}
            >
              <PatternLibrary />
            </div>

            {/* Left Resize Handle */}
            <div
              className="arrangement-workspace__resize-handle arrangement-workspace__resize-handle--left"
              onMouseDown={() => setIsResizingLeft(true)}
              onMouseUp={() => setIsResizingLeft(false)}
            />
          </>
        )}

        {/* Center Panel - Main Arrangement Canvas */}
        <div className="arrangement-workspace__center-panel">
          <ArrangementToolbar arrangement={activeArrangement} />
          <ArrangementCanvas arrangement={activeArrangement} />
        </div>
      </div>

      {/* Arrangement Settings Menu */}
      {showArrangementMenu && activeArrangement && (
        <div className="arrangement-workspace__settings-menu">
          <div className="arrangement-workspace__settings-header">
            <h3>{activeArrangement.name} Settings</h3>
            <button onClick={() => setShowArrangementMenu(false)}>×</button>
          </div>

          <div className="arrangement-workspace__settings-content">
            <div className="arrangement-workspace__setting-group">
              <label>Tempo (BPM)</label>
              <input
                type="number"
                value={activeArrangement.tempo}
                onChange={(e) => {
                  // TODO: Update arrangement tempo
                }}
                min="60"
                max="200"
              />
            </div>

            <div className="arrangement-workspace__setting-group">
              <label>Time Signature</label>
              <select value={`${activeArrangement.timeSignature[0]}/${activeArrangement.timeSignature[1]}`}>
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="6/8">6/8</option>
                <option value="7/8">7/8</option>
              </select>
            </div>

            <div className="arrangement-workspace__setting-group">
              <label>Key</label>
              <select value={activeArrangement.metadata.key}>
                <option value="C">C Major</option>
                <option value="G">G Major</option>
                <option value="D">D Major</option>
                <option value="A">A Major</option>
                <option value="E">E Major</option>
              </select>
            </div>

            <div className="arrangement-workspace__setting-group">
              <label>Genre</label>
              <input
                type="text"
                value={activeArrangement.metadata.genre}
                placeholder="Electronic, Hip-Hop, Rock..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Render Dialog */}
      <RenderDialog
        isOpen={renderDialog.isOpen}
        onClose={() => setRenderDialog({ isOpen: false, options: {} })}
        renderOptions={renderDialog.options}
        onRender={async (settings) => {
          const { renderType, ...options } = settings;

          if (renderType === 'pattern') {
            return await renderPattern(
              renderDialog.options.patternId,
              patterns,
              options
            );
          } else if (renderType === 'track') {
            return await renderTrack(
              renderDialog.options.trackId,
              activeArrangement?.clips || [],
              patterns,
              options
            );
          }

          return { success: false, error: 'Unknown render type' };
        }}
      />

      {/* Global Mouse Event Handlers */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: isResizingLeft ? 'auto' : 'none',
          zIndex: isResizingLeft ? 9999 : -1
        }}
        onMouseUp={() => {
          setIsResizingLeft(false);
        }}
      />
    </div>
  );
};

export default ArrangementWorkspace;
