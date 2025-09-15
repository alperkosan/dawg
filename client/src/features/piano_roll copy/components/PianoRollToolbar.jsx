import React from 'react';
import { usePianoRollStore, NOTES, SCALES } from '../store/usePianoRollStore'; // SCALES eklendi

import { 
  Pencil, 
  Eraser, 
  MousePointer, 
  Grid3x3, 
  Scale, 
  Eye, 
  EyeOff, 
  ZoomIn, 
  ZoomOut, 
  AlignVerticalSpaceAround,
  Magnet,
  Move3D,
  Settings
} from 'lucide-react';

/**
 * Araç düğmesi bileşeni
 */
const ToolButton = ({ 
  label, 
  icon: Icon, 
  isActive = false, 
  onClick, 
  disabled = false,
  size = 16,
  variant = 'default'
}) => {
  let baseClasses = 'p-2 rounded-md transition-all duration-150 flex items-center justify-center';
  
  if (disabled) {
    baseClasses += ' opacity-50 cursor-not-allowed bg-gray-800 text-gray-500';
  } else if (isActive) {
    if (variant === 'danger') {
      baseClasses += ' bg-red-600 text-white hover:bg-red-700';
    } else if (variant === 'success') {
      baseClasses += ' bg-green-600 text-white hover:bg-green-700';
    } else {
      baseClasses += ' bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg';
    }
  } else {
    baseClasses += ' bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white';
  }

  return (
    <button 
      onClick={onClick} 
      title={label}
      disabled={disabled}
      className={baseClasses}
    >
      <Icon size={size} />
    </button>
  );
};

/**
 * Dropdown seçici bileşeni
 */
const Select = ({ value, onChange, options, className = '', disabled = false }) => (
  <select 
    value={value} 
    onChange={onChange}
    disabled={disabled}
    className={`bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 
                hover:border-gray-500 focus:border-indigo-500 focus:outline-none 
                disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {options.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

/**
 * Araç grubu konteyner bileşeni
 */
const ToolGroup = ({ title, children }) => (
  <div className="flex items-center gap-2">
    {title && (
      <span className="text-xs text-gray-400 font-medium hidden md:block">
        {title}
      </span>
    )}
    {children}
  </div>
);

/**
 * Ana Piano Roll Toolbar Bileşeni
 */
export function PianoRollToolbar() {
  const { 
    // Araçlar ve modlar
    scale, 
    setScale, 
    showScaleHighlighting, 
    toggleScaleHighlighting, 
    activeTool, 
    setActiveTool, 
    gridSnapValue, 
    setGridSnapValue,
    snapMode, 
    toggleSnapMode,
    
    // Görünüm
    zoomX,
    zoomY,
    zoomIn, 
    zoomOut,
    
    // Velocity lane
    velocityLaneHeight, 
    toggleVelocityLane,
    
    // Gelişmiş özellikler
    quantizeSelected,
    humanizeSelected
  } = usePianoRollStore();

  // Snap değerleri seçenekleri
  const snapOptions = [
    { value: '32n', label: '1/32' },
    { value: '16n', label: '1/16' },
    { value: '8n', label: '1/8' },
    { value: '4n', label: '1/4' },
    { value: '2n', label: '1/2' },
    { value: '1m', label: '1 Bar' }
  ];

  // Gam seçenekleri
  const scaleOptions = Object.keys(SCALES).map(scaleName => ({
    value: scaleName,
    label: scaleName
  }));

  // Nota kök seçenekleri
  const noteOptions = NOTES.map(note => ({
    value: note,
    label: note
  }));

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between 
                    border-b-2 border-gray-950 shrink-0 select-none min-h-[60px]">
      
      {/* Sol Taraf - Ana Araçlar */}
      <div className="flex items-center gap-4">
        
        {/* Araç Seçimi */}
        <ToolGroup>
          <ToolButton 
            label="Seçim Aracı (1)" 
            icon={MousePointer} 
            isActive={activeTool === 'selection'}
            onClick={() => setActiveTool('selection')} 
          />
          <ToolButton 
            label="Kalem Aracı (2)" 
            icon={Pencil} 
            isActive={activeTool === 'pencil'}
            onClick={() => setActiveTool('pencil')} 
          />
          <ToolButton 
            label="Silgi Aracı (3)" 
            icon={Eraser} 
            isActive={activeTool === 'eraser'}
            onClick={() => setActiveTool('eraser')} 
          />
        </ToolGroup>

        <div className="w-px h-8 bg-gray-600" />

        {/* Grid ve Snap Ayarları */}
        <ToolGroup>
          <Grid3x3 size={16} className="text-gray-400" />
          <Select
            value={gridSnapValue}
            onChange={(e) => setGridSnapValue(e.target.value)}
            options={snapOptions}
            className="w-20"
          />
          
          <ToolButton 
            label={`Snap Modu: ${snapMode === 'hard' ? 'Sert' : 'Yumuşak'}`}
            icon={snapMode === 'hard' ? Magnet : Move3D}
            isActive={snapMode === 'soft'}
            onClick={toggleSnapMode}
            variant={snapMode === 'soft' ? 'success' : 'default'}
          />
        </ToolGroup>

        <div className="w-px h-8 bg-gray-600" />

        {/* Görünüm Kontrolleri */}
        <ToolGroup>
          <ToolButton 
            label="Velocity Alanını Göster/Gizle"
            icon={AlignVerticalSpaceAround}
            isActive={velocityLaneHeight > 0}
            onClick={toggleVelocityLane}
          />
          
          <ToolButton 
            label="Uzaklaş"
            icon={ZoomOut}
            onClick={zoomOut}
            disabled={zoomX <= 0.25}
          />
          
          <div className="text-xs text-gray-400 min-w-[40px] text-center">
            {Math.round(zoomX * 100)}%
          </div>
          
          <ToolButton 
            label="Yakınlaş"
            icon={ZoomIn}
            onClick={zoomIn}
            disabled={zoomX >= 5}
          />
        </ToolGroup>
      </div>

      {/* Orta - Gam Ayarları */}
      <div className="flex items-center gap-3">
        <ToolGroup title="Gam">
          <Scale size={18} className="text-indigo-400" />
          
          <Select
            value={scale.root}
            onChange={(e) => setScale(e.target.value, scale.type)}
            options={noteOptions}
            className="w-16"
          />
          
          <Select
            value={scale.type}
            onChange={(e) => setScale(scale.root, e.target.value)}
            options={scaleOptions}
            className="w-32"
          />
          
          <ToolButton 
            label={`Gam Vurgulaması ${showScaleHighlighting ? 'Açık' : 'Kapalı'}`}
            icon={showScaleHighlighting ? Eye : EyeOff}
            isActive={showScaleHighlighting}
            onClick={toggleScaleHighlighting}
          />
        </ToolGroup>
      </div>

      {/* Sağ Taraf - Gelişmiş İşlemler */}
      <div className="flex items-center gap-4">
        
        {/* Quantize ve Humanize */}
        <ToolGroup title="İşlemler">
          <button 
            onClick={quantizeSelected}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded 
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Seçili Notaları Quantize Et"
          >
            Quantize
          </button>
          
          <button 
            onClick={humanizeSelected}
            className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded 
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Seçili Notaları Humanize Et"
          >
            Humanize
          </button>
        </ToolGroup>

        <div className="w-px h-8 bg-gray-600" />

        {/* Ayarlar */}
        <ToolButton 
          label="Piano Roll Ayarları"
          icon={Settings}
          onClick={() => console.log('Settings clicked')} // Gelecekte ayarlar paneli
        />
      </div>
    </div>
  );
}

/**
 * Klavye kısayolları bilgi bileşeni
 */
export const KeyboardShortcutsInfo = () => (
  <div className="text-xs text-gray-500 mt-2 px-4">
    <div className="flex gap-4">
      <span><kbd className="px-1 bg-gray-800 rounded">1</kbd> Seçim</span>
      <span><kbd className="px-1 bg-gray-800 rounded">2</kbd> Kalem</span>
      <span><kbd className="px-1 bg-gray-800 rounded">3</kbd> Silgi</span>
      <span><kbd className="px-1 bg-gray-800 rounded">Space</kbd> Oynat/Duraklat</span>
      <span><kbd className="px-1 bg-gray-800 rounded">Z</kbd> Seçime Odakla</span>
      <span><kbd className="px-1 bg-gray-800 rounded">Alt + Drag</kbd> Pan</span>
    </div>
  </div>
);