import React, { useState } from 'react';
import { Zap, Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { useBufferProcessor } from '../hooks/useBufferProcessor';
import WaveformDisplay from '../WaveformDisplay';

const AdvancedProcessingTab = ({ instrument, instrumentBuffer, audioEngineRef }) => {
  const { isProcessing, processedBuffer, error, applyFadeIn, applyFadeOut, applyGain, resetProcessor } = useBufferProcessor();
  const [settings, setSettings] = useState({
    fadeInMs: 100,
    fadeOutMs: 100,
    gainDb: 0,
  });
  const [previewBuffer, setPreviewBuffer] = useState(null);

  const handleApplyFadeIn = async () => {
    if (!instrumentBuffer) return;
    try {
      const result = await applyFadeIn(instrumentBuffer, settings.fadeInMs);
      setPreviewBuffer(result);
    } catch (err) {
      console.error('Fade in failed:', err);
    }
  };

  const handleApplyFadeOut = async () => {
    if (!instrumentBuffer) return;
    try {
      const result = await applyFadeOut(instrumentBuffer, settings.fadeOutMs);
      setPreviewBuffer(result);
    } catch (err) {
      console.error('Fade out failed:', err);
    }
  };

  const handleApplyGain = async () => {
    if (!instrumentBuffer) return;
    try {
      const result = await applyGain(instrumentBuffer, settings.gainDb);
      setPreviewBuffer(result);
    } catch (err) {
      console.error('Gain failed:', err);
    }
  };

  const handleReset = () => {
    setPreviewBuffer(null);
    resetProcessor();
  };

  const currentBuffer = previewBuffer || instrumentBuffer;

  return (
    <div className="w-full h-full flex" style={{ padding: 'var(--padding-container)', gap: 'var(--padding-container)', backgroundColor: 'var(--color-surface)' }}>
      {/* Sol Panel - Kontroller */}
      <div className="w-80 shrink-0 flex flex-col" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', padding: 'var(--padding-container)', gap: 'var(--gap-container)' }}>
        
        <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--color-primary)' }}>
          Advanced Processing
        </h3>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Fade In */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm">Fade In</h4>
          <div>
            <label className="text-sm block mb-2">Duration (ms)</label>
            <input
              type="range"
              min="0"
              max="1000"
              value={settings.fadeInMs}
              onChange={(e) => setSettings(prev => ({ ...prev, fadeInMs: parseInt(e.target.value) }))}
              className="w-full"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-400">{settings.fadeInMs}ms</span>
              <button
                onClick={handleApplyFadeIn}
                disabled={isProcessing || !instrumentBuffer}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Fade Out */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm">Fade Out</h4>
          <div>
            <label className="text-sm block mb-2">Duration (ms)</label>
            <input
              type="range"
              min="0"
              max="1000"
              value={settings.fadeOutMs}
              onChange={(e) => setSettings(prev => ({ ...prev, fadeOutMs: parseInt(e.target.value) }))}
              className="w-full"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-400">{settings.fadeOutMs}ms</span>
              <button
                onClick={handleApplyFadeOut}
                disabled={isProcessing || !instrumentBuffer}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Gain */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm">Gain</h4>
          <div>
            <label className="text-sm block mb-2">Gain (dB)</label>
            <input
              type="range"
              min="-24"
              max="24"
              step="0.1"
              value={settings.gainDb}
              onChange={(e) => setSettings(prev => ({ ...prev, gainDb: parseFloat(e.target.value) }))}
              className="w-full"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-400">
                {settings.gainDb > 0 ? '+' : ''}{settings.gainDb.toFixed(1)}dB
              </span>
              <button
                onClick={handleApplyGain}
                disabled={isProcessing || !instrumentBuffer}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="mt-auto space-y-2">
          <button
            onClick={handleReset}
            disabled={!previewBuffer}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded disabled:opacity-50"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 py-2 text-blue-400">
              <Loader2 className="animate-spin" size={16} />
              <span className="text-sm">Processing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Sağ Panel - Waveform Display */}
      <div className="flex-grow rounded-lg p-4" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Processing Preview</h3>
            {previewBuffer && (
              <span className="text-sm px-2 py-1 bg-green-500/20 text-green-400 rounded">
                Modified
              </span>
            )}
          </div>
          
          <div className="flex-grow flex items-center justify-center">
            {currentBuffer ? (
              <div className="w-full h-full">
                <WaveformDisplay 
                  buffer={currentBuffer} 
                  className="w-full h-32 mb-4" 
                />
                
                {/* Buffer Comparison */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center p-3 bg-gray-800 rounded">
                    <div className="text-sm text-gray-400 mb-1">Original</div>
                    <div className="text-lg font-bold">
                      {instrumentBuffer?.duration.toFixed(2)}s
                    </div>
                  </div>
                  
                  {previewBuffer && (
                    <div className="text-center p-3 bg-gray-800 rounded">
                      <div className="text-sm text-gray-400 mb-1">Processed</div>
                      <div className="text-lg font-bold text-green-400">
                        {previewBuffer.duration.toFixed(2)}s
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <p>No buffer loaded for processing</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedProcessingTab;