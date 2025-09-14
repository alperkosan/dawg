import * as Tone from 'tone';
import { PlaybackAnimatorService } from './PlaybackAnimatorService';
import { calculatePatternLoopLength, calculateArrangementLoopLength } from '../utils/patternUtils';

/**
 * @file UnifiedTimeManager.js - LATENCY FIX
 * @description Audio latency kompanzasyonlu zaman yönetimi
 */
class UnifiedTimeManager {
  constructor(debug = false) {
    this.debug = debug;
    this.animationFrameId = null;
    this.isRunning = false;
    this.isInitialized = false;

    // Loop bilgileri
    this.loopInfo = {
      lengthInSeconds: 0,
      lengthInSteps: 64,
      mode: 'pattern',
      activePatternId: null
    };

    // DÜZELTME: Latency kompanzasyonu
    this.latencyCompensation = 0;
    this.audioStartTime = 0; // Gerçek audio başlangıç zamanı
    this.transportStartTime = 0; // Transport başlangıç zamanı

    // Callbacks
    this.onPositionUpdate = null;
    this.onProgressUpdate = null;
    
    this.initialize();
  }

  initialize() {
    if (this.isInitialized) return;
    
    // DÜZELTME: Audio Context latency'sini hesapla
    this.calculateLatencyCompensation();
    
    // Tone.Transport başlangıç ayarları
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '1m';
    
    if (this.debug) {
      console.log('[TimeManager] Başlatıldı - Latency compensation:', this.latencyCompensation.toFixed(4) + 's');
    }
    
    this.isInitialized = true;
  }

  /**
   * DÜZELTME: Ses sistemi latency'sini hesapla
   */
  calculateLatencyCompensation() {
    // Audio Context'in gerçekten başlatıldığından emin ol
    if (Tone.context.state !== 'running') {
      console.warn('[TimeManager] Audio Context henüz başlatılmamış, varsayılan latency kullanılıyor');
      this.latencyCompensation = 0.05; // 50ms varsayılan
      return;
    }

    // Gerçek latency değerlerini al
    let baseLatency = Tone.context.baseLatency || 0;
    let outputLatency = Tone.context.outputLatency || 0;
    const lookAhead = Tone.Transport.lookAhead || 0.1;
    
    // DÜZELTME: Sıfır latency değerlerini düzelt
    if (baseLatency === 0) {
      // Tarayıcı/platform bazlı varsayılan değerler
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('chrome')) {
        baseLatency = 0.005; // Chrome ~5ms
      } else if (userAgent.includes('firefox')) {
        baseLatency = 0.02; // Firefox ~20ms
      } else if (userAgent.includes('safari')) {
        baseLatency = 0.01; // Safari ~10ms
      } else {
        baseLatency = 0.02; // Varsayılan
      }
    }
    
    if (outputLatency === 0) {
      outputLatency = 0.01; // 10ms varsayılan output latency
    }
    
    // DÜZELTME: Daha konservatif hesaplama
    this.latencyCompensation = baseLatency + outputLatency + (lookAhead * 0.3);
    
    // Minimum ve maksimum sınırlar
    this.latencyCompensation = Math.max(0.01, Math.min(0.15, this.latencyCompensation));
    
    if (this.debug) {
      console.log('[TimeManager] Düzeltilmiş latency analizi:', {
        browser: this.getBrowserInfo(),
        baseLatency: baseLatency.toFixed(4),
        outputLatency: outputLatency.toFixed(4),
        lookAhead: lookAhead.toFixed(4),
        total: this.latencyCompensation.toFixed(4),
        contextState: Tone.context.state
      });
    }
  }

  /**
   * YENİ: Tarayıcı bilgisi al
   */
  getBrowserInfo() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome')) return 'Chrome';
    if (userAgent.includes('firefox')) return 'Firefox';
    if (userAgent.includes('safari')) return 'Safari';
    if (userAgent.includes('edge')) return 'Edge';
    return 'Unknown';
  }
  calculateLoopInfo(mode, activePatternId, arrangementData) {
    let lengthInSteps = 64;

    if (mode === 'pattern' && activePatternId && arrangementData?.patterns) {
      const pattern = arrangementData.patterns[activePatternId];
      if (pattern) lengthInSteps = calculatePatternLoopLength(pattern);
    } else if (mode === 'song' && arrangementData?.clips) {
      lengthInSteps = calculateArrangementLoopLength(arrangementData.clips);
    }
    
    // NİHAİ DÜZELTME: Saniye hesaplaması için Tone.js'in kendi birim çevirmesini kullanmak en sağlıklısıdır.
    // Bu, BPM değişikliklerinden sonra bile hassasiyeti korur.
    const lengthInSeconds = Tone.Time('16n').toSeconds() * lengthInSteps;

    this.loopInfo = { lengthInSteps, lengthInSeconds };

    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = lengthInSeconds;
    Tone.Transport.loop = true;
  }

  _startAnimationLoop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    
    const updateLoop = () => {
      if (!this.isRunning || this.loopInfo.lengthInSeconds === 0) {
          if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
          return;
      }

      // NİHAİ DÜZELTME: Hem progress hem de BBT, tek ve aynı kaynaktan (saniye) hesaplanıyor.
      const transportSeconds = Tone.Transport.seconds;
      const progress = transportSeconds / this.loopInfo.lengthInSeconds;
      const position = this._calculateBBTPosition(transportSeconds);
      
      this.onPositionUpdate?.(position);
      PlaybackAnimatorService.publish(progress % 1); // Her zaman 0-1 aralığında kalmasını garantile

      this.animationFrameId = requestAnimationFrame(updateLoop);
    };
    updateLoop();
  }

  _calculateBBTPosition(transportSeconds) {
    // Bu metot artık saniye cinsinden, Tone.Transport'un kendi zamanlamasından bağımsız ve saf bir hesaplama yapıyor.
    const position = Tone.Time(transportSeconds).toBarsBeatsSixteenths();
    const parts = position.split(':');
    return {
      bars: parseInt(parts[0], 10) + 1,
      beats: parseInt(parts[1], 10) + 1,
      ticks: parseFloat(parts[2]).toFixed(0).padStart(2, '0'),
      formatted: `${parseInt(parts[0], 10) + 1}:${parseInt(parts[1], 10) + 1}:${parseFloat(parts[2]).toFixed(0).padStart(2, '0')}`
    };
  }
  

  /**
   * DÜZELTME: Gerçek audio zamanını hesapla (latency kompanzasyonlu)
   */
  getCurrentAudioTime() {
    if (!this.isRunning) return 0;
    
    // Transport zamanı
    const transportSeconds = Tone.Transport.seconds;
    
    // DÜZELTME: Latency kompanzasyonunu uygula
    const compensatedTime = transportSeconds - this.latencyCompensation;
    
    // Negatif zamana düşme durumunu kontrol et
    return Math.max(0, compensatedTime);
  }

  _stopAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  _calculateBBTFromSeconds(seconds) {
    const timeSignature = Tone.Transport.timeSignature;
    const bpm = Tone.Transport.bpm.value;
    
    const beatsPerSecond = bpm / 60;
    const totalBeats = seconds * beatsPerSecond;
    
    const bars = Math.floor(totalBeats / timeSignature);
    const beats = Math.floor(totalBeats % timeSignature);
    const sixteenths = Math.floor((totalBeats % 1) * 4);

    return {
      bars: bars + 1,
      beats: beats + 1,
      sixteenths: sixteenths,
      formatted: `${bars + 1}:${beats + 1}:${sixteenths.toString().padStart(2, '0')}`
    };
  }

  /**
   * DÜZELTME: Başlatma zamanını kaydet
   */
  start(mode, patternId, arrangementData) {
    // Audio Context'in gerçekten hazır olduğundan emin ol
    if (Tone.context.state !== 'running') {
      console.warn('[TimeManager] Audio Context başlatılıyor...');
      Tone.context.resume().then(() => {
        // Context başlatıldıktan sonra latency'yi yeniden hesapla
        setTimeout(() => {
          this.calculateLatencyCompensation();
          this._continueStart(mode, patternId, arrangementData);
        }, 100); // 100ms bekle
      });
      return;
    }
    
    this._continueStart(mode, patternId, arrangementData);
  }

  /**
   * YENİ: Gerçek başlatma mantığı
   */
  _continueStart(mode, patternId, arrangementData) {
    this.calculateLatencyCompensation();
    this.calculateLoopInfo(mode, patternId, arrangementData);
    
    this.transportStartTime = Tone.Transport.seconds;
    this.audioStartTime = Tone.now();
    
    this.isRunning = true;
    this._startAnimationLoop();
    
    if (this.debug) {
      console.log(`[TimeManager] Başlatıldı - Mod: ${mode}, Latency: ${this.latencyCompensation.toFixed(4)}s, Context: ${Tone.context.state}`);
    }
  }

  pause() {
    this.isRunning = false;
    this._stopAnimationLoop();
    
    if (this.debug) {
      console.log('[TimeManager] Duraklatıldı');
    }
  }
  
  resume() {
    if (!this.isRunning) {
      // DÜZELTME: Resume'da zamanları güncelle
      this.audioStartTime = Tone.now();
      this.transportStartTime = Tone.Transport.seconds;
      
      this.isRunning = true;
      this._startAnimationLoop();
      
      if (this.debug) {
        console.log('[TimeManager] Devam ettiriliyor');
      }
    }
  }

  stop() {
    this.isRunning = false;
    this._stopAnimationLoop();
    
    // Başlangıç pozisyonuna dön
    if (this.onPositionUpdate) {
      this.onPositionUpdate({ 
        bars: 1, beats: 1, sixteenths: 0, formatted: '1:1:00' 
      });
    }
    
    if (this.onProgressUpdate) {
      this.onProgressUpdate(0);
    }
    
    PlaybackAnimatorService.publish(0);
    
    if (this.debug) {
      console.log('[TimeManager] Durduruldu');
    }
  }

  switchMode(newMode, patternId, arrangementData) {
    const currentAudioTime = this.getCurrentAudioTime();
    const currentProgress = this.loopInfo.lengthInSeconds > 0 
      ? (currentAudioTime % this.loopInfo.lengthInSeconds) / this.loopInfo.lengthInSeconds 
      : 0;
    
    this.calculateLoopInfo(newMode, patternId, arrangementData);
    
    // DÜZELTME: Kompanzasyonlu pozisyon ayarlama
    const newSeconds = currentProgress * this.loopInfo.lengthInSeconds;
    Tone.Transport.seconds = newSeconds + this.latencyCompensation;
    
    if (this.debug) {
      console.log(`[TimeManager] Mod değişti: ${newMode}, Progress: ${(currentProgress * 100).toFixed(1)}%`);
    }
  }
  
  jumpToBar(barNumber) {
    const timeSignature = Tone.Transport.timeSignature;
    const bpm = Tone.Transport.bpm.value;
    const beatsPerBar = timeSignature;
    const secondsPerBeat = 60 / bpm;
    
    const targetSeconds = (barNumber - 1) * beatsPerBar * secondsPerBeat;
    const clampedSeconds = targetSeconds % this.loopInfo.lengthInSeconds;
    
    // DÜZELTME: Latency kompanzasyonu ekle
    Tone.Transport.seconds = clampedSeconds + this.latencyCompensation;
    
    if (this.debug) {
      console.log(`[TimeManager] Bar ${barNumber}'a atlandı`);
    }
  }

  jumpToPercent(percent) {
    const clampedPercent = Math.max(0, Math.min(1, percent));
    const targetSeconds = this.loopInfo.lengthInSeconds * clampedPercent;
    
    // DÜZELTME: Latency kompanzasyonu ekle
    Tone.Transport.seconds = targetSeconds + this.latencyCompensation;
    
    if (this.debug) {
      console.log(`[TimeManager] %${(clampedPercent * 100).toFixed(1)} pozisyonuna atlandı`);
    }
  }

  dispose() {
    this.stop();
    this.onPositionUpdate = null;
    this.onProgressUpdate = null;
    this.isInitialized = false;
    
    if (this.debug) {
      console.log('[TimeManager] Temizlendi');
    }
  }
}

// Singleton instance
export const timeManager = new UnifiedTimeManager(true);