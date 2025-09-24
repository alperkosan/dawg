// hooks/useSmoothPlayhead.js
// CSS transition tabanlı smooth playhead animasyonu
import { useRef, useEffect, useCallback } from 'react';
import { usePlayheadTracking } from './useEngineState';

export const useSmoothPlayhead = (stepWidth = 16) => {
  const playheadRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const animationRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);

  const { currentStep, playbackState, isPlaying, getTransport } = usePlayheadTracking();

  // CSS transition ile smooth hareket
  const updatePlayheadSmooth = useCallback((targetStep, isImmediate = false) => {
    const playhead = playheadRef.current;
    const container = scrollContainerRef.current;
    if (!playhead || !container) return;

    const targetX = targetStep * stepWidth;

    // Immediate güncelleme (stop/jump durumları için)
    if (isImmediate) {
      playhead.style.transition = 'none';
      playhead.style.transform = `translateX(${targetX}px)`;
      // CSS'i force reflow için bir sonraki frame'de transition'ı geri aç
      requestAnimationFrame(() => {
        if (playhead) {
          playhead.style.transition = 'transform 0.1s linear';
        }
      });
    } else {
      // Smooth transition
      playhead.style.transition = 'transform 0.1s linear';
      playhead.style.transform = `translateX(${targetX}px)`;
    }

    // Auto-scroll logic
    if (playbackState === 'playing') {
      const containerWidth = container.offsetWidth;
      const scrollLeft = container.scrollLeft;
      const playheadRightEdge = targetX + stepWidth;

      if (playheadRightEdge > scrollLeft + containerWidth || targetX < scrollLeft) {
        const targetScrollLeft = targetX - containerWidth / 2;
        container.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth'
        });
      }
    }
  }, [stepWidth, playbackState]);

  // RequestAnimationFrame tabanlı interpolation
  const startInterpolation = useCallback((startStep, targetStep, duration = 100) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = performance.now();
    const stepDiff = targetStep - startStep;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (easeOutQuart)
      const easedProgress = 1 - Math.pow(1 - progress, 4);
      const currentStepInterpolated = startStep + (stepDiff * easedProgress);

      updatePlayheadSmooth(currentStepInterpolated, false);

      if (progress < 1 && isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [updatePlayheadSmooth, isPlaying]);

  // High-frequency updates için throttled güncelleme
  const throttledUpdate = useCallback((step) => {
    const now = performance.now();
    if (now - lastUpdateTimeRef.current > 16.67) { // 60fps max
      updatePlayheadSmooth(step, false);
      lastUpdateTimeRef.current = now;
    }
  }, [updatePlayheadSmooth]);

  // Playback state değişikliklerini dinle
  useEffect(() => {
    if (playbackState === 'stopped') {
      updatePlayheadSmooth(0, true); // Immediate reset
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }
  }, [playbackState, updatePlayheadSmooth]);

  // BPM değişikliklerini dinle ve smooth transition sağla
  useEffect(() => {
    const transport = getTransport();

    if (transport) {
      const handleBpmChange = (data) => {
        const { bpm, oldBpm, wasPlaying } = data;
        console.log(`🎵 Smooth playhead: BPM changed ${oldBpm} → ${bpm}, playing: ${wasPlaying}`);

        if (wasPlaying) {
          // BPM değişiminde playhead'in smooth transition'ını ayarla
          // Mevcut pozisyonu koru, sadece animasyon hızını değiştir
          const playhead = playheadRef.current;
          if (playhead) {
            // Transition duration'ı yeni BPM'e göre ayarla
            const newTransitionDuration = Math.max(0.05, 0.2 * (120 / bpm)); // BPM'e göre scaled
            playhead.style.transition = `transform ${newTransitionDuration}s linear`;
            console.log(`🎵 Adjusted playhead transition duration to ${newTransitionDuration}s for BPM ${bpm}`);
          }
        }
      };

      transport.on('bpm', handleBpmChange);

      return () => {
        transport.off('bpm', handleBpmChange);
      };
    }
  }, [getTransport]);

  // Step değişikliklerini dinle - throttled update
  useEffect(() => {
    if (isPlaying) {
      throttledUpdate(currentStep);
    } else {
      updatePlayheadSmooth(currentStep, true);
    }
  }, [currentStep, isPlaying, throttledUpdate, updatePlayheadSmooth]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    playheadRef,
    scrollContainerRef,
    updatePlayheadSmooth,
    startInterpolation
  };
};

// Pure CSS animation approach
export const useCSSAnimatedPlayhead = (stepWidth = 16, loopLength = 64) => {
  const playheadRef = useRef(null);
  const { playbackState, isPlaying } = usePlayheadTracking();

  const startCSSAnimation = useCallback((bpm = 120) => {
    const playhead = playheadRef.current;
    if (!playhead) return;

    // Calculate animation duration based on BPM
    const stepsPerSecond = (bpm / 60) * 4; // 4 steps per beat
    const totalDuration = loopLength / stepsPerSecond;
    const totalDistance = loopLength * stepWidth;

    playhead.style.animation = `playheadMove ${totalDuration}s linear infinite`;
    playhead.style.setProperty('--playhead-distance', `${totalDistance}px`);
  }, [loopLength, stepWidth]);

  const stopCSSAnimation = useCallback(() => {
    const playhead = playheadRef.current;
    if (!playhead) return;

    playhead.style.animation = 'none';
    playhead.style.transform = 'translateX(0px)';
  }, []);

  useEffect(() => {
    if (isPlaying && playbackState === 'playing') {
      startCSSAnimation();
    } else {
      stopCSSAnimation();
    }
  }, [isPlaying, playbackState, startCSSAnimation, stopCSSAnimation]);

  return {
    playheadRef,
    startCSSAnimation,
    stopCSSAnimation
  };
};