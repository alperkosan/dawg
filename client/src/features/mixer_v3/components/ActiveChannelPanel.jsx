import React, { useState } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { pluginRegistry } from '@/config/pluginConfig';
import {
  Volume2,
  VolumeX,
  Headphones,
  Filter,
  Plus,
  Trash2,
  Power,
  Settings,
  Link,
  Unlink,
  ArrowRight,
  Zap,
  Waves,
  RotateCcw,
  Copy,
  Star
} from 'lucide-react';
import { Knob } from '@/components/controls/base/Knob';
import './ActiveChannelPanel.css';

const ActiveChannelPanel = () => {
  const [routingMode, setRoutingMode] = useState(false);
  const [quickEffectsOpen, setQuickEffectsOpen] = useState(false);

  const {
    activeChannelId,
    mixerTracks,
    sendChannels,
    handleMixerParamChange,
    handleMixerEffectAdd,
    handleMixerEffectRemove,
    handleMixerEffectChange,
    handleSendChange,
    toggleMute,
    toggleSolo
  } = useMixerStore();

  const activeTrack = mixerTracks.find(t => t.id === activeChannelId);
  const otherTracks = mixerTracks.filter(t => t.id !== activeChannelId && t.type === 'track');

  if (!activeTrack) {
    return (
      <div className="active-channel-panel active-channel-panel--empty">
        <div className="active-channel-panel__empty">
          <div className="active-channel-panel__empty-icon">
            <Settings size={32} />
          </div>
          <h3>No Active Channel</h3>
          <p>Select a mixer channel to see controls</p>
        </div>
      </div>
    );
  }

  const handleQuickRoute = (targetTrackId) => {
    // Quick routing logic - send current track to target track's input
    console.log('Quick route:', activeChannelId, '→', targetTrackId);
    // You can implement the actual routing logic here
    setRoutingMode(false);
  };

  const handleQuickEffect = (effectType) => {
    handleMixerEffectAdd(activeChannelId, effectType);
    setQuickEffectsOpen(false);
  };

  const mostUsedEffects = [
    { type: 'compressor', icon: <Volume2 size={14} />, name: 'Compressor' },
    { type: 'eq', icon: <Waves size={14} />, name: 'EQ' },
    { type: 'reverb', icon: <Filter size={14} />, name: 'Reverb' },
    { type: 'delay', icon: <Zap size={14} />, name: 'Delay' }
  ];

  return (
    <div className="active-channel-panel">
      {/* Header */}
      <div className="active-channel-panel__header">
        <div className="active-channel-panel__title">
          <div
            className="active-channel-panel__color"
            style={{ backgroundColor: activeTrack.color || '#4b5563' }}
          />
          <div className="active-channel-panel__info">
            <h3>{activeTrack.name}</h3>
            <span className="active-channel-panel__type">
              {activeTrack.type} • {activeTrack.id}
            </span>
          </div>
        </div>

        <div className="active-channel-panel__header-controls">
          <button
            className={`active-channel-panel__mode-btn ${routingMode ? 'active-channel-panel__mode-btn--active' : ''}`}
            onClick={() => setRoutingMode(!routingMode)}
            title="Toggle routing mode"
          >
            <Link size={14} />
          </button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="active-channel-panel__quick-actions">
        <button
          className={`quick-action-btn ${activeTrack.muted ? 'quick-action-btn--danger' : ''}`}
          onClick={() => toggleMute(activeChannelId)}
        >
          {activeTrack.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          <span>{activeTrack.muted ? 'UNMUTE' : 'MUTE'}</span>
        </button>

        <button
          className={`quick-action-btn ${activeTrack.solo ? 'quick-action-btn--warning' : ''}`}
          onClick={() => toggleSolo(activeChannelId)}
        >
          <Headphones size={16} />
          <span>{activeTrack.solo ? 'UNSOLO' : 'SOLO'}</span>
        </button>

        <button
          className="quick-action-btn"
          onClick={() => setQuickEffectsOpen(!quickEffectsOpen)}
        >
          <Plus size={16} />
          <span>ADD FX</span>
        </button>

        <button
          className="quick-action-btn"
          onClick={() => {
            // Copy current channel settings
            console.log('Copy channel settings:', activeChannelId);
          }}
        >
          <Copy size={16} />
          <span>COPY</span>
        </button>
      </div>

      {/* Routing Mode */}
      {routingMode && (
        <div className="active-channel-panel__routing">
          <div className="routing-section">
            <h4>Quick Route To:</h4>
            <div className="routing-targets">
              {otherTracks.map(track => (
                <button
                  key={track.id}
                  className="routing-target"
                  onClick={() => handleQuickRoute(track.id)}
                >
                  <div
                    className="routing-target__color"
                    style={{ backgroundColor: track.color || '#4b5563' }}
                  />
                  <span className="routing-target__name">{track.name}</span>
                  <ArrowRight size={12} />
                </button>
              ))}
            </div>
          </div>

          <div className="routing-section">
            <h4>Send To:</h4>
            <div className="send-targets">
              {sendChannels.map(send => (
                <div key={send.id} className="send-target">
                  <span className="send-target__name">{send.name}</span>
                  <Knob
                    value={activeTrack.sends?.[send.id] || 0}
                    onChange={(value) => handleSendChange(activeChannelId, send.id, value)}
                    label=""
                    min={-60}
                    max={12}
                    defaultValue={-60}
                    size={28}
                    variant="mixer"
                    unit="dB"
                    precision={1}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Effects */}
      {quickEffectsOpen && (
        <div className="active-channel-panel__quick-effects">
          <h4>Quick Add Effects</h4>
          <div className="quick-effects-grid">
            {mostUsedEffects.map(effect => (
              <button
                key={effect.type}
                className="quick-effect-btn"
                onClick={() => handleQuickEffect(effect.type)}
              >
                <div className="quick-effect-btn__icon">
                  {effect.icon}
                </div>
                <span>{effect.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Controls */}
      <div className="active-channel-panel__main-controls">
        <div className="control-section">
          <h4>Channel Strip</h4>
          <div className="channel-controls">
            <Knob
              value={activeTrack.inputGain || 0}
              onChange={(value) => handleMixerParamChange(activeChannelId, 'inputGain', value)}
              label="GAIN"
              min={-30}
              max={30}
              defaultValue={0}
              size={60}
              variant="mixer"
              unit="dB"
              precision={1}
            />
            <Knob
              value={activeTrack.pan || 0}
              onChange={(value) => handleMixerParamChange(activeChannelId, 'pan', value)}
              label="PAN"
              min={-100}
              max={100}
              defaultValue={0}
              size={60}
              variant="mixer"
              unit=""
              precision={0}
            />
            <Knob
              value={activeTrack.volume || 0}
              onChange={(value) => handleMixerParamChange(activeChannelId, 'volume', value)}
              label="VOLUME"
              min={-60}
              max={6}
              defaultValue={-60}
              size={60}
              variant="mixer"
              unit="dB"
              precision={1}
            />
          </div>
        </div>

        {/* Effects Chain */}
        <div className="control-section">
          <div className="control-section__header">
            <h4>Effects Chain</h4>
            <span className="effects-count">
              {activeTrack.insertEffects?.length || 0} effects
            </span>
          </div>

          <div className="effects-chain-compact">
            {activeTrack.insertEffects?.map((effect, index) => (
              <div
                key={effect.id}
                className={`effect-compact ${effect.bypass ? 'effect-compact--bypassed' : ''}`}
              >
                <div className="effect-compact__info">
                  <Filter size={12} />
                  <span className="effect-compact__name">
                    {pluginRegistry[effect.type]?.name || effect.type}
                  </span>
                </div>

                <div className="effect-compact__controls">
                  <button
                    className={`effect-compact__bypass ${effect.bypass ? 'effect-compact__bypass--active' : ''}`}
                    onClick={() => handleMixerEffectChange(activeChannelId, effect.id, 'bypass', !effect.bypass)}
                  >
                    <Power size={10} />
                  </button>
                  <button
                    className="effect-compact__remove"
                    onClick={() => handleMixerEffectRemove(activeChannelId, effect.id)}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}

            {(!activeTrack.insertEffects || activeTrack.insertEffects.length === 0) && (
              <div className="effects-empty-compact">
                <Filter size={16} />
                <span>No effects</span>
                <button
                  className="add-effect-compact"
                  onClick={() => setQuickEffectsOpen(true)}
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* EQ Section */}
        <div className="control-section">
          <h4>EQ</h4>
          <div className="eq-controls-compact">
            <Knob
              value={activeTrack.eq?.highGain || 0}
              onChange={(value) => handleMixerParamChange(activeChannelId, 'eq.highGain', value)}
              label="HIGH"
              min={-15}
              max={15}
              defaultValue={0}
              size={40}
              variant="mixer"
              unit="dB"
              precision={1}
            />
            <Knob
              value={activeTrack.eq?.midGain || 0}
              onChange={(value) => handleMixerParamChange(activeChannelId, 'eq.midGain', value)}
              label="MID"
              min={-15}
              max={15}
              defaultValue={0}
              size={40}
              variant="mixer"
              unit="dB"
              precision={1}
            />
            <Knob
              value={activeTrack.eq?.lowGain || 0}
              onChange={(value) => handleMixerParamChange(activeChannelId, 'eq.lowGain', value)}
              label="LOW"
              min={-15}
              max={15}
              defaultValue={0}
              size={40}
              variant="mixer"
              unit="dB"
              precision={1}
            />
          </div>
        </div>

        {/* Presets */}
        <div className="control-section">
          <div className="control-section__header">
            <h4>Quick Presets</h4>
            <button className="preset-save-btn">
              <Star size={12} />
            </button>
          </div>
          <div className="preset-buttons">
            <button className="preset-btn">Vocal</button>
            <button className="preset-btn">Drum</button>
            <button className="preset-btn">Bass</button>
            <button className="preset-btn">Lead</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveChannelPanel;