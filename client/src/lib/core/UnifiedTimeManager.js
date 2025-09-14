import * as Tone from 'tone';
import { PlaybackAnimatorService } from './PlaybackAnimatorService';

/**
 * @file UnifiedTimeManager.js
 * @description Tüm playhead, timeline ve transport hesaplamalarını
 * merkezi olarak yöneten ve DAW standartlarına uygun hassasiyet sağlayan sistem.
 */
class UnifiedTimeManager {
  constructor(debug = false) {
    this.debug = debug;
    this.animationFrameId = null;
    this.isRunning = false;

    this.loopInfo = {
      startBars: 0,
      endBars: 4,
      lengthInSteps: 64,
      lengthInSeconds: 0,
    };

    // Callbacks
    this.onPositionUpdate = null;
    this.onProgressUpdate = null;
  }

  /**
   * Playback başlatıldığında veya mode değiştirildiğinde loop bilgilerini hassas şekilde hesaplar.
   */
  calculateLoopInfo(mode, activePatternId, arrangementData) {
    let lengthInBars = 4; // Varsayılan

    if (mode === 'pattern' && activePatternId && arrangementData?.patterns) {
      const pattern = arrangementData.patterns[activePatternId];
      if (pattern) {
        lengthInBars = this._calculatePatternLength(pattern);
      }
    } else if (mode === 'song' && arrangementData?.clips) {
      lengthInBars = this._calculateArrangementLength(arrangementData.clips);
    }

    const lengthInSteps = lengthInBars * 16;
    const stepDurationSeconds = Tone.Time('16n').toSeconds();
    const lengthInSeconds = lengthInSteps * stepDurationSeconds;

    this.loopInfo = {
      startBars: 0,
      endBars: lengthInBars,
      lengthInSteps,
      lengthInSeconds,
    };

    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = Tone.Time('16n').toSeconds() * lengthInSteps;
    Tone.Transport.loop = true;

    if (this.debug) {
      console.log(`[TimeManager] Loop Info [${mode}]:`, {
        bars: lengthInBars,
        steps: lengthInSteps,
        seconds: lengthInSeconds.toFixed(3),
      });
    }
  }

  _calculatePatternLength(pattern) {
    let maxStep = 0;
    Object.values(pattern.data || {}).forEach(notes => {
      if (Array.isArray(notes)) {
        notes.forEach(note => {
          maxStep = Math.max(maxStep, note.time || 0);
        });
      }
    });
    // En yakın üst bar'a yuvarla (minimum 4 bar)
    return Math.max(4, Math.ceil((maxStep + 1) / 16) * 4);
  }

  _calculateArrangementLength(clips) {
    let maxBar = 0;
    clips.forEach(clip => {
      const clipEnd = (clip.startTime || 0) + (clip.duration || 1);
      maxBar = Math.max(maxBar, clipEnd);
    });
     // En yakın üst 4'lü bar'a yuvarla (minimum 4 bar)
    return Math.max(4, Math.ceil(maxBar / 4) * 4);
  }

  /**
   * Yüksek hassasiyetli animasyon döngüsü.
   */
  _startAnimationLoop() {
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
    }
    const updateLoop = () => {
      if (!this.isRunning) return;

      const progress = Tone.Transport.progress;
      const position = this._calculateBBTPosition();
      
      this.onPositionUpdate?.(position);
      this.onProgressUpdate?.(progress);
      PlaybackAnimatorService.publish(progress);

      this.animationFrameId = requestAnimationFrame(updateLoop);
    };
    updateLoop();
  }

  /**
   * Transport zamanını Bar:Beat:Tick formatına çevirir.
   */
  _calculateBBTPosition() {
    const ticks = Tone.Transport.ticks;
    const timeSignature = Tone.Transport.timeSignature;
    const ppq = Tone.Transport.PPQ;

    const totalBeats = ticks / ppq;
    const bars = Math.floor(totalBeats / timeSignature);
    const beats = Math.floor(totalBeats % timeSignature);
    const sixteenths = Math.floor(((totalBeats % 1) * 16));

    return {
      bars: bars + 1,
      beats: beats + 1,
      sixteenths: sixteenths + 1,
      formatted: `${bars + 1}:${beats + 1}:${sixteenths.toString().padStart(2, '0')}`
    };
  }

  start(mode, patternId, arrangementData) {
    this.calculateLoopInfo(mode, patternId, arrangementData);
    this.isRunning = true;
    this._startAnimationLoop();
  }

  pause() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  resume() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._startAnimationLoop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.onPositionUpdate?.({ bars: 1, beats: 1, sixteenths: 0, formatted: '1:1:00' });
    this.onProgressUpdate?.(0);
    PlaybackAnimatorService.publish(0);
  }

  switchMode(newMode, patternId, arrangementData) {
    const currentProgress = Tone.Transport.progress;
    this.calculateLoopInfo(newMode, patternId, arrangementData);
    const newSeconds = currentProgress * this.loopInfo.lengthInSeconds;
    Tone.Transport.seconds = newSeconds;
  }
  
  jumpToBar(barNumber) {
    const targetSeconds = ((barNumber - 1) * Tone.Transport.timeSignature * 60) / Tone.Transport.bpm.value;
    Tone.Transport.seconds = targetSeconds;
  }

  jumpToPercent(percent) {
    const targetSeconds = this.loopInfo.lengthInSeconds * percent;
    Tone.Transport.seconds = targetSeconds;
  }

  dispose() {
    this.stop();
    this.onPositionUpdate = null;
    this.onProgressUpdate = null;
  }
}

// Singleton instance
export const timeManager = new UnifiedTimeManager(true); // Debug modu açık