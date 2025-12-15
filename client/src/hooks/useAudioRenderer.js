/**
 * useAudioRenderer Hook
 *
 * Provides audio rendering functionality:
 * - Render samples with effects
 * - Render patterns to audio
 * - Render arrangement tracks
 * - Import rendered audio to project
 */

import { useState, useCallback, useMemo } from 'react';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useArrangementWorkspaceStore } from '@/store/useArrangementWorkspaceStore';
import { useMixerStore } from '@/store/useMixerStore';
import { RenderEngine } from '@/lib/audio/RenderEngine.js';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
import { v4 as uuidv4 } from 'uuid';

export const useAudioRenderer = () => {
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  const instruments = useInstrumentsStore(state => state.instruments);
  const handleAddNewInstrument = useInstrumentsStore(state => state.handleAddNewInstrument);
  const addClip = useArrangementWorkspaceStore(state => state.addClip);

  // Memoize renderer to prevent re-initialization on every render
  const renderer = useMemo(() => new RenderEngine(), []);

  /**
   * Helper: Prepare pattern data with full context (instruments, mixer tracks)
   * RenderEngine expects a self-contained object with all necessary data.
   */
  const preparePatternData = useCallback((pattern, instrumentsList, mixerTracksList) => {
    const patternData = {
      id: pattern.id,
      name: pattern.name,
      data: {}, // Grouped notes
      instruments: {},
      mixerTracks: {}
    };

    // Group notes by instrument
    if (pattern.notes) {
      for (const note of pattern.notes) {
        if (!patternData.data[note.instrumentId]) {
          patternData.data[note.instrumentId] = [];
        }
        patternData.data[note.instrumentId].push(note);
      }
    }

    // Populate instruments and mixer tracks
    for (const inst of instrumentsList) {
      patternData.instruments[inst.id] = inst;
      if (inst.mixerTrackId) {
        const track = mixerTracksList.find(t => t.id === inst.mixerTrackId);
        if (track) {
          patternData.mixerTracks[track.id] = track;
        }
      }
    }

    // Add master track
    const masterTrack = mixerTracksList.find(t => t.id === 'master');
    if (masterTrack) {
      patternData.mixerTracks['master'] = masterTrack;
    }

    return patternData;
  }, []);

  /**
   * Render an audio sample with effects
   */
  const renderSample = useCallback(async (sampleId, options = {}) => {
    setIsRendering(true);
    setRenderProgress(0);

    try {
      // Get instrument
      const instrument = instruments.find(inst => inst.id === sampleId);
      if (!instrument || !instrument.audioBuffer) {
        throw new Error('Sample not found or has no audio buffer');
      }

      // Render with effects
      const renderedBuffer = await renderer.renderSampleWithEffects(
        instrument.audioBuffer,
        {
          fadeIn: options.fadeIn || 0,
          fadeOut: options.fadeOut || 0,
          gain: options.gain || 0,
          playbackRate: options.playbackRate || 1.0,
          sampleOffset: options.sampleOffset || 0,
          duration: options.duration,
          effects: options.effects || []
        }
      );

      setRenderProgress(50);

      // Add to project if requested
      if (options.addToProject !== false) {
        await importRenderedAudio(renderedBuffer, {
          name: options.name || `${instrument.name} (Rendered)`,
          addToArrangement: options.addToArrangement,
          trackId: options.trackId,
          startTime: options.startTime
        });
      }

      setRenderProgress(100);

      return {
        success: true,
        audioBuffer: renderedBuffer,
        duration: renderedBuffer.duration
      };

    } catch (error) {
      console.error('Sample render failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsRendering(false);
      setRenderProgress(0);
    }
  }, [instruments, renderer]);

  /**
   * Render a pattern to audio
   */
  const renderPattern = useCallback(async (patternId, patterns, options = {}) => {
    setIsRendering(true);
    setRenderProgress(0);

    try {
      // Get pattern
      const pattern = patterns[patternId];
      if (!pattern) {
        throw new Error('Pattern not found');
      }

      // Prepare full pattern data
      const mixerTracks = useMixerStore.getState().tracks;
      const patternData = preparePatternData(pattern, instruments, mixerTracks);

      // Render pattern
      const result = await renderer.renderPattern(
        patternData,
        {
          sampleRate: 48000, // Default high quality
          length: options.duration ? (options.duration * 60 / (options.bpm || 140)) * 48000 : null,
          includeEffects: options.includeEffects !== false,
          // RenderEngine doesn't support 'normalize' option in renderPattern yet, 
          // but we can add post-processing if needed. 
          // For now, we rely on auto-gain.
        }
      );

      let renderedBuffer = result.audioBuffer;

      // Apply normalization if requested (using the utility we added)
      if (options.normalize !== false) {
        renderedBuffer = renderer._normalizeBuffer(renderedBuffer);
      }

      setRenderProgress(50);

      // Add to project if requested
      if (options.addToProject !== false) {
        await importRenderedAudio(renderedBuffer, {
          name: options.name || `${pattern.name} (Rendered)`,
          addToArrangement: options.addToArrangement,
          trackId: options.trackId,
          startTime: options.startTime,
          bpm: options.bpm
        });
      }

      setRenderProgress(100);

      return {
        success: true,
        audioBuffer: renderedBuffer,
        duration: renderedBuffer.duration
      };

    } catch (error) {
      console.error('Pattern render failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsRendering(false);
      setRenderProgress(0);
    }
  }, [instruments, renderer, preparePatternData]);

  /**
   * Render an arrangement track to audio
   */
  const renderTrack = useCallback(async (trackId, clips, patterns, options = {}) => {
    setIsRendering(true);
    setRenderProgress(0);

    try {
      // Get instruments map for quick lookup
      const instrumentsMap = new Map(instruments.map(inst => [inst.id, inst]));

      // Get mixer tracks
      const mixerTracks = useMixerStore.getState().tracks;

      // Filter clips for this track
      const trackClips = clips.filter(clip => clip.trackId === trackId);

      // Enrich patterns with full context
      const enrichedPatterns = {};
      for (const clip of trackClips) {
        if (clip.type === 'pattern' && clip.patternId) {
          const pattern = patterns[clip.patternId];
          if (pattern && !enrichedPatterns[clip.patternId]) {
            enrichedPatterns[clip.patternId] = preparePatternData(pattern, instruments, mixerTracks);
          }
        }
      }

      // Render track
      const renderedBuffer = await renderer.renderTrackToAudio(
        trackClips,
        instrumentsMap,
        enrichedPatterns,
        {
          bpm: options.bpm || 140,
          startTime: options.startTime || 0,
          endTime: options.endTime,
          includeEffects: options.includeEffects !== false,
          normalize: options.normalize !== false
        }
      );

      setRenderProgress(50);

      // Add to project if requested
      if (options.addToProject !== false) {
        await importRenderedAudio(renderedBuffer, {
          name: options.name || `Track ${trackId} (Rendered)`,
          addToArrangement: options.addToArrangement,
          trackId: options.newTrackId || trackId,
          startTime: options.startTime || 0,
          bpm: options.bpm
        });
      }

      setRenderProgress(100);

      return {
        success: true,
        audioBuffer: renderedBuffer,
        duration: renderedBuffer.duration
      };

    } catch (error) {
      console.error('Track render failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsRendering(false);
      setRenderProgress(0);
    }
  }, [instruments, renderer, preparePatternData]);

  /**
   * Import rendered audio buffer to project as new instrument
   */
  const importRenderedAudio = useCallback(async (audioBuffer, options = {}) => {
    try {
      // Convert AudioBuffer to Blob
      const blob = renderer.audioBufferToWav(audioBuffer);
      const url = URL.createObjectURL(blob);

      // Get audio engine to load the audio buffer
      const audioEngine = AudioEngineGlobal.get();
      if (!audioEngine) {
        throw new Error('Audio engine not available');
      }

      // Create instrument data
      const instrumentData = {
        name: options.name || 'Rendered Audio',
        url: url,
        type: 'sample',
        audioBuffer: audioBuffer // Pass the already-rendered buffer
      };

      // Add to instruments store
      handleAddNewInstrument(instrumentData);

      // Get the newly added instrument ID
      const newInstrument = useInstrumentsStore.getState().instruments.find(
        inst => inst.name === instrumentData.name
      );

      // Add to arrangement if requested
      if (options.addToArrangement && newInstrument) {
        const durationInBeats = (audioBuffer.duration * (options.bpm || 140)) / 60;

        addClip({
          type: 'audio',
          sampleId: newInstrument.id,
          trackId: options.trackId || 'track-1',
          startTime: options.startTime || 0,
          duration: durationInBeats,
          name: instrumentData.name,
          fadeIn: 0,
          fadeOut: 0,
          gain: 0,
          playbackRate: 1.0,
          sampleOffset: 0
        });
      }

      console.log(`✅ Rendered audio imported: ${instrumentData.name}`);

      return {
        success: true,
        instrumentId: newInstrument?.id,
        instrumentName: instrumentData.name
      };

    } catch (error) {
      console.error('Failed to import rendered audio:', error);
      throw error;
    }
  }, [handleAddNewInstrument, addClip, renderer]);

  return {
    renderSample,
    renderPattern,
    renderTrack,
    importRenderedAudio,
    isRendering,
    renderProgress
  };
};

export default useAudioRenderer;
