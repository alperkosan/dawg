// src/lib/core/nodes/MixerStrip.js - GÜNCELLENMİŞ

import * as Tone from 'tone';
import { PluginNodeFactory } from './PluginNodeFactory.js';
import { MeteringService } from '../MeteringService';
import { setParamSmoothly } from '../../utils/audioUtils';

export class MixerStrip {
  constructor(trackData) {
    this.id = trackData.id;
    this.type = trackData.type;
    this.isDisposed = false;

    // Temel Ses Düğümleri
    this.inputGain = new Tone.Gain(1);
    this.panner = this.type !== 'master' ? new Tone.Panner(trackData.pan || 0) : null;
    this.fader = new Tone.Volume(trackData.volume ?? 0);
    
    // YENİ: Solo ve Mute için ayrı kazanç (gain) katmanları
    this.soloGain = new Tone.Gain(1);
    this.muteGain = new Tone.Gain(1);
    
    this.outputMeter = new Tone.Meter();
    this.outputGain = new Tone.Gain(1);
    
    // Efekt ve Send'ler
    this.effectNodes = new Map();
    this.sendNodes = new Map();
    
    // Metreleme için
    this.meteringSchedules = new Map();
  }

  /**
   * Kanalın tüm ses zincirini (efektler, send'ler, solo/mute) kurar.
   */
  buildSignalChain(trackData, masterFader, busInputs) {
    if (this.isDisposed) return;
    
    // 1. Önceki zinciri tamamen temizle
    this.inputGain.disconnect();
    this.clearChain();

    // 2. Efekt zincirini oluştur
    let currentNode = this.inputGain;
    if (trackData.insertEffects && trackData.insertEffects.length > 0) {
      trackData.insertEffects.forEach(effectData => {
        if (!effectData.bypass) {
          const effectNode = PluginNodeFactory.create(effectData);
          if (effectNode) {
            currentNode.connect(effectNode.input);
            currentNode = effectNode.output;
            this.effectNodes.set(effectData.id, effectNode);
            this.setupEffectMetering(effectData.id, effectNode, effectData.type);
          }
        }
      });
    }

    // 3. Ana Sinyal Akışını Bağla (Panner -> Fader -> Solo -> Mute)
    if (this.panner) {
      currentNode.connect(this.panner);
      currentNode = this.panner;
    }
    currentNode.connect(this.fader);

    // YENİ: Post-fader send'leri fader'dan sonra bağla
    this.setupSends(trackData.sends || [], this.fader, busInputs);
    
    this.fader.connect(this.soloGain);
    this.soloGain.connect(this.muteGain);
    this.muteGain.connect(this.outputMeter);
    this.outputMeter.connect(this.outputGain);

    // 4. Çıkışı doğru hedefe yönlendir (Master veya başka bir Bus)
    this.setupOutputRouting(trackData, masterFader, busInputs);

    // 5. Metrelemeyi başlat
    this.setupMetering();
  }
  
  // YENİ: Send'leri (gönderileri) oluşturan ve hedeflerine bağlayan fonksiyon
  setupSends(sendsData, sourceNode, busInputs) {
    sendsData.forEach(send => {
      const sendGain = new Tone.Gain(Tone.dbToGain(send.level));
      sourceNode.connect(sendGain);
      
      const targetBusInput = busInputs.get(send.busId);
      if (targetBusInput) {
        sendGain.connect(targetBusInput);
      } else {
        console.warn(`[ROUTING] Hedef Bus bulunamadı: ${this.id} -> ${send.busId}`);
      }
      this.sendNodes.set(send.busId, sendGain);
    });
  }

  // YENİ: Kanalın çıkışını doğru yere (master veya bus) yönlendirir.
  setupOutputRouting(trackData, masterFader, busInputs) {
    this.outputGain.disconnect();
    const customOutput = trackData.output;

    if (customOutput && busInputs.has(customOutput)) {
      this.outputGain.connect(busInputs.get(customOutput));
    } else if (this.type !== 'master') {
      this.outputGain.connect(masterFader);
    }
  }

  // Anlık parametre güncellemeleri
  updateParam(param, value) {
    if (this.isDisposed) return;
    try {
      switch (param) {
        case 'volume': setParamSmoothly(this.fader.volume, value, 0.02); break;
        case 'pan': if (this.panner) setParamSmoothly(this.panner.pan, value, 0.02); break;
      }
    } catch (error) {
      console.error(`Parametre güncelleme hatası (${param}):`, error);
    }
  }

  updateEffectParam(effectId, paramOrSettings, value) {
    const effectNode = this.effectNodes.get(effectId);
    if (effectNode?.updateParam) {
        try {
            if (typeof paramOrSettings === 'string') {
                effectNode.updateParam(paramOrSettings, value);
            } else {
                Object.entries(paramOrSettings).forEach(([p, v]) => effectNode.updateParam(p, v));
            }
        } catch (error) {
            console.error(`Efekt parametresi güncelleme hatası (${effectId}):`, error);
        }
    }
  }

  updateSendLevel(busId, level) {
      const sendNode = this.sendNodes.get(busId);
      if (sendNode) {
          const gainValue = Tone.dbToGain(level);
          setParamSmoothly(sendNode.gain, gainValue, 0.02);
      }
  }
  
  // YENİ: Solo durumunu ayarlar
  setSolo(isSoloed, isAnySoloActive) {
    // Master ve Bus kanalları solo'dan etkilenmez.
    if (this.type === 'master' || this.type === 'bus') {
      setParamSmoothly(this.soloGain.gain, 1, 0.01);
      return;
    }
    const gainValue = (isAnySoloActive && !isSoloed) ? 0 : 1;
    setParamSmoothly(this.soloGain.gain, gainValue, 0.01);
  }

  // YENİ: Mute durumunu ayarlar
  setMute(isMuted) {
    const gainValue = isMuted ? 0 : 1;
    setParamSmoothly(this.muteGain.gain, gainValue, 0.01);
  }

  // Metreleme kurulumu
  setupMetering() {
    this.clearMetering();
    const meterId = `${this.id}-output`;
    const eventId = Tone.Transport.scheduleRepeat(() => {
        if (this.isDisposed || !this.outputMeter) return;
        MeteringService.publish(meterId, this.outputMeter.getValue());
    }, "32n");
    this.meteringSchedules.set('output', eventId);
  }

  setupEffectMetering(effectId, effectNode, effectType) {
    if (effectType !== 'Compressor') return;
    const meterId = `${this.id}-${effectId}`;
    const eventId = Tone.Transport.scheduleRepeat(() => {
        if (this.isDisposed) return;
        const reduction = effectNode.input?.reduction;
        if (typeof reduction === 'number') {
            MeteringService.publish(meterId, reduction);
        }
    }, "32n");
    this.meteringSchedules.set(effectId, eventId);
  }

  clearMetering() {
      this.meteringSchedules.forEach(id => Tone.Transport.clear(id));
      this.meteringSchedules.clear();
  }

  clearChain() {
    this.clearMetering();
    this.sendNodes.forEach(node => node.dispose());
    this.sendNodes.clear();
    this.effectNodes.forEach(node => node.dispose());
    this.effectNodes.clear();
  }

  dispose() {
    this.isDisposed = true;
    this.clearChain();
    [this.inputGain, this.panner, this.fader, this.outputMeter, this.outputGain, this.soloGain, this.muteGain]
        .forEach(node => node?.dispose());
  }
}
