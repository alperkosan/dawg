/**
 * 🎛️ SAMPLE EDITOR MODAL
 *
 * Modal for editing audio clip properties
 * - Waveform preview
 * - Mixer channel assignment
 * - Volume, pan, pitch controls
 * - Fade in/out, gain
 * - Sample offset, playback rate
 */

import React, { useState, useEffect, useRef } from 'react';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
import { audioAssetManager } from '@/lib/audio/AudioAssetManager.js';
import './SampleEditor.css';

export function SampleEditor({ clip, onClose, onUpdate }) {
  const [localClip, setLocalClip] = useState(clip);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [mixerChannels, setMixerChannels] = useState([]);
  const canvasRef = useRef(null);

  // Load audio buffer and mixer channels
  useEffect(() => {
    const loadData = async () => {
      // Load audio buffer
      if (clip.assetId) {
        const asset = audioAssetManager.assets.get(clip.assetId);
        if (asset?.buffer) {
          setAudioBuffer(asset.buffer);
        }
      }

      // Get available mixer channels
      const audioEngine = AudioEngineGlobal.get();
      if (audioEngine) {
        const channels = Array.from(audioEngine.mixerChannels.entries()).map(([id, channel]) => ({
          id,
          name: channel.name || id
        }));
        setMixerChannels(channels);
      }
    };

    loadData();
  }, [clip]);

  // Draw waveform
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.fillStyle = 'rgba(15, 15, 20, 0.8)';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    const channelData = audioBuffer.getChannelData(0); // Left channel
    const step = Math.ceil(channelData.length / width);
    const amp = height / 2;

    ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      const min = Math.min(...channelData.slice(i * step, (i + 1) * step));
      const max = Math.max(...channelData.slice(i * step, (i + 1) * step));

      const y1 = (1 + min) * amp;
      const y2 = (1 + max) * amp;

      if (i === 0) {
        ctx.moveTo(i, y1);
      } else {
        ctx.lineTo(i, y1);
      }
      ctx.lineTo(i, y2);
    }

    ctx.stroke();

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.stroke();
  }, [audioBuffer]);

  const handleChange = (field, value) => {
    setLocalClip({ ...localClip, [field]: value });
  };

  const handleSave = () => {
    onUpdate(localClip);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="sample-editor-overlay" onClick={handleCancel}>
      <div className="sample-editor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sample-editor-header">
          <h2>Sample Editor</h2>
          <button className="sample-editor-close" onClick={handleCancel}>×</button>
        </div>

        {/* Waveform */}
        <div className="sample-editor-waveform">
          <canvas ref={canvasRef} />
        </div>

        {/* Controls */}
        <div className="sample-editor-controls">
          {/* Clip Name */}
          <div className="sample-editor-control">
            <label>Name</label>
            <input
              type="text"
              value={localClip.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          {/* Mixer Channel Assignment */}
          <div className="sample-editor-control">
            <label>Mixer Channel</label>
            <select
              value={localClip.mixerChannelId || ''}
              onChange={(e) => handleChange('mixerChannelId', e.target.value || null)}
            >
              <option value="">Use Track Channel</option>
              {mixerChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </div>

          {/* Volume */}
          <div className="sample-editor-control">
            <label>Volume</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={localClip.volume || 1}
              onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
            />
            <span>{Math.round((localClip.volume || 1) * 100)}%</span>
          </div>

          {/* Pan */}
          <div className="sample-editor-control">
            <label>Pan</label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={localClip.pan || 0}
              onChange={(e) => handleChange('pan', parseFloat(e.target.value))}
            />
            <span>
              {localClip.pan === 0 ? 'C' : localClip.pan > 0 ? `R${Math.round(localClip.pan * 100)}` : `L${Math.abs(Math.round(localClip.pan * 100))}`}
            </span>
          </div>

          {/* Playback Rate */}
          <div className="sample-editor-control">
            <label>Playback Rate</label>
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.01"
              value={localClip.playbackRate || 1}
              onChange={(e) => handleChange('playbackRate', parseFloat(e.target.value))}
            />
            <span>{(localClip.playbackRate || 1).toFixed(2)}x</span>
          </div>

          {/* Fade In */}
          <div className="sample-editor-control">
            <label>Fade In</label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.01"
              value={localClip.fadeIn || 0}
              onChange={(e) => handleChange('fadeIn', parseFloat(e.target.value))}
            />
            <span>{(localClip.fadeIn || 0).toFixed(2)}s</span>
          </div>

          {/* Fade Out */}
          <div className="sample-editor-control">
            <label>Fade Out</label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.01"
              value={localClip.fadeOut || 0}
              onChange={(e) => handleChange('fadeOut', parseFloat(e.target.value))}
            />
            <span>{(localClip.fadeOut || 0).toFixed(2)}s</span>
          </div>

          {/* Gain */}
          <div className="sample-editor-control">
            <label>Gain</label>
            <input
              type="range"
              min="-24"
              max="24"
              step="0.1"
              value={localClip.gain || 0}
              onChange={(e) => handleChange('gain', parseFloat(e.target.value))}
            />
            <span>{(localClip.gain || 0).toFixed(1)} dB</span>
          </div>
        </div>

        {/* Actions */}
        <div className="sample-editor-actions">
          <button className="sample-editor-btn sample-editor-btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="sample-editor-btn sample-editor-btn-save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
