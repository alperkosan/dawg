// client/src/lib/core/nodes/MixerStrip.js - YENİ DOSYA

import * as Tone from 'tone';
import { PluginNodeFactory } from './PluginNodeFactory.js';
import { MeteringService } from '../MeteringService';
import { setParamSmoothly } from '../../utils/audioUtils';

export class MixerStrip {
  constructor(trackData) {
    this.id = trackData.id;
    this.type = trackData.type;
    this.isDisposed = false;

    // Core Audio Nodes
    this.inputGain = new Tone.Gain(1);
    this.preGain = new Tone.Gain(1);
    this.postGain = new Tone.Gain(1);
    this.panner = trackData.type !== 'master' ? new Tone.Panner(trackData.pan || 0) : null;
    this.fader = new Tone.Volume(trackData.volume ?? 0);
    this.outputMeter = new Tone.Meter();
    this.outputGain = new Tone.Gain(1);
    this.soloGain = new Tone.Gain(1);
    this.muteGain = new Tone.Gain(1);
    
    // Effect Chain
    this.effectNodes = new Map();
    this.effectOrder = [];
    this.meteringSchedules = new Map();
    
    // Send System
    this.sendNodes = new Map();
  }

  /**
   * Ana sinyal zincirini oluşturur
   * ÖNCEDEN: Basit linear chain
   * SONRA: Profesyonel routing with sends, metering, solo/mute
   */
  // MixerStrip.js içinde buildSignalChain metodunu güncelle:

  async buildSignalChain(trackData, masterFader, busInputs) {
    if (this.isDisposed) return;
    
    console.log(`🔧 [MIXER STRIP ${this.id}] Signal chain kuruluyor...`, {
      type: this.type,
      hasEffects: trackData.insertEffects?.length > 0,
      hasSends: trackData.sends?.length > 0
    });

    // 1. Önceki zinciri temizle
    this.inputGain.disconnect();
    await this.clearChain();

    // 2. Efekt zincirini oluştur
    let currentNode = this.preGain;
    currentNode = await this.buildEffectChain(trackData.insertEffects || [], currentNode);
    
    // 3. Ana Sinyal Akışı
    console.log(`🔗 [MIXER STRIP ${this.id}] Ana zincir bağlanıyor...`);
    
    this.inputGain.connect(this.preGain);
    currentNode.connect(this.postGain);
    
    // Pre-fader sends
    this.setupSends(trackData.sends || [], this.postGain, busInputs, true);

    let mainChainNode = this.postGain;
    if (this.panner) {
      mainChainNode.connect(this.panner);
      mainChainNode = this.panner;
    }
    mainChainNode.connect(this.fader);
    
    // Post-fader sends
    this.setupSends(trackData.sends || [], this.fader, busInputs, false);

    this.fader.connect(this.soloGain);
    this.soloGain.connect(this.muteGain);
    this.muteGain.connect(this.outputMeter);
    this.outputMeter.connect(this.outputGain);

    // 4. Çıkışı yönlendir
    console.log(`🎯 [MIXER STRIP ${this.id}] Çıkış routing...`);
    this.setupOutputRouting(trackData, masterFader, busInputs);

    // 5. DEBUG: Final bağlantı durumu
    console.log(`✅ [MIXER STRIP ${this.id}] Signal chain kuruldu`, {
      inputConnected: this.inputGain.numberOfInputs > 0,
      outputConnected: this.outputGain.numberOfOutputs > 0,
      volumeDb: this.fader.volume.value,
      muted: this.muteGain.gain.value,
      soloed: this.soloGain.gain.value
    });

    // 6. Metreleri başlat
    this.setupMetering();
  }

  /**
   * Effect zincirini oluşturur - sıralama korunarak
   */
  async buildEffectChain(effectsData, inputNode) {
    let currentNode = inputNode;
    this.effectOrder = [];

    for (const effectData of effectsData) {
      if (effectData.bypass) {
        // Bypassed effect'i order'a ekle ama bağlama
        this.effectOrder.push(effectData.id);
        continue;
      }

      try {
        const effectNode = PluginNodeFactory.create(effectData);
        if (effectNode) {
          // Connect to chain
          currentNode.connect(effectNode.input);
          currentNode = effectNode.output;
          
          // Store for parameter updates
          this.effectNodes.set(effectData.id, effectNode);
          this.effectOrder.push(effectData.id);
          
          // Setup effect-specific features
          await this.setupEffectFeatures(effectData, effectNode);
        }
      } catch (error) {
        console.error(`Effect creation failed for ${effectData.type}:`, error);
      }
    }

    return currentNode;
  }

  /**
   * Effect özel özelliklerini kurar (metering, sidechain, etc.)
   */
  async setupEffectFeatures(effectData, effectNode) {
    // Metering setup (compressor, limiter, etc.)
    if (this.hasMetering(effectData.type)) {
      this.setupEffectMetering(effectData.id, effectNode, effectData.type);
    }
    
    // Sidechain setup
    if (effectData.settings.sidechainSource && effectNode.sidechainInput) {
      this.setupSidechainConnection(effectData.id, effectData.settings.sidechainSource, effectNode);
    }
  }

  /**
   * Effect metering kurulumu - generic sistem
   */
  setupEffectMetering(effectId, effectNode, effectType) {
    const meterId = `${this.id}-${effectId}`;
    let meterFunction;

    switch (effectType) {
      case 'Compressor':
      case 'Limiter':
        meterFunction = () => {
          if (effectNode.input?.reduction !== undefined) {
            return effectNode.input.reduction;
          }
          return 0;
        };
        break;
        
      case 'EQ':
      case 'Filter':
        meterFunction = () => {
          // Frequency analyzer data buraya gelecek
          return 0;
        };
        break;
        
      default:
        return; // No metering for this effect type
    }

    // Schedule metering updates
    const eventId = Tone.Transport.scheduleRepeat(() => {
      if (this.isDisposed) return;
      
      try {
        const value = meterFunction();
        if (typeof value === 'number' && isFinite(value)) {
          MeteringService.publish(meterId, value);
        }
      } catch (error) {
        // Metering errors shouldn't crash audio
      }
    }, "32n"); // 32nd note resolution

    this.meteringSchedules.set(effectId, eventId);
  }

  /**
   * Sidechain bağlantısı kurulumu
   */
  setupSidechainConnection(effectId, sourceTrackId, effectNode) {
    // Bu özellik AudioEngine'de implement edilmesi gereken
    // advanced bir özellik - şimdilik placeholder
    console.log(`Sidechain setup: ${sourceTrackId} -> ${this.id}/${effectId}`);
  }

  // ============================================
  // REAL-TIME PARAMETER UPDATES - ÇOK ÖNEMLİ!
  // ============================================

  /**
   * Track parametrelerini anında günceller
   * Bu fonksiyon UI'dan her değişiklikte çağrılır
   */
  updateParam(param, value) {
    if (this.isDisposed) return;

    try {
      switch (param) {
        case 'volume':
          // Smooth transition ile volume değiştir
          setParamSmoothly(this.fader.volume, value, 0.02);
          break;
          
        case 'pan':
          if (this.panner) {
            setParamSmoothly(this.panner.pan, value, 0.02);
          }
          break;
          
        case 'preGain':
          setParamSmoothly(this.preGain.gain, value, 0.02);
          break;
          
        case 'postGain':
          setParamSmoothly(this.postGain.gain, value, 0.02);
          break;
      }
    } catch (error) {
      console.error(`Parameter update failed for ${param}:`, error);
    }
  }

  /**
   * Effect parametrelerini anında günceller
   * Knob döndürürken gecikme olmadan ses değişir
   */
  updateEffectParam(effectId, param, value) {
    if (this.isDisposed) return;

    const effectNode = this.effectNodes.get(effectId);
    if (effectNode?.updateParam) {
      try {
        effectNode.updateParam(param, value);
      } catch (error) {
        console.error(`Effect parameter update failed for ${effectId}/${param}:`, error);
      }
    }
  }

  /**
   * Effect bypass durumunu değiştirir
   */
  setEffectBypass(effectId, bypassed) {
    // Effect'i chain'den çıkar veya ekle
    // Bu kompleks bir işlem, şimdilik basit implementation
    const effectNode = this.effectNodes.get(effectId);
    if (effectNode) {
      if (bypassed) {
        // Effect'i bypass et (ses geçsin ama işlem yapmasın)
        if (effectNode.wet) {
          setParamSmoothly(effectNode.wet, 0, 0.02);
        }
      } else {
        // Effect'i aktif et
        if (effectNode.wet) {
          setParamSmoothly(effectNode.wet, 1, 0.02);
        }
      }
    }
  }

  // ============================================
  // SEND/BUS SYSTEM IMPLEMENTATION
  // ============================================

  /**
   * YENİ VE KRİTİK FONKSİYON: Send'leri oluşturur ve hedeflerine bağlar.
   */
  setupSends(sendsData, sourceNode, busInputs, isPreFader) {
    sendsData.forEach(send => {
      const sendIsPreFader = send.preFader === true;
      if (sendIsPreFader !== isPreFader) return;

      const sendGain = new Tone.Gain(Tone.dbToGain(send.level));
      sourceNode.connect(sendGain);
      
      const targetBusInput = busInputs.get(send.busId);
      if (targetBusInput) {
        sendGain.connect(targetBusInput);
      } else {
        console.warn(`[MIXER ROUTING] Hedef Bus bulunamadı: ${this.id} -> ${send.busId}`);
      }
      this.sendNodes.set(send.busId, sendGain);
    });
  }

  /**
   * YENİ VE KRİTİK FONKSİYON: Kanalın çıkışını doğru yere yönlendirir.
   */
  setupOutputRouting(trackData, masterFader, busInputs) {
      this.outputGain.disconnect();
      const customOutput = trackData.output;

      if (customOutput && busInputs.has(customOutput)) {
          // Eğer kanal için özel bir çıkış (başka bir bus) belirtilmişse oraya bağla
          this.outputGain.connect(busInputs.get(customOutput));
      } else {
          // DÜZELTME: HATALI VARSAYIMI KALDIRIYORUZ.
          // Master kanalı dahil, özel bir çıkışı olmayan TÜM kanallar
          // doğrudan ana masterFader'a bağlanmalıdır.
          this.outputGain.connect(masterFader);
      }
  }


  setupPreFaderSends(sendsData) {
    // Pre-fader send'ler postGain'den sonra alınır
    sendsData.forEach(send => {
      if (send.preFader) {
        const sendGain = new Tone.Gain(Tone.dbToGain(send.level));
        this.postGain.connect(sendGain);
        this.preFaderSends.set(send.busId, sendGain);
        
        // Bus'a bağlantı AudioEngine'de yapılacak
      }
    });
  }

  setupPostFaderSends(sendsData) {
    // Post-fader send'ler fader'dan sonra alınır
    sendsData.forEach(send => {
      if (!send.preFader) {
        const sendGain = new Tone.Gain(Tone.dbToGain(send.level));
        this.fader.connect(sendGain);
        this.postFaderSends.set(send.busId, sendGain);
      }
    });
  }

  updateSendLevel(busId, level) {
    const preSend = this.preFaderSends.get(busId);
    const postSend = this.postFaderSends.get(busId);
    
    const gainValue = Tone.dbToGain(level);
    
    if (preSend) {
      setParamSmoothly(preSend.gain, gainValue, 0.02);
    }
    if (postSend) {
      setParamSmoothly(postSend.gain, gainValue, 0.02);
    }
  }

  // ============================================
  // SOLO/MUTE SYSTEM
  // ============================================

  setSolo(active) {
    const gainValue = active ? 1 : 0;
    setParamSmoothly(this.soloGain.gain, gainValue, 0.02);
  }

  setMute(muted) {
    const gainValue = muted ? 0 : 1;
    setParamSmoothly(this.muteGain.gain, gainValue, 0.02);
  }

  // ============================================
  // METERING SYSTEM
  // ============================================

  setupMetering() {
    ['input', 'output'].forEach(type => {
        const meterId = `${this.id}-${type}`;
        const meterNode = type === 'input' ? this.inputMeter : this.outputMeter;
        
        const eventId = Tone.Transport.scheduleRepeat(() => {
            if (this.isDisposed || !meterNode) return;
            try {
                const level = meterNode.getValue();
                MeteringService.publish(meterId, level);
            } catch (e) {
                // Hata oluşursa bile devam et
            }
        }, "32n");
        this.meteringSchedules.set(type, eventId);
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  hasMetering(effectType) {
    return ['Compressor', 'Limiter', 'EQ', 'Filter'].includes(effectType);
  }

  setupOutputRouting(trackData, masterFader, busInputs) {
    this.outputGain.disconnect();
    const customOutput = trackData.output;
    
    console.log(`🎯 [MIXER STRIP ${this.id}] Output routing:`, {
      type: this.type,
      customOutput,
      hasBusInputs: busInputs.size > 0
    });

    if (customOutput && busInputs.has(customOutput)) {
      // Özel çıkış (bus'a)
      console.log(`🚌 [MIXER STRIP ${this.id}] Bus'a bağlanıyor: ${customOutput}`);
      this.outputGain.connect(busInputs.get(customOutput));
    } else {
      // Master'a bağlan
      console.log(`🎛️ [MIXER STRIP ${this.id}] Master'a bağlanıyor`);
      this.outputGain.connect(masterFader);
    }
  }

  // ============================================
  // CLEANUP & DISPOSAL
  // ============================================

  async clearChain() {
    this.meteringSchedules.forEach(id => Tone.Transport.clear(id));
    this.meteringSchedules.clear();
    
    this.sendNodes.forEach(node => node.dispose());
    this.sendNodes.clear();

    this.effectNodes.forEach(node => node.dispose());
    this.effectNodes.clear();
  }

  dispose() {
    this.isDisposed = true;
    this.buildingChain = false;

    this.clearChain();
    [this.inputGain, this.inputMeter, this.preGain, this.postGain, this.panner, this.fader, this.outputMeter, this.outputGain, this.soloGain, this.muteGain].forEach(node => node?.dispose());
  }
}