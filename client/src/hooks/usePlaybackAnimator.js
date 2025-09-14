import { useEffect, useRef } from 'react';
import { PlaybackAnimatorService } from '../lib/core/PlaybackAnimatorService';

export const usePlaybackAnimator = (elementRef, options = {}) => {
  const { fullWidth, offset = 0, smoothing = false } = options;
  const lastProgressRef = useRef(0);
  const smoothProgressRef = useRef(0);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!elementRef?.current || typeof fullWidth !== 'number' || fullWidth <= 0) return;

    const handleProgressUpdate = (progress) => {
      if (!elementRef.current) return;
      
      const isLoopRestart = progress < lastProgressRef.current && lastProgressRef.current > 0.9;

      if (isLoopRestart) {
        smoothProgressRef.current = progress;
      }
      
      lastProgressRef.current = progress;

      const updatePosition = () => {
          if (!elementRef.current) return;
          
          let currentProgress = progress;
          if (smoothing && !isLoopRestart) {
              const smoothFactor = 0.2;
              smoothProgressRef.current += (progress - smoothProgressRef.current) * smoothFactor;
              currentProgress = smoothProgressRef.current;
          } else {
              smoothProgressRef.current = progress;
          }

          const xPosition = (currentProgress * fullWidth) + offset;
          elementRef.current.style.transform = `translateX(${xPosition}px)`;
          
          if (smoothing && Math.abs(currentProgress - progress) > 0.001) {
            animationRef.current = requestAnimationFrame(updatePosition);
          }
      };
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(updatePosition);
    };

    PlaybackAnimatorService.subscribe(handleProgressUpdate);

    return () => {
      PlaybackAnimatorService.unsubscribe(handleProgressUpdate);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [fullWidth, offset, smoothing, elementRef]);

  return {};
};