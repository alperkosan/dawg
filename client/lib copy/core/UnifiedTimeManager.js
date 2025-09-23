import * as Tone from 'tone';
import { PlaybackAnimatorService } from './PlaybackAnimatorService';
import { calculatePatternLoopLength, calculateArrangementLoopLength } from '../utils/patternUtils';

class UnifiedTimeManager {
  constructor(debug = false) {
    this.debug = debug;
    this.animationFrameId = null;
    this.isRunning = false;

    this.loopInfo = {
      lengthInSteps: 64,
      lengthInSeconds: 0,
    };

    this.onPositionUpdate = null;
    this.onLoopInfoUpdate = null;
  }

  calculateLoopInfo(mode, activePatternId, arrangementData) {
    let lengthInSteps = 64;
    if (mode === 'pattern' && activePatternId && arrangementData?.patterns) {
      const pattern = arrangementData.patterns[activePatternId];
      if (pattern) lengthInSteps = calculatePatternLoopLength(pattern);
    } else if (mode === 'song' && arrangementData?.clips) {
      lengthInSteps = calculateArrangementLoopLength(arrangementData.clips);
    }
    
    const lengthInSeconds = Tone.Time('16n').toSeconds() * lengthInSteps;
    // ONARIM: 'lengthInSecondsen' yazım hatası düzeltildi.
    this.loopInfo = { lengthInSteps, lengthInSeconds };
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = lengthInSeconds;
    Tone.Transport.loop = true;
    this.onLoopInfoUpdate?.({ lengthInSteps });
  }

  _startAnimationLoop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    
    const updateLoop = () => {
      if (!this.isRunning || this.loopInfo.lengthInSeconds === 0) {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        return;
      }

      const transportSeconds = Tone.Transport.seconds;
      const sixteenthNoteDuration = Tone.Time('16n').toSeconds();
      const stepPosition = sixteenthNoteDuration > 0 ? transportSeconds / sixteenthNoteDuration : 0;
      const position = this._calculateBBTPosition(transportSeconds);
      
      this.onPositionUpdate?.(position, stepPosition);
      PlaybackAnimatorService.publish(transportSeconds / this.loopInfo.lengthInSeconds % 1);

      this.animationFrameId = requestAnimationFrame(updateLoop);
    };
    updateLoop();
  }

  _calculateBBTPosition(transportSeconds) {
    const positionString = Tone.Time(transportSeconds).toBarsBeatsSixteenths();
    const parts = positionString.split(':');
    const bars = parseInt(parts[0], 10) + 1;
    const beats = parseInt(parts[1], 10) + 1;
    const ticks = Math.round(parseFloat(parts[2])).toString().padStart(2, '0');

    return { bars, beats, ticks, formatted: `${bars}:${beats}:${ticks}` };
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
    this.onPositionUpdate?.({ bars: 1, beats: 1, ticks: '00', formatted: '1:1:00' }, 0);
    PlaybackAnimatorService.publish(0);
  }

  switchMode(newMode, patternId, arrangementData) {
    const currentProgress = this.loopInfo.lengthInSeconds > 0 ? Tone.Transport.seconds / this.loopInfo.lengthInSeconds : 0;
    this.calculateLoopInfo(newMode, patternId, arrangementData);
    const newSeconds = (currentProgress || 0) * this.loopInfo.lengthInSeconds;
    Tone.Transport.seconds = newSeconds;
  }
  
  jumpToBar(barNumber) {
    const time = Tone.Time(`${barNumber - 1}:0:0`);
    Tone.Transport.seconds = time.toSeconds();
  }

  jumpToPercent(percent) {
    const targetSeconds = this.loopInfo.lengthInSeconds * percent;
    Tone.Transport.seconds = targetSeconds;
  }

  dispose() {
    this.stop();
    this.onPositionUpdate = null;
    this.onLoopInfoUpdate = null;
  }
}

export const timeManager = new UnifiedTimeManager(true);

