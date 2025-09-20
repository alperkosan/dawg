import { useState, useCallback } from 'react';
import { BufferProcessor } from '../../../lib/audio/BufferProcessing';

export const useBufferProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedBuffer, setProcessedBuffer] = useState(null);
  const [error, setError] = useState(null);

  const applyFadeIn = useCallback(async (buffer, fadeTimeMs) => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await BufferProcessor.fadeIn(buffer, fadeTimeMs);
      setProcessedBuffer(result);
      return result;
    } catch (err) {
      setError(`Fade in failed: ${err.message}`);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const applyFadeOut = useCallback(async (buffer, fadeTimeMs) => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await BufferProcessor.fadeOut(buffer, fadeTimeMs);
      setProcessedBuffer(result);
      return result;
    } catch (err) {
      setError(`Fade out failed: ${err.message}`);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const applyGain = useCallback(async (buffer, gainDb) => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await BufferProcessor.applyGain(buffer, gainDb);
      setProcessedBuffer(result);
      return result;
    } catch (err) {
      setError(`Gain processing failed: ${err.message}`);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const resetProcessor = useCallback(() => {
    setProcessedBuffer(null);
    setError(null);
  }, []);

  return {
    isProcessing,
    processedBuffer,
    error,
    applyFadeIn,
    applyFadeOut,
    applyGain,
    resetProcessor
  };
};