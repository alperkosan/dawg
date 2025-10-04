/**
 * ARRANGEMENT TOOLBAR
 *
 * Arrangement manipulation tools only:
 * - Edit modes (select, draw, split)
 * - Snap settings
 * - Zoom controls
 * - Grid settings
 */

import React from 'react';
import {
  Grid, MousePointer, Scissors
} from 'lucide-react';
import { useArrangementWorkspaceStore } from '../../../store/useArrangementWorkspaceStore';

const ArrangementToolbar = ({ arrangement }) => {
  // Store state
  const {
    snapMode,
    gridSize,
    editMode,
    setSnapMode,
    setGridSize,
    setEditMode
  } = useArrangementWorkspaceStore();

  const editModes = [
    { id: 'select', icon: <MousePointer size={16} />, title: 'Select Tool (V)' },
    { id: 'draw', icon: <Grid size={16} />, title: 'Draw Tool (B)' },
    { id: 'split', icon: <Scissors size={16} />, title: 'Split Tool (C)' }
  ];

  const snapModes = [
    { id: 'off', label: 'Off', title: 'No snapping' },
    { id: 'grid', label: 'Grid', title: 'Snap to grid' },
    { id: 'events', label: 'Events', title: 'Snap to events' }
  ];

  const gridSizes = [
    { id: '1/1', label: '1/1' },
    { id: '1/2', label: '1/2' },
    { id: '1/4', label: '1/4' },
    { id: '1/8', label: '1/8' },
    { id: '1/16', label: '1/16' },
    { id: '1/32', label: '1/32' }
  ];

  // =================== RENDER ===================

  return (
    <div className="arrangement-toolbar">
      {/* Edit Tools */}
      <div className="arrangement-toolbar__section">
        <div className="arrangement-toolbar__tool-buttons">
          {editModes.map(mode => (
            <button
              key={mode.id}
              className={`arrangement-toolbar__btn ${
                editMode === mode.id ? 'active' : ''
              }`}
              onClick={() => setEditMode(mode.id)}
              title={mode.title}
            >
              {mode.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Snap & Grid Controls Combined */}
      <div className="arrangement-toolbar__section arrangement-toolbar__section--controls">
        <div className="arrangement-toolbar__control-group">
          <span className="arrangement-toolbar__label">Snap</span>
          <div className="arrangement-toolbar__button-group">
            {snapModes.map(mode => (
              <button
                key={mode.id}
                className={`arrangement-toolbar__btn arrangement-toolbar__btn--sm ${
                  snapMode === mode.id ? 'active' : ''
                }`}
                onClick={() => setSnapMode(mode.id)}
                title={mode.title}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="arrangement-toolbar__control-group">
          <span className="arrangement-toolbar__label">Grid</span>
          <select
            value={gridSize}
            onChange={(e) => setGridSize(e.target.value)}
            className="arrangement-toolbar__select"
          >
            {gridSizes.map(size => (
              <option key={size.id} value={size.id}>{size.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ArrangementToolbar;
export { ArrangementToolbar };