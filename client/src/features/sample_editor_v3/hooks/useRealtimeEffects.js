import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeEffectsEngine } from '../../../lib/audio/RealtimeEffects';

export const useRealtimeEffects = (buffer) => {
  const [engine, setEngine] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeEffects, setActiveEffects] = useState(new Set());
  const engineRef = useRef(null);

  // Initialize engine when buffer changes
  useEffect(() => {
    if (!buffer) return;

    // Dispose previous engine
    if (engineRef.current) {
      engineRef.current.dispose();
    }

    // Create new engine
    const newEngine = new RealtimeEffectsEngine(buffer);
    newEngine.onPlaybackStop = () => setIsPlaying(false);
    
    engineRef.current = newEngine;
    setEngine(newEngine);
    setActiveEffects(new Set());

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, [buffer]);

  const addEffect = useCallback((name, effectNode) => {
    if (!engine) return;
    
    engine.addEffect(name, effectNode);
    setActiveEffects(prev => new Set([...prev, name]));
  }, [engine]);

  const removeEffect = useCallback((name) => {
    if (!engine) return;
    
    engine.removeEffect(name);
    setActiveEffects(prev => {
      const newSet = new Set(prev);
      newSet.delete(name);
      return newSet;
    });
  }, [engine]);

  const toggleEffect = useCallback((name) => {
    if (!engine) return;
    
    engine.toggleEffect(name);
  }, [engine]);

  const updateEffectParam = useCallback((name, param, value) => {
    if (!engine) return;
    
    engine.updateEffectParam(name, param, value);
  }, [engine]);

  const togglePlayback = useCallback(() => {
    if (!engine) return false;
    
    const playing = engine.play();
    setIsPlaying(playing);
    return playing;
  }, [engine]);

  const stopPlayback = useCallback(() => {
    if (!engine) return;
    
    engine.stop();
    setIsPlaying(false);
  }, [engine]);

  return {
    engine,
    isPlaying,
    activeEffects,
    addEffect,
    removeEffect,
    toggleEffect,
    updateEffectParam,
    togglePlayback,
    stopPlayback
  };
};