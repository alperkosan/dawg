import React, { memo, useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, Plus, Settings } from 'lucide-react';
import InstrumentRow from './InstrumentRow';

// ✅ Direct selectors
const selectInstruments = (state) => state.instruments;
const selectToggleGroupCollapsed = (state) => state.toggleGroupCollapsed;
const selectAddInstrumentToGroup = (state) => state.addInstrumentToGroup;

const ChannelGroup = ({
  group,
  instruments,
  activePattern,
  selectedChannels,
  onPianoRollClick,
  onEditClick,
  onToggleSelection,
  useInstrumentsStore
}) => {
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  const toggleGroupCollapsed = useInstrumentsStore(selectToggleGroupCollapsed);
  const addInstrumentToGroup = useInstrumentsStore(selectAddInstrumentToGroup);

  // ✅ Get instruments in this group
  const groupInstruments = useMemo(() =>
    group.instruments.map(id =>
      instruments.find(inst => inst.id === id)
    ).filter(Boolean),
    [group.instruments, instruments]
  );

  // ✅ Group stats
  const groupStats = useMemo(() => ({
    totalChannels: groupInstruments.length,
    selectedChannels: groupInstruments.filter(inst =>
      selectedChannels.includes(inst.id)
    ).length,
    hasNotes: groupInstruments.some(inst =>
      activePattern?.data[inst.id]?.length > 0
    )
  }), [groupInstruments, selectedChannels, activePattern]);

  const handleToggleCollapsed = useCallback(() => {
    toggleGroupCollapsed(group.id);
  }, [toggleGroupCollapsed, group.id]);

  const handleGroupSettings = useCallback((e) => {
    e.stopPropagation();
    setShowGroupSettings(!showGroupSettings);
  }, [showGroupSettings]);

  const groupHeaderClasses = useMemo(() => `
    channel-group__header
    ${group.collapsed ? 'channel-group__header--collapsed' : ''}
    ${groupStats.hasNotes ? 'channel-group__header--has-notes' : ''}
  `, [group.collapsed, groupStats.hasNotes]);

  return (
    <div className="channel-group">
      {/* Group Header */}
      <div
        className={groupHeaderClasses}
        onClick={handleToggleCollapsed}
        style={{ '--group-color': group.color }}
      >
        <div className="channel-group__header-left">
          <div className="channel-group__collapse-icon">
            {group.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>
          <div className="channel-group__icon">
            <Folder size={16} />
          </div>
          <span className="channel-group__name">{group.name}</span>
          <span className="channel-group__stats">
            ({groupStats.totalChannels})
            {groupStats.selectedChannels > 0 && (
              <span className="channel-group__selected">
                {groupStats.selectedChannels} selected
              </span>
            )}
          </span>
        </div>

        <div className="channel-group__header-right">
          {groupStats.hasNotes && (
            <div className="channel-group__activity-indicator" />
          )}
          <button
            className="channel-group__settings-btn"
            onClick={handleGroupSettings}
            title="Group Settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Group Content */}
      {!group.collapsed && (
        <div className="channel-group__content">
          {groupInstruments.map((inst, index) => (
            <InstrumentRow
              key={inst.id}
              instrument={inst}
              index={index}
              isSelected={selectedChannels.includes(inst.id)}
              onPianoRollClick={() => onPianoRollClick(inst)}
              onEditClick={() => onEditClick(inst)}
              onToggleSelection={() => onToggleSelection(inst.id)}
            />
          ))}

          {groupInstruments.length === 0 && (
            <div className="channel-group__empty">
              <span>No channels in this group</span>
              <button className="channel-group__add-btn">
                <Plus size={14} />
                Add Channel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Group Settings Panel */}
      {showGroupSettings && (
        <div className="channel-group__settings">
          <div className="channel-group__settings-content">
            <h4>Group Settings</h4>
            <div className="channel-group__color-picker">
              <label>Color:</label>
              <input
                type="color"
                value={group.color}
                onChange={(e) => {
                  // TODO: Implement group color change
                  console.log('Group color changed:', e.target.value);
                }}
              />
            </div>
            <div className="channel-group__actions">
              <button>Rename Group</button>
              <button>Delete Group</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ChannelGroup);