/**
 *  ARRANGEMENT TABS
 *
 * Multi-tab arrangement system with:
 * - Tab switching
 * - Create, duplicate, rename, delete operations
 * - Drag and drop reordering
 * - Context menus
 */

import React, { useState, useRef } from 'react';
import {
  Plus, MoreHorizontal, Copy, Edit3, Trash2,
  X, Music, Disc
} from 'lucide-react';

const ArrangementTabs = ({
  arrangements,
  activeArrangementId,
  onSelectArrangement,
  onCreateArrangement,
  onDuplicateArrangement,
  onRenameArrangement,
  onDeleteArrangement
}) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverTab, setDragOverTab] = useState(null);

  const arrangementIds = Object.keys(arrangements);

  // =================== CONTEXT MENU ===================

  const handleContextMenu = (e, arrangementId) => {
    e.preventDefault();
    setContextMenu({
      id: arrangementId,
      x: e.clientX,
      y: e.clientY
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // =================== DRAG AND DROP ===================

  const handleDragStart = (e, arrangementId) => {
    setDraggedTab(arrangementId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, arrangementId) => {
    e.preventDefault();
    setDragOverTab(arrangementId);
  };

  const handleDragLeave = () => {
    setDragOverTab(null);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();

    if (draggedTab && draggedTab !== targetId) {
      // TODO: Implement tab reordering
      console.log(`Moving tab ${draggedTab} to position of ${targetId}`);
    }

    setDraggedTab(null);
    setDragOverTab(null);
  };

  // =================== RENDER HELPERS ===================

  const getArrangementIcon = (arrangement) => {
    const clipCount = arrangement.clips?.length || 0;
    return clipCount > 0 ? <Music size={14} /> : <Disc size={14} />;
  };

  const getTabStatus = (arrangement) => {
    const isModified = arrangement.modified > arrangement.created;
    return isModified ? '' : '';
  };

  // =================== RENDER ===================

  return (
    <div className="arrangement-tabs" onClick={closeContextMenu}>
      <div className="arrangement-tabs__container">

        {/* Tab List */}
        <div className="arrangement-tabs__list">
          {arrangementIds.map(arrangementId => {
            const arrangement = arrangements[arrangementId];
            const isActive = arrangementId === activeArrangementId;
            const isDragging = draggedTab === arrangementId;
            const isDragOver = dragOverTab === arrangementId;

            return (
              <div
                key={arrangementId}
                className={`arrangement-tabs__tab ${
                  isActive ? 'arrangement-tabs__tab--active' : ''
                } ${
                  isDragging ? 'arrangement-tabs__tab--dragging' : ''
                } ${
                  isDragOver ? 'arrangement-tabs__tab--drag-over' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, arrangementId)}
                onDragOver={(e) => handleDragOver(e, arrangementId)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, arrangementId)}
                onContextMenu={(e) => handleContextMenu(e, arrangementId)}
                onClick={() => onSelectArrangement(arrangementId)}
              >
                <div className="arrangement-tabs__tab-content">
                  <span className="arrangement-tabs__tab-icon">
                    {getArrangementIcon(arrangement)}
                  </span>

                  <span className="arrangement-tabs__tab-name">
                    {arrangement.name}
                  </span>

                  <span className="arrangement-tabs__tab-status">
                    {getTabStatus(arrangement)}
                  </span>

                  {arrangementIds.length > 1 && (
                    <button
                      className="arrangement-tabs__tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteArrangement(arrangementId);
                      }}
                      title="Close Arrangement"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Arrangement Info Tooltip */}
                <div className="arrangement-tabs__tab-tooltip">
                  <div className="arrangement-tabs__tooltip-header">
                    <strong>{arrangement.name}</strong>
                    <span className="arrangement-tabs__tooltip-date">
                      {new Date(arrangement.modified).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="arrangement-tabs__tooltip-stats">
                    <span>{arrangement.tracks?.length || 0} tracks</span>
                    <span>{arrangement.clips?.length || 0} clips</span>
                    <span>{arrangement.length} bars</span>
                    <span>{arrangement.tempo} BPM</span>
                  </div>
                  {arrangement.metadata.genre && (
                    <div className="arrangement-tabs__tooltip-genre">
                      {arrangement.metadata.genre}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Tab Button */}
        <button
          className="arrangement-tabs__add-button"
          onClick={onCreateArrangement}
          title="Create New Arrangement"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="arrangement-tabs__context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="arrangement-tabs__context-item"
            onClick={() => {
              onDuplicateArrangement(contextMenu.id);
              closeContextMenu();
            }}
          >
            <Copy size={14} />
            Duplicate
          </button>

          <button
            className="arrangement-tabs__context-item"
            onClick={() => {
              onRenameArrangement(contextMenu.id);
              closeContextMenu();
            }}
          >
            <Edit3 size={14} />
            Rename
          </button>

          <div className="arrangement-tabs__context-divider" />

          <button
            className="arrangement-tabs__context-item arrangement-tabs__context-item--danger"
            onClick={() => {
              onDeleteArrangement(contextMenu.id);
              closeContextMenu();
            }}
            disabled={arrangementIds.length <= 1}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default ArrangementTabs;
export { ArrangementTabs };