// hooks/useEngineState.js
// Ortak kullanılabilir motor durumu takip hook'u
import { useState, useEffect, useCallback } from 'react';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
import { usePlaybackStore } from '@/store/usePlaybackStore';

/**
 * Motor durumunu ve transport olaylarını takip eden hook
 * Birden fazla component'te tekrarlanmayı önler
 */
export const useEngineState = (options = {}) => {
  const {
    trackTick = false,
    trackPosition = true,
    trackPlayback = true,
    trackLoop = false
  } = options;

  const [engineState, setEngineState] = useState({
    isConnected: false,
    currentStep: 0,
    isPlaying: false,
    isPaused: false,
    transportTick: 0
  });

  const playbackState = usePlaybackStore(state => state.playbackState);
  const transportStep = usePlaybackStore(state => state.transportStep);

  // Motor bağlantısını kontrol et
  const checkEngineConnection = useCallback(() => {
    const audioEngine = AudioEngineGlobal.get();
    const transport = audioEngine?.transport;
    const isConnected = !!(audioEngine && transport);

    setEngineState(prev => ({
      ...prev,
      isConnected,
      isPlaying: transport?.isPlaying || false,
      isPaused: transport?.isPaused || false
    }));

    return { audioEngine, transport, isConnected };
  }, []);

  // Transport event handlers
  const handleTransportTick = useCallback((data) => {
    if (!trackTick) return;

    const { step, tick, position } = data;

    setEngineState(prev => ({
      ...prev,
      currentStep: step || prev.currentStep,
      transportTick: tick || prev.transportTick
    }));
  }, [trackTick]);

  const handleTransportLoop = useCallback((data) => {
    if (!trackLoop) return;

    // Loop event'lerini ilgilenen component'lere bildir
  }, [trackLoop]);

  const handlePlaybackChange = useCallback((data) => {
    if (!trackPlayback) return;

    setEngineState(prev => ({
      ...prev,
      isPlaying: data.isPlaying || false,
      isPaused: data.isPaused || false
    }));
  }, [trackPlayback]);

  // Motor event'lerini dinle
  useEffect(() => {
    const { transport, isConnected } = checkEngineConnection();

    if (!isConnected || !transport) {
      return;
    }

    // Event listener'ları ekle
    if (trackTick) {
      transport.on('tick', handleTransportTick);
    }

    if (trackLoop) {
      transport.on('loop', handleTransportLoop);
    }

    if (trackPlayback) {
      transport.on('start', () => handlePlaybackChange({ isPlaying: true, isPaused: false }));
      transport.on('stop', () => handlePlaybackChange({ isPlaying: false, isPaused: false }));
      transport.on('pause', () => handlePlaybackChange({ isPlaying: false, isPaused: true }));
    }

    // Cleanup
    return () => {
      if (trackTick) {
        transport.off('tick', handleTransportTick);
      }
      if (trackLoop) {
        transport.off('loop', handleTransportLoop);
      }
      if (trackPlayback) {
        transport.off('start', handlePlaybackChange);
        transport.off('stop', handlePlaybackChange);
        transport.off('pause', handlePlaybackChange);
      }
    };
  }, [checkEngineConnection, handleTransportTick, handleTransportLoop, handlePlaybackChange, trackTick, trackLoop, trackPlayback]);

  // Store değişikliklerini fallback olarak dinle - sadece motor bağlı değilse
  useEffect(() => {
    if (trackPosition && !engineState.isConnected) {
      setEngineState(prev => ({
        ...prev,
        currentStep: transportStep
      }));
    }
  }, [transportStep, trackPosition, engineState.isConnected]);

  // Yardımcı fonksiyonlar
  const jumpToStep = useCallback((step) => {
    const { audioEngine } = checkEngineConnection();
    audioEngine?.playbackManager?.jumpToStep(step);
  }, [checkEngineConnection]);

  const getTransport = useCallback(() => {
    const { transport } = checkEngineConnection();
    return transport;
  }, [checkEngineConnection]);

  const getPlaybackManager = useCallback(() => {
    const { audioEngine } = checkEngineConnection();
    return audioEngine?.playbackManager;
  }, [checkEngineConnection]);

  return {
    ...engineState,
    playbackState,
    // Yardımcı fonksiyonlar
    jumpToStep,
    getTransport,
    getPlaybackManager,
    checkEngineConnection
  };
};

/**
 * Sadece playhead takibi için optimize edilmiş hook
 */
export const usePlayheadTracking = () => {
  return useEngineState({
    trackTick: true,
    trackPosition: true,
    trackPlayback: true,
    trackLoop: false
  });
};

/**
 * Loop takibi için optimize edilmiş hook
 */
export const useLoopTracking = () => {
  return useEngineState({
    trackTick: false,
    trackPosition: false,
    trackPlayback: false,
    trackLoop: true
  });
};