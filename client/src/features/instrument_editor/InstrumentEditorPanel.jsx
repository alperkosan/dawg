/**
 * Instrument Editor Panel
 * Main container for instrument editing UI
 * Dynamically loads editor based on instrument type
 * Features: Resizable panel, theme integration, keyboard shortcuts
 */

import { useEffect, useState, useRef } from 'react';
import useInstrumentEditorStore from '../../store/useInstrumentEditorStore';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import VASynthEditor from './components/editors/VASynthEditor';
import VASynthEditorV2 from './components/editors/VASynthEditorV2';
import MultiSampleEditor from './components/editors/MultiSampleEditor';
import DrumSamplerEditor from './components/editors/DrumSamplerEditor';
import { ForgeSynthUI } from './ForgeSynthUI';
import PresetBrowser from './components/PresetBrowser';
import InstrumentEffectsPanel from './components/InstrumentEffectsPanel';
import ModulationMatrix from './components/ModulationMatrix';
import AutomationSettingsPanel from '../piano_roll_v7/components/AutomationSettingsPanel';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import './InstrumentEditorPanel.css';

const InstrumentEditorPanel = () => {
  const {
    isOpen,
    instrumentId,
    instrumentData,
    activeTab,
    isDirty,
    closeEditor,
    setActiveTab,
    save,
    revert,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useInstrumentEditorStore();

  const getInstrument = useInstrumentsStore((state) => state.getInstrument);
  const updateInstrument = useInstrumentsStore((state) => state.updateInstrument);

  // Get mixer tracks for routing selector
  const mixerTracks = useMixerStore(state => state.mixerTracks);

  // Get active pattern for automation lanes
  const activePatternId = useArrangementStore(state => state.activePatternId);

  // ✅ RESIZABLE PANEL STATE
  const [panelWidth, setPanelWidth] = useState(() => {
    // Load from localStorage or use default
    const saved = localStorage.getItem('instrumentEditorPanelWidth');
    return saved ? parseInt(saved, 10) : 500;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);
  const MIN_WIDTH = 500;
  const MAX_WIDTH = 800;

  // ✅ PARAMETER SEARCH STATE
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  // ✅ COPY/PASTE STATE
  const [copiedParams, setCopiedParams] = useState(null);
  const [showCopyNotification, setShowCopyNotification] = useState(false);

  // ✅ A/B COMPARISON STATE
  const [slotA, setSlotA] = useState(null);
  const [slotB, setSlotB] = useState(null);
  const [activeSlot, setActiveSlot] = useState('A'); // 'A' or 'B'
  const [showABPanel, setShowABPanel] = useState(false);

  // ✅ CONFIRMATION MODAL STATE
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    onConfirm: null,
  });

  // ✅ RESIZE HANDLERS
  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Save to localStorage
      localStorage.setItem('instrumentEditorPanelWidth', panelWidth.toString());
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, panelWidth]);

  // Handle mixer channel change
  const handleMixerChannelChange = (newChannelId) => {
    if (!instrumentId) return;

    // Update instrument's mixerTrackId in store
    updateInstrument(instrumentId, { mixerTrackId: newChannelId });

    // Update editor state (use updateParameter instead of updateField)
    useInstrumentEditorStore.getState().updateParameter('mixerTrackId', newChannelId);
  };

  // Update instrument data when instrument changes
  useEffect(() => {
    if (instrumentId && !instrumentData) {
      const instrument = getInstrument(instrumentId);
      if (instrument) {
        useInstrumentEditorStore.getState().openEditor(instrumentId, instrument);
      }
    }
  }, [instrumentId, instrumentData, getInstrument]);

  // ✅ RANDOMIZE HANDLER
  const handleRandomize = () => {
    setConfirmationModal({
      isOpen: true,
      title: 'Randomize Parameters',
      message: 'Randomize all parameters? This will change all current values.',
      confirmText: 'Randomize',
      cancelText: 'Cancel',
      variant: 'warning',
      onConfirm: () => {
        setConfirmationModal({ ...confirmationModal, isOpen: false });
        
        // Define randomization rules for different parameter types
        const randomizeParameter = (key, value) => {
      // Skip certain parameters
      if (['id', 'name', 'type', 'mixerTrackId', 'presetName'].includes(key)) {
        return value;
      }

      // Number randomization
      if (typeof value === 'number') {
        // Detect parameter range from current value or use defaults
        if (key.includes('gain') || key.includes('volume')) {
          return Math.random() * 1.0; // 0 to 1
        }
        if (key.includes('frequency') || key.includes('cutoff')) {
          return Math.random() * 10000 + 20; // 20Hz to 10kHz
        }
        if (key.includes('detune') || key.includes('pitch')) {
          return Math.random() * 24 - 12; // -12 to +12
        }
        if (key.includes('pan')) {
          return Math.random() * 2 - 1; // -1 to 1
        }
        if (key.includes('resonance') || key.includes('q')) {
          return Math.random() * 30 + 0.1; // 0.1 to 30
        }
        // Default: randomize in a reasonable range
        if (value >= 0 && value <= 1) {
          return Math.random(); // 0 to 1
        }
        return Math.random() * 100; // 0 to 100
      }

      // Boolean randomization
      if (typeof value === 'boolean') {
        return Math.random() > 0.5;
      }

      // Keep other types unchanged (strings, objects, arrays)
      return value;
    };

    // Apply randomization
    const randomized = {};
    Object.entries(instrumentData).forEach(([key, value]) => {
      randomized[key] = randomizeParameter(key, value);
    });

        // Update all randomized parameters
        Object.entries(randomized).forEach(([key, value]) => {
          if (value !== instrumentData[key] && !['id', 'name', 'type', 'mixerTrackId'].includes(key)) {
            updateParameter(key, value);
          }
        });

        console.log('🎲 Parameters randomized');
      },
    });
  };

  // ✅ INIT/RESET HANDLER
  const handleReset = () => {
    setConfirmationModal({
      isOpen: true,
      title: 'Reset Parameters',
      message: 'Reset all parameters to defaults? This will lose all current changes.',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      variant: 'warning',
      onConfirm: () => {
        setConfirmationModal({ ...confirmationModal, isOpen: false });
        
        // Get default values based on instrument type
        const getDefaults = () => {
      const baseDefaults = {
        gain: 0.7,
        pan: 0,
      };

      if (instrumentData.type === 'vasynth') {
        return {
          ...baseDefaults,
          oscillatorType: 'sine',
          attack: 0.01,
          decay: 0.1,
          sustain: 0.7,
          release: 0.3,
        };
      }

      if (instrumentData.type === 'sample') {
        return {
          ...baseDefaults,
          pitch: 0,
          reverse: false,
          loop: false,
        };
      }

      return baseDefaults;
    };

        const defaults = getDefaults();

        // Apply defaults
        Object.entries(defaults).forEach(([key, value]) => {
          updateParameter(key, value);
        });

        console.log('🔄 Parameters reset to defaults');
      },
    });
  };

  // ✅ A/B COMPARISON HANDLERS
  const handleSaveToSlot = (slot) => {
    const params = { ...instrumentData };
    delete params.id;
    delete params.name;
    delete params.mixerTrackId;

    const snapshot = {
      params,
      timestamp: Date.now(),
    };

    if (slot === 'A') {
      setSlotA(snapshot);
      console.log('💾 Saved to Slot A');
    } else {
      setSlotB(snapshot);
      console.log('💾 Saved to Slot B');
    }
  };

  const handleLoadSlot = (slot) => {
    const snapshot = slot === 'A' ? slotA : slotB;
    if (!snapshot) {
      console.warn(`Slot ${slot} is empty`);
      return;
    }

    // Apply all parameters
    Object.entries(snapshot.params).forEach(([key, value]) => {
      updateParameter(key, value);
    });

    setActiveSlot(slot);
    console.log(`📥 Loaded Slot ${slot}`);
  };

  const handleToggleAB = () => {
    const targetSlot = activeSlot === 'A' ? 'B' : 'A';
    handleLoadSlot(targetSlot);
  };

  const handleClearSlot = (slot) => {
    if (slot === 'A') {
      setSlotA(null);
    } else {
      setSlotB(null);
    }
    console.log(`🗑️ Cleared Slot ${slot}`);
  };

  // ✅ COPY/PASTE HANDLERS
  const handleCopyParameters = () => {
    // Copy all current parameters (excluding id, name, mixerTrackId)
    const paramsToCopy = { ...instrumentData };
    delete paramsToCopy.id;
    delete paramsToCopy.name;
    delete paramsToCopy.mixerTrackId;

    setCopiedParams({
      type: instrumentData.type,
      timestamp: Date.now(),
      params: paramsToCopy
    });

    // Show notification
    setShowCopyNotification(true);
    setTimeout(() => setShowCopyNotification(false), 2000);

    console.log('📋 Parameters copied:', Object.keys(paramsToCopy).length, 'properties');
  };

  const handlePasteParameters = () => {
    if (!copiedParams) {
      console.warn('No parameters in clipboard');
      return;
    }

    // Check type compatibility
    if (copiedParams.type !== instrumentData.type) {
      setConfirmationModal({
        isOpen: true,
        title: 'Type Mismatch',
        message: `Parameters were copied from a ${copiedParams.type} instrument.\nCurrent instrument is ${instrumentData.type}.\n\nPaste anyway? (Some parameters may not be compatible)`,
        confirmText: 'Paste Anyway',
        cancelText: 'Cancel',
        variant: 'warning',
        onConfirm: () => {
          setConfirmationModal({ ...confirmationModal, isOpen: false });
          // Continue with paste logic below
          pasteParameters();
        },
      });
      return;
    }
    
    pasteParameters();
  };
  
  const pasteParameters = () => {

    // Apply all copied parameters
    Object.entries(copiedParams.params).forEach(([key, value]) => {
      updateParameter(key, value);
    });

    console.log('📋 Parameters pasted:', Object.keys(copiedParams.params).length, 'properties');
  };

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Ignore if typing in an input field (except our search)
      const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      const isSearchInput = e.target === searchInputRef.current;

      // ESC to close (or close search if open)
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
        } else {
          closeEditor();
        }
      }

      // Ctrl+F to toggle search
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }

      // Ctrl+T to toggle A/B
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        if (slotA && slotB) {
          handleToggleAB();
        }
      }

      // Ctrl+C to copy parameters (only if not typing in other inputs)
      if (e.ctrlKey && e.key === 'c' && (!isTyping || isSearchInput)) {
        if (!isSearchInput || !searchQuery) {
          e.preventDefault();
          handleCopyParameters();
        }
      }

      // Ctrl+V to paste parameters (only if not typing in other inputs)
      if (e.ctrlKey && e.key === 'v' && (!isTyping || isSearchInput)) {
        if (!isSearchInput || !searchQuery) {
          e.preventDefault();
          handlePasteParameters();
        }
      }

      // Ctrl+Z to undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
      }

      // Ctrl+Shift+Z or Ctrl+Y to redo
      if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
      }

      // Ctrl+S to save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        save();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showSearch, searchQuery, copiedParams, closeEditor, canUndo, canRedo, undo, redo, save, handleCopyParameters, handlePasteParameters]);

  if (!isOpen || !instrumentData) {
    return null;
  }

  // Determine editor type
  const getEditorComponent = () => {
    const { type, multiSamples } = instrumentData;

    if (type === 'vasynth') {
      // ✅ NEW: FL Studio style canvas-based editor
      return <VASynthEditorV2 instrumentData={instrumentData} />;
    }

    if (type === 'sample') {
      if (multiSamples && multiSamples.length > 0) {
        return <MultiSampleEditor instrumentData={instrumentData} />;
      } else {
        return <DrumSamplerEditor instrumentData={instrumentData} />;
      }
    }

    if (type === 'synth') {
      return <ForgeSynthUI instrument={instrumentData} />;
    }

    return (
      <div className="editor-placeholder">
        <div className="editor-placeholder__icon">❓</div>
        <div className="editor-placeholder__text">Unknown instrument type: {type}</div>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`instrument-editor__backdrop ${isOpen ? 'instrument-editor__backdrop--open' : ''}`}
        onClick={closeEditor}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`instrument-editor-panel ${isOpen ? 'instrument-editor-panel--open' : ''} ${isResizing ? 'instrument-editor-panel--resizing' : ''}`}
        style={{ width: `${panelWidth}px` }}
      >
        {/* Resize Handle */}
        <div
          className="instrument-editor-panel__resize-handle"
          onMouseDown={handleResizeStart}
        />

        {/* Copy Notification */}
        {showCopyNotification && (
          <div className="instrument-editor-panel__notification">
            <span className="instrument-editor-panel__notification-icon">📋</span>
            Parameters copied! Press Ctrl+V to paste
          </div>
        )}

        {/* Search Bar (when active) */}
        {showSearch && (
          <div className="instrument-editor-panel__search-bar">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search parameters... (ESC to close)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="instrument-editor-panel__search-input"
            />
            {searchQuery && (
              <span className="instrument-editor-panel__search-info">
                Press Enter to highlight next match
              </span>
            )}
          </div>
        )}

        {/* Header */}
        <div className="instrument-editor-panel__header">
          <div className="instrument-editor-panel__title">
            <div className="instrument-editor-panel__icon">
              {instrumentData.type === 'vasynth' && '🎹'}
              {instrumentData.type === 'sample' && (instrumentData.multiSamples ? '🎵' : '🥁')}
              {instrumentData.type === 'synth' && '🎛️'}
            </div>
            <div className="instrument-editor-panel__name">
              <div className="instrument-editor-panel__name-primary">{instrumentData.name}</div>
              <div className="instrument-editor-panel__name-secondary">
                {/* Mixer Channel Selector */}
                <select
                  className="instrument-editor-panel__mixer-select"
                  value={instrumentData.mixerTrackId || 'master'}
                  onChange={(e) => handleMixerChannelChange(e.target.value)}
                  title="Select mixer channel"
                >
                  {mixerTracks
                    .filter(track => track.type === 'track' || track.type === 'bus' || track.type === 'master')
                    .map(track => (
                      <option key={track.id} value={track.id}>
                        {track.type === 'master' ? '🎛️' : track.type === 'bus' ? '🔀' : '🎚️'} {track.name}
                      </option>
                    ))}
                </select>
                {isDirty && <span className="instrument-editor-panel__dirty"> • Modified</span>}
              </div>
            </div>
          </div>

          <div className="instrument-editor-panel__actions">
            {/* Randomize */}
            <button
              className="instrument-editor-panel__action"
              onClick={handleRandomize}
              title="Randomize parameters"
            >
              🎲
            </button>

            {/* Reset */}
            <button
              className="instrument-editor-panel__action"
              onClick={handleReset}
              title="Reset to defaults"
            >
              🔄
            </button>

            {/* A/B Toggle */}
            <button
              className="instrument-editor-panel__action"
              onClick={() => setShowABPanel(prev => !prev)}
              title="A/B Comparison"
              style={{
                background: showABPanel ? 'var(--zenith-accent-cool, #6B8EBF)' : undefined,
                color: showABPanel ? 'white' : undefined,
              }}
            >
              A/B
            </button>

            {/* Undo/Redo */}
            <button
              className="instrument-editor-panel__action"
              onClick={undo}
              disabled={!canUndo()}
              title="Undo (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              className="instrument-editor-panel__action"
              onClick={redo}
              disabled={!canRedo()}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↷
            </button>

            {/* Save/Revert */}
            {isDirty && (
              <>
                <button
                  className="instrument-editor-panel__action instrument-editor-panel__action--primary"
                  onClick={save}
                  title="Save (Ctrl+S)"
                >
                  💾
                </button>
                <button
                  className="instrument-editor-panel__action"
                  onClick={revert}
                  title="Revert changes"
                >
                  ⟲
                </button>
              </>
            )}

            {/* Close */}
            <button
              className="instrument-editor-panel__action instrument-editor-panel__close"
              onClick={closeEditor}
              title="Close (ESC)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="instrument-editor-panel__tabs">
          <button
            className={`instrument-editor-panel__tab ${activeTab === 'main' ? 'instrument-editor-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Main
          </button>
          <button
            className={`instrument-editor-panel__tab ${activeTab === 'presets' ? 'instrument-editor-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            Presets
          </button>
          <button
            className={`instrument-editor-panel__tab ${activeTab === 'effects' ? 'instrument-editor-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('effects')}
          >
            Effects
          </button>
          <button
            className={`instrument-editor-panel__tab ${activeTab === 'automation' ? 'instrument-editor-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('automation')}
          >
            Automation
          </button>
          <button
            className={`instrument-editor-panel__tab ${activeTab === 'modulation' ? 'instrument-editor-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('modulation')}
          >
            Modulation
          </button>
        </div>

        {/* A/B Comparison Panel */}
        {showABPanel && (
          <div className="ab-panel">
            <div className="ab-panel__slot">
              <div className="ab-panel__slot-header">
                <span className={`ab-panel__slot-badge ${activeSlot === 'A' ? 'ab-panel__slot-badge--active' : ''}`}>
                  A
                </span>
                <span className="ab-panel__slot-status">
                  {slotA ? '✓ Saved' : 'Empty'}
                </span>
              </div>
              <div className="ab-panel__slot-actions">
                <button
                  className="ab-panel__btn ab-panel__btn--save"
                  onClick={() => handleSaveToSlot('A')}
                  title="Save current state to Slot A"
                >
                  💾 Save
                </button>
                <button
                  className="ab-panel__btn ab-panel__btn--load"
                  onClick={() => handleLoadSlot('A')}
                  disabled={!slotA}
                  title="Load Slot A"
                >
                  📥 Load
                </button>
                <button
                  className="ab-panel__btn ab-panel__btn--clear"
                  onClick={() => handleClearSlot('A')}
                  disabled={!slotA}
                  title="Clear Slot A"
                >
                  🗑️
                </button>
              </div>
            </div>

            <button
              className="ab-panel__toggle"
              onClick={handleToggleAB}
              disabled={!slotA || !slotB}
              title="Toggle between A and B (Ctrl+T)"
            >
              ⇄
            </button>

            <div className="ab-panel__slot">
              <div className="ab-panel__slot-header">
                <span className={`ab-panel__slot-badge ${activeSlot === 'B' ? 'ab-panel__slot-badge--active' : ''}`}>
                  B
                </span>
                <span className="ab-panel__slot-status">
                  {slotB ? '✓ Saved' : 'Empty'}
                </span>
              </div>
              <div className="ab-panel__slot-actions">
                <button
                  className="ab-panel__btn ab-panel__btn--save"
                  onClick={() => handleSaveToSlot('B')}
                  title="Save current state to Slot B"
                >
                  💾 Save
                </button>
                <button
                  className="ab-panel__btn ab-panel__btn--load"
                  onClick={() => handleLoadSlot('B')}
                  disabled={!slotB}
                  title="Load Slot B"
                >
                  📥 Load
                </button>
                <button
                  className="ab-panel__btn ab-panel__btn--clear"
                  onClick={() => handleClearSlot('B')}
                  disabled={!slotB}
                  title="Clear Slot B"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="instrument-editor-panel__content">
          {activeTab === 'main' && getEditorComponent()}
          {activeTab === 'presets' && <PresetBrowser instrumentData={instrumentData} />}
          {activeTab === 'effects' && <InstrumentEffectsPanel instrumentData={instrumentData} />}
          {activeTab === 'automation' && activePatternId && <AutomationSettingsPanel patternId={activePatternId} instrumentId={instrumentId} />}
          {activeTab === 'modulation' && <ModulationMatrix instrumentData={instrumentData} />}
        </div>

        {/* Footer */}
        <div className="instrument-editor-panel__footer">
          <div className="instrument-editor-panel__footer-info">
            Type: <span>{instrumentData.type}</span>
            {instrumentData.presetName && (
              <> | Preset: <span>{instrumentData.presetName}</span></>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        confirmText={confirmationModal.confirmText}
        cancelText={confirmationModal.cancelText}
        variant={confirmationModal.variant}
        onConfirm={confirmationModal.onConfirm}
        onCancel={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
      />
    </>
  );
};

export default InstrumentEditorPanel;
