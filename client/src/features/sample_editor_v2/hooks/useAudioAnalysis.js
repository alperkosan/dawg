import { useState, useCallback } from 'react';
import { MLAudioAnalysis } from '../../../lib/audio/MLAudioAnalysis';

export const useAudioAnalysis = () => {
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const analyzeBuffer = useCallback(async (buffer) => {
    if (!buffer) {
      setError('No buffer provided');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await MLAudioAnalysis.analyzeBuffer(buffer);
      setAnalysis(result);
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
      console.error('Audio analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const resetAnalysis = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  return {
    analysis,
    isAnalyzing,
    error,
    analyzeBuffer,
    resetAnalysis
  };
};