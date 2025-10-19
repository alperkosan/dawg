/**
 * useGranularInstrument - React hook for Granular Sampler control
 *
 * Provides interface to control granular sampler parameters from UI
 */

import { useState, useEffect, useCallback } from 'react';
import { AudioContextService } from '@/lib/services/AudioContextService';

export const useGranularInstrument = (instrumentId) => {
  const [params, setParams] = useState({
    grainSize: 80,
    grainDensity: 25,
    samplePosition: 0.5,
    positionRandom: 0.15,
    pitch: 0,
    pitchRandom: 2,
    grainEnvelope: 'hann',
    reverse: 0.1,
    spread: 0.7,
    mix: 1.0,
    gain: 0.8
  });

  const [sampleInfo, setSampleInfo] = useState({
    loaded: false,
    duration: 0,
    name: '',
    url: '',
    buffer: null // AudioBuffer for waveform
  });

  const [stats, setStats] = useState({
    activeGrains: 0,
    poolUtilization: 0,
    grainsScheduled: 0
  });

  /**
   * Update a parameter
   */
  const updateParam = useCallback((paramName, value) => {
    setParams(prev => ({
      ...prev,
      [paramName]: value
    }));

    // Send to audio engine
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const instrument = audioEngine.instruments?.get(instrumentId);
      if (instrument && typeof instrument.updateParams === 'function') {
        instrument.updateParams({ [paramName]: value });
      }
    }
  }, [instrumentId]);

  /**
   * Update multiple parameters at once
   */
  const updateParams = useCallback((newParams) => {
    setParams(prev => ({
      ...prev,
      ...newParams
    }));

    // Send to audio engine
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const instrument = audioEngine.instruments?.get(instrumentId);
      if (instrument && typeof instrument.updateParams === 'function') {
        instrument.updateParams(newParams);
      }
    }
  }, [instrumentId]);

  /**
   * Load a new sample
   */
  const loadSample = useCallback(async (file) => {
    try {
      console.log('🎵 Loading sample:', file.name);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Get audio engine and context
      const audioEngine = AudioContextService.getAudioEngine();
      const audioContext = AudioContextService.getAudioContext();

      if (!audioEngine) {
        throw new Error('Audio engine not available');
      }

      if (!audioContext) {
        throw new Error('Audio context not available');
      }

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      console.log(`✅ Sample decoded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`);

      // Get instrument and load sample
      const instrument = audioEngine.instruments?.get(instrumentId);
      if (instrument && typeof instrument.loadSample === 'function') {
        instrument.loadSample(audioBuffer);
        console.log('✅ Sample loaded into instrument');
      }

      // Update UI state
      setSampleInfo({
        loaded: true,
        duration: audioBuffer.duration,
        name: file.name,
        url: URL.createObjectURL(file),
        buffer: audioBuffer
      });

    } catch (error) {
      console.error('❌ Failed to load sample:', error);
      alert(`Failed to load sample: ${error.message}`);
    }
  }, [instrumentId]);

  /**
   * Get current stats from instrument
   */
  const updateStats = useCallback(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const instrument = audioEngine.instruments?.get(instrumentId);
      if (instrument && typeof instrument.getStats === 'function') {
        const instrumentStats = instrument.getStats();

        setStats({
          activeGrains: instrumentStats.grainPool?.activeVoices || 0,
          poolUtilization: parseFloat(instrumentStats.grainPool?.utilization) || 0,
          grainsScheduled: instrumentStats.scheduler?.grainsScheduled || 0
        });
      }
    }
  }, [instrumentId]);

  /**
   * Trigger a test grain
   */
  const triggerTest = useCallback(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const instrument = audioEngine.instruments?.get(instrumentId);
      if (instrument && typeof instrument.grainScheduler?.triggerBurst === 'function') {
        instrument.grainScheduler.triggerBurst(5, 0.05);
      }
    }
  }, [instrumentId]);

  /**
   * Trigger a note with specific MIDI pitch
   */
  const triggerNote = useCallback((midiNote, velocity = 100, duration = 1.0) => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const instrument = audioEngine.instruments?.get(instrumentId);
      if (instrument) {
        const when = audioEngine.audioContext.currentTime;
        instrument.noteOn(midiNote, velocity, when);

        // Auto-release after duration
        setTimeout(() => {
          instrument.noteOff(midiNote, when + duration);
        }, duration * 1000);
      }
    }
  }, [instrumentId]);

  /**
   * Trigger a grain at specific sample position
   */
  const triggerGrain = useCallback((position, duration) => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const instrument = audioEngine.instruments?.get(instrumentId);
      if (instrument && instrument.grainScheduler) {
        // Temporarily update sample position
        const originalPosition = instrument.params.samplePosition;
        instrument.updateParams({ samplePosition: position });

        // Trigger burst at this position
        instrument.grainScheduler.triggerBurst(3, duration);

        // Restore original position after burst
        setTimeout(() => {
          instrument.updateParams({ samplePosition: originalPosition });
        }, duration * 1000 + 100);
      }
    }
  }, [instrumentId]);

  /**
   * Load a preset
   */
  const loadPreset = useCallback((preset) => {
    if (preset && preset.params) {
      updateParams(preset.params);
    }
  }, [updateParams]);

  /**
   * Get sample buffer from instrument
   */
  useEffect(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    if (audioEngine) {
      const instrument = audioEngine.instruments?.get(instrumentId);
      if (instrument && instrument.sampleBuffer) {
        setSampleInfo(prev => ({
          ...prev,
          loaded: true,
          duration: instrument.sampleBuffer.duration,
          buffer: instrument.sampleBuffer,
          name: instrument.name || 'Sample'
        }));
      }
    }
  }, [instrumentId]);

  /**
   * Poll stats periodically
   */
  useEffect(() => {
    const interval = setInterval(updateStats, 100); // Update stats every 100ms
    return () => clearInterval(interval);
  }, [updateStats]);

  return {
    params,
    updateParam,
    updateParams,
    sampleInfo,
    loadSample,
    stats,
    triggerTest,
    triggerNote,
    triggerGrain,
    loadPreset
  };
};
