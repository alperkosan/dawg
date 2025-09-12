import * as Tone from 'tone';
import { PluginNodeFactory } from './PluginNodeFactory.js';
import { MeteringService } from '../MeteringService';

/**
 * ASENKRON GÜVENLİ ve KARARLI MixerStrip: Race condition'ları ve döngüsel referansları
 * engelleyen, "production-ready" kalitede bir yapı.
 */
export class MixerStrip {
  constructor(trackData, masterFader, busInputs, allStrips) {
    this.id = trackData.id;
    this.isDisposed = false;
    this.buildingChain = false;
    
    this.inputNode = new Tone.Channel(0, 0);
    this.outputNode = new Tone.Channel(0, 0);
    this.fader = new Tone.Volume(trackData.volume ?? 0);
    this.panner = trackData.type !== 'master' ? new Tone.Panner(trackData.pan || 0) : null;
    
    this.effects = new Map();
    this.sends = new Map();
    this.scheduledMeterEvents = new Set();
    
    this.sidechainDependencies = new Set();

    this.buildChain(trackData, masterFader, busInputs, allStrips);
  }

  /**
   * ASENKRON güvenli ana zincir oluşturma fonksiyonu.
   */
  async buildChain(trackData, masterFader, busInputs, allStrips) {
    if (this.buildingChain || this.isDisposed) return;
    
    try {
      this.buildingChain = true;
      await this._cleanupAsync(); // <-- Hatanın olduğu yer, artık fonksiyon mevcut.
      
      let lastNodeInChain = await this._buildEffectChain(trackData, allStrips);
      
      if (this.panner) {
        lastNodeInChain.connect(this.panner);
        lastNodeInChain = this.panner;
      }
      lastNodeInChain.connect(this.fader);
      this.fader.connect(this.outputNode);

      this._buildOutputRouting(trackData, masterFader, busInputs);
      this._buildSendRouting(trackData, busInputs);
      
    } catch (error) {
      console.error(`[MIXER] Chain building hatası ${this.id}:`, error);
    } finally {
      this.buildingChain = false;
    }
  }

  /**
   * ASENKRON temizlik - Race condition'ları (zamanlama hatalarını) önler.
   */
  _cleanupAsync() {
    return new Promise((resolve) => {
      this.inputNode.disconnect();
      this.outputNode.disconnect();
      this.sidechainDependencies.clear();

      this.effects.forEach(fx => { try { fx.dispose(); } catch (e) {} });
      this.effects.clear();

      this.sends.forEach(s => { try { s.dispose(); } catch (e) {} });
      this.sends.clear();

      this.scheduledMeterEvents.forEach(id => { try { Tone.Transport.clear(id); } catch (e) {} });
      this.scheduledMeterEvents.clear();

      setTimeout(resolve, 5); // Web Audio API'nin temizlik için zamanı olduğundan emin ol.
    });
  }

  /**
   * Efekt zincirini ve ilgili mekanizmaları (metering, sidechain) kurar.
   */
  async _buildEffectChain(trackData, allStrips) {
    let lastNodeInChain = this.inputNode;
    
    for (const fxData of (trackData.insertEffects || [])) {
      if (fxData.bypass || this.isDisposed) continue;
      
      const effectInstance = PluginNodeFactory.create(fxData);
      if (effectInstance) {
        this.effects.set(fxData.id, effectInstance);
        if (effectInstance.input) {
          lastNodeInChain.connect(effectInstance.input);
          lastNodeInChain = effectInstance.output;
        }

        if (fxData.type === 'Compressor') {
          this._setupCompressorMetering(fxData, effectInstance);
          if (fxData.settings.sidechainSource) {
            this._setupSidechainConnection(fxData, effectInstance, allStrips);
          }
        }
      }
    }
    return lastNodeInChain;
  }

  _setupSidechainConnection(fxData, effectInstance, allStrips) {
    const sourceId = fxData.settings.sidechainSource;
    if (!sourceId || !effectInstance.sidechainInput) return;

    if (this._checkForCircularReference(sourceId, allStrips)) {
        console.warn(`[SIDECHAIN] Döngüsel referans engellendi: ${sourceId} -> ${this.id}`);
        return;
    }
    
    const sourceStrip = allStrips.get(sourceId);
    if (sourceStrip) {
        sourceStrip.outputNode.connect(effectInstance.sidechainInput);
        this.sidechainDependencies.add(sourceId);
    }
  }

  _checkForCircularReference(sourceId, allStrips, visited = new Set()) {
      if (visited.has(sourceId)) return true;
      visited.add(sourceId);
      const sourceStrip = allStrips.get(sourceId);
      if (!sourceStrip) return false;
      for (const dependencyId of sourceStrip.sidechainDependencies) {
          if (dependencyId === this.id) return true;
          if (this._checkForCircularReference(dependencyId, allStrips, visited)) {
              return true;
          }
      }
      return false;
  }

  _setupCompressorMetering(fxData, effectInstance) {
    const compressorNode = effectInstance.input;
    const eventId = Tone.Transport.scheduleRepeat(() => {
      if (this.isDisposed) {
        Tone.Transport.clear(eventId);
        return;
      }
      const value = compressorNode.reduction;
      if (isFinite(value)) {
        MeteringService.publish(`${this.id}-${fxData.id}`, value);
      }
    }, "16n");
    this.scheduledMeterEvents.add(eventId);
  }

  _buildOutputRouting(trackData, masterFader, busInputs) {
    let outputTarget = busInputs.get(trackData.outputTarget);
    if (!outputTarget && trackData.type !== 'master') {
      outputTarget = masterFader;
    }
    if (outputTarget) {
      this.outputNode.connect(outputTarget);
    }
  }

  _buildSendRouting(trackData, busInputs) {
    (trackData.sends || []).forEach(sendData => {
        const targetBusInput = busInputs.get(sendData.busId);
        if (targetBusInput) {
            const sendNode = new Tone.Volume(sendData.level).connect(targetBusInput);
            this.sends.set(sendData.busId, sendNode);
            this.inputNode.connect(sendNode);
        }
    });
  }

  updateParam(param, value) {
    if (param === 'volume' && this.fader) this.fader.volume.value = value;
    if (param === 'pan' && this.panner) this.panner.pan.value = value;
  }
  
  updateEffectParam(effectId, param, value) {
      this.effects.get(effectId)?.updateParam(param, value);
  }

  dispose() {
    this.isDisposed = true;
    this.buildingChain = false;
    this._cleanupAsync().then(() => {
      this.inputNode.dispose();
      this.outputNode.dispose();
      this.fader.dispose();
      this.panner?.dispose();
    });
  }
}