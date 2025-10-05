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
import { AudioRenderer } from '@/lib/audio/AudioRenderer';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { v4 as uuidv4 } from 'uuid';

export const useAudioRenderer = () => {
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  const instruments = useInstrumentsStore(state => state.instruments);
  const handleAddNewInstrument = useInstrumentsStore(state => state.handleAddNewInstrument);
  const addClip = useArrangementWorkspaceStore(state => state.addClip);

  // Memoize renderer to prevent re-initialization on every render
  const renderer = useMemo(() => new AudioRenderer(), []);

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
  }, [instruments]);

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

      // Get instruments map
      const instrumentsMap = new Map(instruments.map(inst => [inst.id, inst]));

      // Render pattern
      const renderedBuffer = await renderer.renderPatternToAudio(
        pattern,
        instrumentsMap,
        {
          bpm: options.bpm || 140,
          duration: options.duration,
          includeEffects: options.includeEffects !== false,
          normalize: options.normalize !== false
        }
      );

      setRenderProgress(50);

      // Add to project if requested
      if (options.addToProject !== false) {
        await importRenderedAudio(renderedBuffer, {
          name: options.name || `${pattern.name} (Rendered)`,
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
      console.error('Pattern render failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsRendering(false);
      setRenderProgress(0);
    }
  }, [instruments]);

  /**
   * Render an arrangement track to audio
   */
  const renderTrack = useCallback(async (trackId, clips, patterns, options = {}) => {
    setIsRendering(true);
    setRenderProgress(0);

    try {
      // Get instruments map
      const instrumentsMap = new Map(instruments.map(inst => [inst.id, inst]));

      // Filter clips for this track
      const trackClips = clips.filter(clip => clip.trackId === trackId);

      // Render track
      const renderedBuffer = await renderer.renderTrackToAudio(
        trackClips,
        instrumentsMap,
        patterns,
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
          startTime: options.startTime || 0
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
  }, [instruments]);

  /**
   * Import rendered audio buffer to project as new instrument
   */
  const importRenderedAudio = useCallback(async (audioBuffer, options = {}) => {
    try {
      // Convert AudioBuffer to Blob
      const blob = renderer.audioBufferToWav(audioBuffer);
      const url = URL.createObjectURL(blob);

      // Get audio engine to load the audio buffer
      const audioEngine = AudioContextService.getAudioEngine();
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
  }, [handleAddNewInstrument, addClip]);

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
