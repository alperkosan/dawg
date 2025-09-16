// client/src/features/piano_roll/components/KeyboardShortcutsPanel.jsx
import React, { useState } from 'react';
import { Keyboard, X, Search, Filter } from 'lucide-react';

/**
 * Piano Roll klavye kısayolları referans paneli
 * Hem desktop hem touch kullanıcıları için bilgi sağlar
 */
const KeyboardShortcutsPanel = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const shortcuts = {
    tools: {
      title: '🎯 Tools & Selection',
      color: 'bg-blue-600',
      items: {
        'Q / 1': { desc: 'Selection Tool', cat: 'tools' },
        'W / 2': { desc: 'Pencil Tool', cat: 'tools' },
        'E / 3': { desc: 'Eraser Tool', cat: 'tools' },
        'R / 4': { desc: 'Split Tool', cat: 'tools' },
        'Ctrl+A': { desc: 'Select All Notes', cat: 'selection' },
        'Ctrl+D': { desc: 'Deselect All', cat: 'selection' },
        'Ctrl+Shift+I': { desc: 'Invert Selection', cat: 'selection' },
        'Tab': { desc: 'Select Next Note', cat: 'selection' },
        'Shift+Tab': { desc: 'Select Previous Note', cat: 'selection' }
      }
    },
    editing: {
      title: '✂️ Edit Operations',
      color: 'bg-green-600',
      items: {
        'Ctrl+C': { desc: 'Copy Selected Notes', cat: 'clipboard' },
        'Ctrl+X': { desc: 'Cut Selected Notes', cat: 'clipboard' },
        'Ctrl+V': { desc: 'Paste Notes', cat: 'clipboard' },
        'Ctrl+D': { desc: 'Duplicate Notes (+1 Bar)', cat: 'edit' },
        'Delete': { desc: 'Delete Selected Notes', cat: 'edit' },
        'Backspace': { desc: 'Delete Selected Notes', cat: 'edit' },
        'Ctrl+Z': { desc: 'Undo', cat: 'edit' },
        'Ctrl+Y': { desc: 'Redo', cat: 'edit' }
      }
    },
    transport: {
      title: '⏯️ Playback Control',
      color: 'bg-purple-600',
      items: {
        'Space': { desc: 'Play/Pause', cat: 'transport' },
        'Enter': { desc: 'Play/Pause', cat: 'transport' },
        '.': { desc: 'Stop Playback', cat: 'transport' },
        'Home': { desc: 'Go to Start', cat: 'navigation' },
        'End': { desc: 'Go to End', cat: 'navigation' }
      }
    },
    view: {
      title: '🔍 View & Navigation',
      color: 'bg-orange-600',
      items: {
        'Ctrl + +': { desc: 'Zoom In', cat: 'zoom' },
        'Ctrl + -': { desc: 'Zoom Out', cat: 'zoom' },
        'F': { desc: 'Fit Selection to View', cat: 'view' },
        'Shift+F': { desc: 'Fit All Notes', cat: 'view' },
        '↑↓←→': { desc: 'Pan View', cat: 'navigation' },
        'Page Up': { desc: 'Scroll Up (Fast)', cat: 'navigation' },
        'Page Down': { desc: 'Scroll Down (Fast)', cat: 'navigation' },
        'Ctrl+Home': { desc: 'Go to Pattern Start', cat: 'navigation' },
        'Ctrl+End': { desc: 'Go to Pattern End', cat: 'navigation' }
      }
    },
    velocity: {
      title: '🎚️ Note Properties',
      color: 'bg-red-600',
      items: {
        'Shift+↑': { desc: 'Increase Velocity', cat: 'velocity' },
        'Shift+↓': { desc: 'Decrease Velocity', cat: 'velocity' },
        'Ctrl+Q': { desc: 'Quantize Notes', cat: 'timing' },
        'Ctrl+H': { desc: 'Humanize Notes', cat: 'timing' },
        'Ctrl+Shift+Q': { desc: 'Advanced Quantize', cat: 'timing' }
      }
    },
    workflow: {
      title: '⚡ Quick Actions',
      color: 'bg-cyan-600',
      items: {
        'Esc': { desc: 'Cancel/Clear Selection', cat: 'workflow' },
        'Ctrl+S': { desc: 'Save Project', cat: 'workflow' },
        'Ctrl+N': { desc: 'New Pattern', cat: 'workflow' },
        'Alt+Drag': { desc: 'Pan Mode (Mouse)', cat: 'workflow' },
        'Shift+Click': { desc: 'Add to Selection', cat: 'workflow' },
        'Ctrl+Click': { desc: 'Toggle Selection', cat: 'workflow' }
      }
    }
  };

  // Touch gestures info
  const touchGestures = {
    basic: {
      title: '👆 Basic Touch',
      items: {
        'Tap': 'Select note or create new note',
        'Double Tap': 'Delete note',
        'Long Press': 'Open context menu',
        'Drag': 'Move selected notes'
      }
    },
    multitouch: {
      title: '🤏 Multi-Touch',
      items: {
        'Pinch': 'Zoom in/out',
        'Two Finger Pan': 'Pan view',
        'Two Finger Tap': 'Switch tools',
        'Three Finger Tap': 'Play/Pause'
      }
    }
  };

  // Filter shortcuts based on search and category
  const filteredShortcuts = React.useMemo(() => {
    const filtered = {};
    
    Object.entries(shortcuts).forEach(([groupKey, group]) => {
      const filteredItems = {};
      
      Object.entries(group.items).forEach(([shortcut, info]) => {
        const matchesSearch = searchTerm === '' || 
          shortcut.toLowerCase().includes(searchTerm.toLowerCase()) ||
          info.desc.toLowerCase().includes(searchTerm.toLowerCase());
          
        const matchesCategory = activeCategory === 'all' || info.cat === activeCategory;
        
        if (matchesSearch && matchesCategory) {
          filteredItems[shortcut] = info;
        }
      });
      
      if (Object.keys(filteredItems).length > 0) {
        filtered[groupKey] = { ...group, items: filteredItems };
      }
    });
    
    return filtered;
  }, [searchTerm, activeCategory]);

  const categories = [
    { id: 'all', name: 'All', color: 'bg-gray-600' },
    { id: 'tools', name: 'Tools', color: 'bg-blue-600' },
    { id: 'selection', name: 'Selection', color: 'bg-indigo-600' },
    { id: 'clipboard', name: 'Clipboard', color: 'bg-green-600' },
    { id: 'edit', name: 'Edit', color: 'bg-emerald-600' },
    { id: 'transport', name: 'Playback', color: 'bg-purple-600' },
    { id: 'zoom', name: 'Zoom', color: 'bg-orange-600' },
    { id: 'navigation', name: 'Navigation', color: 'bg-yellow-600' },
    { id: 'velocity', name: 'Velocity', color: 'bg-red-600' },
    { id: 'timing', name: 'Timing', color: 'bg-pink-600' },
    { id: 'workflow', name: 'Workflow', color: 'bg-cyan-600' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Keyboard size={24} className="text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Piano Roll Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-gray-700 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search shortcuts or descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 mr-3">
              <Filter size={16} className="text-gray-400" />
              <span className="text-gray-400 text-sm">Filter:</span>
            </div>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.id 
                    ? `${cat.color} text-white` 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Keyboard Shortcuts */}
            <div className="space-y-6">
              {Object.entries(filteredShortcuts).map(([groupKey, group]) => (
                <div key={groupKey} className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${group.color}`} />
                    {group.title}
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(group.items).map(([shortcut, info]) => (
                      <div key={shortcut} className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded">
                        <span className="text-gray-300">{info.desc}</span>
                        <div className="flex gap-1">
                          {shortcut.split(' / ').map((key, index) => (
                            <React.Fragment key={index}>
                              {index > 0 && <span className="text-gray-500 mx-1">or</span>}
                              <kbd className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs font-mono text-cyan-300">
                                {key}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Touch Gestures */}
            <div className="space-y-6">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-600" />
                  📱 Touch & Gesture Controls
                </h3>
                
                {Object.entries(touchGestures).map(([groupKey, group]) => (
                  <div key={groupKey} className="mb-6">
                    <h4 className="text-md font-medium text-emerald-400 mb-3">{group.title}</h4>
                    <div className="space-y-2">
                      {Object.entries(group.items).map(([gesture, desc]) => (
                        <div key={gesture} className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded">
                          <span className="text-gray-300">{desc}</span>
                          <span className="px-2 py-1 bg-emerald-900/30 border border-emerald-700 rounded text-xs text-emerald-300">
                            {gesture}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pro Tips */}
              <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-700/30">
                <h3 className="text-lg font-semibold text-white mb-4">💡 Pro Tips</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-gray-300">
                      <strong className="text-white">Shift+Click</strong> to add notes to selection, 
                      <strong className="text-white"> Ctrl+Click</strong> to toggle individual notes.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-gray-300">
                      Hold <strong className="text-white">Alt</strong> and drag to pan the view without switching tools.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-gray-300">
                      Use <strong className="text-white">Tab/Shift+Tab</strong> to quickly navigate between notes for precise editing.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-gray-300">
                      <strong className="text-white">Double-tap</strong> on touch devices to quickly delete notes.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-gray-300">
                      <strong className="text-white">Long-press</strong> anywhere to open context menu with advanced options.
                    </p>
                  </div>
                </div>
              </div>

              {/* Input Mode Indicator */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">🖱️ Current Input Mode</h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-gray-300">Auto-detected</span>
                  </div>
                  <div className="px-3 py-1 bg-gray-700 rounded-full text-sm">
                    <span className="text-cyan-400 font-medium">Mouse + Keyboard</span>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  Piano Roll automatically adapts to your input method. Touch gestures activate when using touch devices.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 bg-gray-800/30">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div>
              Press <kbd className="px-1 bg-gray-700 rounded">F1</kbd> or 
              <kbd className="px-1 bg-gray-700 rounded ml-1">?</kbd> anytime to open this panel
            </div>
            <div>
              Found {Object.values(filteredShortcuts).reduce((acc, group) => 
                acc + Object.keys(group.items).length, 0
              )} shortcuts
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsPanel;