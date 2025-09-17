import * as Tone from 'tone';
import { PlaybackAnimatorService } from './PlaybackAnimatorService';
import { calculatePatternLoopLength, calculateArrangementLoopLength } from '../utils/patternUtils';

/**
 * @file UnifiedTimeManager.js - NİHAİ SÜRÜM
 * @description Tüm playhead, timeline ve transport hesaplamalarını
 * merkezi olarak yöneten, ses motoruyla tam senkronize ve profesyonel
 * standartlarda hassasiyet sağlayan sistem.
 */
class UnifiedTimeManager {
  constructor(debug = false) {
    this.debug = debug;
    this.animationFrameId = null;
    this.isRunning = false;

    this.loopInfo = {
      lengthInSteps: 64, // Varsayılan 4 bar
      lengthInSeconds: 0,
    };

    // Dış dünyaya (AudioEngine) raporlama yapmak için callback'ler
    this.onPositionUpdate = null;
    this.onLoopInfoUpdate = null;
  }

  /**
   * Çalma modu ve mevcut verilere göre döngü uzunluğunu merkezi olarak hesaplar
   * ve bu bilgiyi hem Tone.Transport'a hem de AudioEngine'e bildirir.
   */
  calculateLoopInfo(mode, activePatternId, arrangementData) {
    let lengthInSteps = 64; // Varsayılan

    if (mode === 'pattern' && activePatternId && arrangementData?.patterns) {
      const pattern = arrangementData.patterns[activePatternId];
      if (pattern) {
        lengthInSteps = calculatePatternLoopLength(pattern);
      }
    } else if (mode === 'song' && arrangementData?.clips) {
      lengthInSteps = calculateArrangementLoopLength(arrangementData.clips);
    }
    
    // Saniye hesaplaması için Tone.js'in kendi birim çevirmesini kullanmak
    // BPM değişikliklerinden sonra bile hassasiyeti korur.
    const lengthInSeconds = Tone.Time('16n').toSeconds() * lengthInSteps;

    this.loopInfo = {
      lengthInSteps,
      lengthInSeconds,
    };

    // Tone.js'in döngü sınırlarını saniye cinsinden ayarla
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = lengthInSeconds;
    Tone.Transport.loop = true;

    // Hesaplama bittiğinde AudioEngine'i bilgilendir
    this.onLoopInfoUpdate?.({ lengthInSteps });

    if (this.debug) {
      console.log(`[TimeManager] Loop Info Updated [${mode}]:`, {
        steps: lengthInSteps,
        seconds: lengthInSeconds.toFixed(3),
      });
    }
  }

  /**
   * Yüksek hassasiyetli animasyon döngüsü. Saniyede 60 kez çalışır.
   */
  _startAnimationLoop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    
    const updateLoop = () => {
      if (!this.isRunning || this.loopInfo.lengthInSeconds === 0) {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        return;
      }

      // TEK GERÇEKLİK KAYNAĞI: Tone.Transport.seconds
      const transportSeconds = Tone.Transport.seconds;
      
      // Hem progress hem de BBT, bu tek kaynaktan türetilir. Bu, kaymayı imkansız hale getirir.
      const progress = transportSeconds / this.loopInfo.lengthInSeconds;
      const position = this._calculateBBTPosition(transportSeconds);
      
      // Gerekli yerlere bilgiyi yayınla
      this.onPositionUpdate?.(position);
      PlaybackAnimatorService.publish(progress % 1); // Her zaman 0-1 aralığında kalmasını garantile

      this.animationFrameId = requestAnimationFrame(updateLoop);
    };
    updateLoop();
  }

  /**
   * Transport zamanını Bar:Beat:Tick formatına çevirir.
   * Tone.js'in kendi hassas çeviri aracını kullanır.
   */
  _calculateBBTPosition(transportSeconds) {
    const positionString = Tone.Time(transportSeconds).toBarsBeatsSixteenths();
    const parts = positionString.split(':');
    const bars = parseInt(parts[0], 10) + 1;
    const beats = parseInt(parts[1], 10) + 1;
    const ticks = Math.round(parseFloat(parts[2])).toString().padStart(2, '0');

    return {
      bars,
      beats,
      ticks,
      formatted: `${bars}:${beats}:${ticks}`
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
    this.onPositionUpdate?.({ bars: 1, beats: 1, ticks: '00', formatted: '1:1:00' });
    PlaybackAnimatorService.publish(0);
  }

  switchMode(newMode, patternId, arrangementData) {
    const currentProgress = Tone.Transport.seconds / this.loopInfo.lengthInSeconds;
    this.calculateLoopInfo(newMode, patternId, arrangementData);
    const newSeconds = (currentProgress || 0) * this.loopInfo.lengthInSeconds;
    Tone.Transport.seconds = newSeconds;
  }
  
  /**
   * === YENİ FONKSİYON ===
   * Transport'u, bar numarasına göre hesaplanan saniye cinsinden
   * tam konuma anında taşır.
   * @param {number} barNumber - Gidilecek bar numarası (1'den başlar).
   */
  jumpToBar(barNumber) {
    // Tone.js'in "Bar:Beat:Sixteenth" formatını kullanarak
    // hedef zamanı oluşturuyoruz.
    const time = Tone.Time(`${barNumber - 1}:0:0`);
    // Transport'un saniye cinsinden pozisyonunu doğrudan ayarlıyoruz.
    Tone.Transport.seconds = time.toSeconds();

    // Debug logu
    if (this.debug) {
      console.log(`[TimeManager] Jump to Bar: ${barNumber} (-> ${time.toSeconds().toFixed(2)}s)`);
    }
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

// Singleton instance: Projenin her yerinden aynı TimeManager'a erişilir.
export const timeManager = new UnifiedTimeManager(true);