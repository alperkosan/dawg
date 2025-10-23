/**
 * MixerInsert - Dinamik mixer kanal yönetimi
 *
 * Her mixer insert:
 * - Bir veya daha fazla instrument'i kabul eder
 * - Effect chain'i yönetir
 * - Pan/Gain kontrolü sağlar
 * - Master bus'a veya başka insert'lere send yapar
 *
 * Lifecycle:
 * - Track eklendiğinde oluşturulur
 * - Track silindiğinde dispose edilir
 * - Bellekten tamamen temizlenir
 */

export class MixerInsert {
  constructor(audioContext, insertId, label = '') {
    this.audioContext = audioContext;
    this.insertId = insertId;
    this.label = label;

    // Audio graph nodes
    this.input = this.audioContext.createGain();       // Instruments buraya bağlanır
    this.gainNode = this.audioContext.createGain();    // Volume control
    this.panNode = this.audioContext.createStereoPanner(); // Pan control
    this.output = this.audioContext.createGain();      // Master bus'a gider

    // Effect chain
    this.effects = new Map(); // effectId → { node, settings, bypass }
    this.effectOrder = [];     // Effect sıralaması

    // Connected instruments
    this.instruments = new Set(); // Bağlı instrument ID'leri

    // Send routing (reverb bus, delay bus, etc.)
    this.sends = new Map(); // busId → { gain, destination }

    // Analyzer for metering
    this.analyzer = this.audioContext.createAnalyser();
    this.analyzer.fftSize = 256;
    this.analyzer.smoothingTimeConstant = 0.8;

    // Default values
    this.gainNode.gain.value = 0.8;  // 0dB'ye yakın
    this.panNode.pan.value = 0;      // Center

    // Initial routing (no effects)
    this._rebuildChain();

    // Only log in dev mode
    if (import.meta.env.DEV) {
      console.log(`✅ MixerInsert created: ${insertId} (${label})`);
    }
  }

  /**
   * Instrument'i bu insert'e bağla
   */
  connectInstrument(instrumentId, instrumentOutput) {
    if (this.instruments.has(instrumentId)) {
      console.warn(`⚠️ Instrument ${instrumentId} already connected to ${this.insertId}`);
      return;
    }

    try {
      instrumentOutput.connect(this.input);
      this.instruments.add(instrumentId);
      // Only log errors, not every connection
    } catch (error) {
      console.error(`❌ Failed to connect instrument ${instrumentId}:`, error);
    }
  }

  /**
   * Instrument bağlantısını kes
   */
  disconnectInstrument(instrumentId, instrumentOutput) {
    if (!this.instruments.has(instrumentId)) {
      return;
    }

    try {
      instrumentOutput.disconnect(this.input);
      this.instruments.delete(instrumentId);
      console.log(`🔌 Disconnected instrument ${instrumentId} from ${this.insertId}`);
    } catch (error) {
      console.warn(`⚠️ Error disconnecting instrument ${instrumentId}:`, error);
    }
  }

  /**
   * Effect ekle
   */
  addEffect(effectId, effectNode, settings = {}, bypass = false) {
    if (this.effects.has(effectId)) {
      console.warn(`⚠️ Effect ${effectId} already exists in ${this.insertId}`);
      return;
    }

    this.effects.set(effectId, {
      node: effectNode,
      settings,
      bypass
    });

    this.effectOrder.push(effectId);
    this._rebuildChain();

    console.log(`🎛️ Added effect ${effectId} to ${this.insertId}`);
  }

  /**
   * Effect'i kaldır
   */
  removeEffect(effectId) {
    const effect = this.effects.get(effectId);
    if (!effect) {
      return;
    }

    // Dispose effect node
    try {
      if (effect.node.disconnect) {
        effect.node.disconnect();
      }
      if (effect.node.dispose) {
        effect.node.dispose();
      }
    } catch (error) {
      console.warn(`⚠️ Error disposing effect ${effectId}:`, error);
    }

    this.effects.delete(effectId);
    this.effectOrder = this.effectOrder.filter(id => id !== effectId);
    this._rebuildChain();

    console.log(`🗑️ Removed effect ${effectId} from ${this.insertId}`);
  }

  /**
   * Effect bypass toggle
   */
  setEffectBypass(effectId, bypass) {
    const effect = this.effects.get(effectId);
    if (!effect) {
      return;
    }

    if (effect.bypass !== bypass) {
      effect.bypass = bypass;
      this._rebuildChain();
      console.log(`⏭️ Effect ${effectId} bypass: ${bypass}`);
    }
  }

  /**
   * Signal chain'i yeniden kur
   * input → effects (not bypassed) → gain → pan → analyzer → output
   */
  _rebuildChain() {
    try {
      // Disconnect all first
      this.input.disconnect();
      this.gainNode.disconnect();
      this.panNode.disconnect();
      this.analyzer.disconnect();

      this.effects.forEach(effect => {
        if (effect.node && effect.node.disconnect) {
          try {
            effect.node.disconnect();
          } catch (e) {
            // Already disconnected
          }
        }
      });

      // Build chain
      let currentNode = this.input;

      // Add non-bypassed effects
      for (const effectId of this.effectOrder) {
        const effect = this.effects.get(effectId);
        if (effect && !effect.bypass && effect.node) {
          currentNode.connect(effect.node);
          currentNode = effect.node;
        }
      }

      // Complete chain: effects → gain → pan → analyzer → output
      currentNode.connect(this.gainNode);
      this.gainNode.connect(this.panNode);
      this.panNode.connect(this.analyzer);
      this.analyzer.connect(this.output);

    } catch (error) {
      console.error(`❌ Error rebuilding chain for ${this.insertId}:`, error);
    }
  }

  /**
   * Volume ayarla
   */
  setGain(value) {
    if (this.gainNode) {
      const now = this.audioContext.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(value, now + 0.015);
    }
  }

  /**
   * Pan ayarla
   */
  setPan(value) {
    if (this.panNode) {
      const now = this.audioContext.currentTime;
      this.panNode.pan.cancelScheduledValues(now);
      this.panNode.pan.setValueAtTime(this.panNode.pan.value, now);
      this.panNode.pan.linearRampToValueAtTime(value, now + 0.015);
    }
  }

  /**
   * Master bus'a bağla
   */
  connectToMaster(masterInput) {
    try {
      this.output.connect(masterInput);
      // Only log errors, not every connection
    } catch (error) {
      console.error(`❌ Failed to connect ${this.insertId} to master:`, error);
    }
  }

  /**
   * Master bus'tan kes
   */
  disconnectFromMaster(masterInput) {
    try {
      this.output.disconnect(masterInput);
      console.log(`🔌 ${this.insertId} ✗ master bus`);
    } catch (error) {
      // Already disconnected
    }
  }

  /**
   * Send bus'a bağla (reverb, delay, etc.)
   */
  addSend(busId, busInput, sendLevel = 0.5) {
    if (this.sends.has(busId)) {
      console.warn(`⚠️ Send to ${busId} already exists`);
      return;
    }

    const sendGain = this.audioContext.createGain();
    sendGain.gain.value = sendLevel;

    // Tap from analyzer (post-fader)
    this.analyzer.connect(sendGain);
    sendGain.connect(busInput);

    this.sends.set(busId, {
      gain: sendGain,
      destination: busInput
    });

    console.log(`📤 Send: ${this.insertId} → ${busId} (${sendLevel})`);
  }

  /**
   * Send seviyesini ayarla
   */
  setSendLevel(busId, level) {
    const send = this.sends.get(busId);
    if (send && send.gain) {
      const now = this.audioContext.currentTime;
      send.gain.gain.cancelScheduledValues(now);
      send.gain.gain.setValueAtTime(send.gain.gain.value, now);
      send.gain.gain.linearRampToValueAtTime(level, now + 0.015);
    }
  }

  /**
   * Send'i kaldır
   */
  removeSend(busId) {
    const send = this.sends.get(busId);
    if (!send) {
      return;
    }

    try {
      this.analyzer.disconnect(send.gain);
      send.gain.disconnect(send.destination);
    } catch (error) {
      // Already disconnected
    }

    this.sends.delete(busId);
    console.log(`📥 Send removed: ${this.insertId} ✗ ${busId}`);
  }

  /**
   * Meter seviyesini al (visualization için)
   */
  getMeterLevel() {
    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    this.analyzer.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / dataArray.length);
    return rms;
  }

  /**
   * Temizlik - tüm kaynakları serbest bırak
   */
  dispose() {
    console.log(`🗑️ Disposing MixerInsert: ${this.insertId}`);

    // Disconnect all instruments
    this.instruments.clear();

    // Remove all effects
    this.effectOrder.forEach(effectId => {
      this.removeEffect(effectId);
    });

    // Remove all sends
    Array.from(this.sends.keys()).forEach(busId => {
      this.removeSend(busId);
    });

    // Disconnect all nodes
    try {
      this.input.disconnect();
      this.gainNode.disconnect();
      this.panNode.disconnect();
      this.analyzer.disconnect();
      this.output.disconnect();
    } catch (error) {
      // Already disconnected
    }

    // Clear references
    this.input = null;
    this.gainNode = null;
    this.panNode = null;
    this.analyzer = null;
    this.output = null;

    console.log(`✅ MixerInsert disposed: ${this.insertId}`);
  }
}
