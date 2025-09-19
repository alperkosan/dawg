import React from 'react';
import { 
  MousePointer, 
  Pencil, 
  Eraser, 
  Scissors,
  Grid3X3,
  Magnet,
  ZoomIn,
  ZoomOut,
  Play,
  Square,
  BarChart3
} from 'lucide-react';

const TOOLS = [
  { id: 'select', icon: MousePointer, label: 'Select (1)', key: '1' },
  { id: 'pencil', icon: Pencil, label: 'Pencil (2)', key: '2' },
  { id: 'eraser', icon: Eraser, label: 'Eraser (3)', key: '3' },
  { id: 'split', icon: Scissors, label: 'Split (4)', key: '4' }
];

const SNAP_VALUES = [
  { value: '32n', label: '1/32' },
  { value: '16n', label: '1/16' },
  { value: '8n', label: '1/8' },
  { value: '4n', label: '1/4' },
  { value: '2n', label: '1/2' },
  { value: '1m', label: '1 Bar' }
];

const ToolButton = ({ tool, isActive, onClick }) => (
  <button
    onClick={onClick}
    title={tool.label}
    className={`
      p-2 rounded-md transition-all duration-150 flex items-center gap-2
      ${isActive 
        ? 'bg-blue-600 text-white shadow-lg' 
        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
      }
    `}
  >
    <tool.icon size={16} />
  </button>
);

const Toolbar = ({ 
  state, 
  onToolChange, 
  onScaleChange, 
  onSnapChange, 
  onZoom 
}) => {
  const { tool, scale, snapSettings, zoom, velocityLaneHeight } = state;
  
  return (
    <div className="bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 p-3">
      <div className="flex items-center justify-between">
        {/* Tools */}
        <div className="flex items-center gap-2">
          {TOOLS.map(toolDef => (
            <ToolButton
              key={toolDef.id}
              tool={toolDef}
              isActive={tool === toolDef.id}
              onClick={() => onToolChange(toolDef.id)}
            />
          ))}
        </div>
        
        {/* Snap and Grid */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Grid3X3 size={16} className="text-gray-400" />
            <select 
              value={snapSettings.value}
              onChange={(e) => onSnapChange({ ...snapSettings, value: e.target.value })}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              {SNAP_VALUES.map(snap => (
                <option key={snap.value} value={snap.value}>
                  {snap.label}
                </option>
              ))}
            </select>
            
            <button
              onClick={() => onSnapChange({ 
                ...snapSettings, 
                enabled: !snapSettings.enabled 
              })}
              className={`
                p-2 rounded-md transition-colors
                ${snapSettings.enabled 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }
              `}
              title="Toggle Snap"
            >
              <Magnet size={16} />
            </button>
          </div>
        </div>
        
        {/* Scale Settings */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Scale:</span>
          <select 
            value={scale.root}
            onChange={(e) => onScaleChange(e.target.value, scale.type)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
          >
            {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(note => (
              <option key={note} value={note}>{note}</option>
            ))}
          </select>
          
          <select 
            value={scale.type}
            onChange={(e) => onScaleChange(scale.root, e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
          >
            {Object.keys(state.availableScales).map(scaleType => (
              <option key={scaleType} value={scaleType}>{scaleType}</option>
            ))}
          </select>
        </div>
        
        {/* Zoom and View */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onZoom(zoom.x / 1.2, zoom.y)}
            className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          
          <span className="text-sm text-gray-400 min-w-16 text-center">
            {Math.round(zoom.x * 100)}%
          </span>
          
          <button
            onClick={() => onZoom(zoom.x * 1.2, zoom.y)}
            className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          
          <button
            onClick={state.toggleVelocityLane}
            className={`
              p-2 rounded-md transition-colors
              ${velocityLaneHeight > 0 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }
            `}
            title="Velocity Lane"
          >
            <BarChart3 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
