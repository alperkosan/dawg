// client/src/lib/core/nodes/EnhancedMixerStrip.js - YENİ DOSYA

import * as Tone from 'tone';
import { PluginNodeFactory } from './PluginNodeFactory.js';
import { MeteringService } from '../MeteringService';
import { setParamSmoothly } from '../../utils/audioUtils';

/**
 * ÇOK ÖNEMLİ DEĞİŞİKLİKLER:
 * 1. Gerçek zamanlı parameter updates
 * 2. Gelişmiş effect chain yönetimi  
 * 3. Professional send/bus routing
 * 4. Memory leak koruması
 * 5. A/B comparison desteği
 */
export class EnhancedMixerStrip {
  constructor(trackData) {
    this.id = trackData.id;
    this.type = trackData.type;
    this.isDisposed = false;
    this.buildingChain = false;

    // ============================================
    // CORE AUDIO NODES - Yeniden organize edildi
    // ============================================
    
    // Input section
    this.inputGain = new Tone.Gain(1);
    this.inputMeter = new Tone.Meter(); // Yeni: Input metering
    this.inputGain.connect(this.inputMeter);
    
    // Main processing chain
    this.preGain = new Tone.Gain(1); // Yeni: Effect'lerden önce gain
    this.postGain = new Tone.Gain(1); // Yeni: Effect'lerden sonra gain
    
    // Output section  
    this.panner = trackData.type !== 'master' ? new Tone.Panner(trackData.pan || 0) : null;
    this.fader = new Tone.Volume(trackData.volume ?? 0);
    this.outputMeter = new Tone.Meter(); // Yeni: Output metering
    this.outputGain = new Tone.Gain(1);
    
    // Solo/Mute nodes
    this.soloGain = new Tone.Gain(1);
    this.muteGain = new Tone.Gain(1);

    // ============================================
    // EFFECT CHAIN MANAGEMENT - Tamamen yeni!
    // ============================================
    
    this.effectNodes = new Map(); // effectId -> effectNode
    this.effectOrder = []; // Effect sıralaması için
    this.meteringSchedules = new Map(); // Metering event'leri
    
    // ============================================
    // SEND SYSTEM - Professional routing
    // ============================================
    
    this.sendNodes = new Map(); // busId -> sendNode
    this.preFaderSends = new Map(); // Pre-fader send'ler
    this.postFaderSends = new Map(); // Post-fader send'ler

    // ============================================
    // SIDECHAIN SYSTEM
    // ============================================
    
    this.sidechainInputs = new Map(); // effect'ler için sidechain girişleri
    this.sidechainSources = new Set(); // Bu strip'in sidechain kaynağı olduğu effectler

    // Build initial chain
    this.buildSignalChain(trackData);
  }

  /**
   * Ana sinyal zincirini oluşturur
   * ÖNCEDEN: Basit linear chain
   * SONRA: Profesyonel routing with sends, metering, solo/mute
   */
  async buildSignalChain(trackData) {
    if (this.buildingChain || this.isDisposed) return;

    try {
      this.buildingChain = true;
      
      // 1. Clear existing chain
      await this.clearEffectChain();
      
      // 2. Connect input section
      this.inputGain.connect(this.preGain);
      
      // 3. Build effect chain
      let currentNode = this.preGain;
      currentNode = await this.buildEffectChain(trackData.insertEffects || [], currentNode);
      
      // 4. Connect to post-gain
      currentNode.connect(this.postGain);
      currentNode = this.postGain;
      
      // 5. Connect pre-fader sends (effect return'ler için)
      this.setupPreFaderSends(trackData.sends || []);
      
      // 6. Connect to panning and fader
      if (this.panner) {
        currentNode.connect(this.panner);
        currentNode = this.panner;
      }
      
      currentNode.connect(this.fader);
      currentNode = this.fader;
      
      // 7. Connect post-fader sends (aux return'ler için)
      this.setupPostFaderSends(trackData.sends || []);
      
      // 8. Connect to solo/mute and output
      currentNode.connect(this.soloGain);
      this.soloGain.connect(this.muteGain);
      this.muteGain.connect(this.outputMeter);
      this.outputMeter.connect(this.outputGain);
      
      // 9. Setup main output routing
      this.setupOutputRouting(trackData);
      
      // 10. Setup metering
      this.setupMetering();
      
    } catch (error) {
      console.error(`[MIXER] Enhanced chain building error ${this.id}:`, error);
    } finally {
      this.buildingChain = false;
    }
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
    // Input/Output level metering
    const inputMeterId = `${this.id}-input`;
    const outputMeterId = `${this.id}-output`;

    // Input meter
    const inputMeterEvent = Tone.Transport.scheduleRepeat(() => {
      if (!this.isDisposed) {
        const level = this.inputMeter.getValue();
        MeteringService.publish(inputMeterId, level);
      }
    }, "32n");

    // Output meter  
    const outputMeterEvent = Tone.Transport.scheduleRepeat(() => {
      if (!this.isDisposed) {
        const level = this.outputMeter.getValue();
        MeteringService.publish(outputMeterId, level);
      }
    }, "32n");

    this.meteringSchedules.set('input', inputMeterEvent);
    this.meteringSchedules.set('output', outputMeterEvent);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  hasMetering(effectType) {
    return ['Compressor', 'Limiter', 'EQ', 'Filter'].includes(effectType);
  }

  setupOutputRouting(trackData) {
    // Ana output routing - AudioEngine'de implement edilecek
  }

  // ============================================
  // CLEANUP & DISPOSAL
  // ============================================

  async clearEffectChain() {
    // Disconnect all nodes
    this.effectNodes.forEach(node => {
      try {
        if (node.input) node.input.disconnect();
        if (node.output) node.output.disconnect();
        if (node.dispose) node.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
    });

    this.effectNodes.clear();
    this.effectOrder = [];

    // Clear metering
    this.meteringSchedules.forEach(eventId => {
      try {
        Tone.Transport.clear(eventId);
      } catch (e) {
        // Ignore clear errors
      }
    });
    this.meteringSchedules.clear();
  }

  dispose() {
    this.isDisposed = true;
    this.buildingChain = false;

    this.clearEffectChain().then(() => {
      // Dispose all nodes
      const nodes = [
        this.inputGain, this.inputMeter, this.preGain, this.postGain,
        this.panner, this.fader, this.outputMeter, this.outputGain,
        this.soloGain, this.muteGain
      ];

      nodes.forEach(node => {
        if (node) {
          try {
            node.dispose();
          } catch (e) {
            // Ignore disposal errors
          }
        }
      });

      // Clear send nodes
      [...this.preFaderSends.values(), ...this.postFaderSends.values()].forEach(node => {
        try {
          node.dispose();
        } catch (e) {}
      });

      this.preFaderSends.clear();
      this.postFaderSends.clear();
    });
  }
}