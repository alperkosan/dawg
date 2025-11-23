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

    // 🎛️ SIDECHAIN: Track sidechain connections for effects (e.g., Compressor)
    // effectId → { sourceInsertId, sourceNode }
    this.sidechainConnections = new Map();

    // Connected instruments
    this.instruments = new Set(); // Bağlı instrument ID'leri

    // Send routing (reverb bus, delay bus, etc.)
    this.sends = new Map(); // busId → { gain, destination }

    // Analyzer for metering
    this.analyzer = this.audioContext.createAnalyser();
    this.analyzer.fftSize = 256;
    this.analyzer.smoothingTimeConstant = 0.8;

    // Control states
    this.isMuted = false;
    this.isMono = false;
    this.savedGain = 0.8; // For mute/unmute

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

    // 🔍 DEBUG: Log instrument connection
    console.log(`🔌 Connecting instrument to ${this.insertId}:`, {
      instrumentId,
      hasOutput: !!instrumentOutput,
      outputType: instrumentOutput?.constructor?.name,
      connectedInstruments: this.instruments.size
    });

    try {
      instrumentOutput.connect(this.input);
      this.instruments.add(instrumentId);
      console.log(`✅ Instrument ${instrumentId} connected to ${this.insertId}`);
      console.log(`   Total instruments on ${this.insertId}: ${this.instruments.size}`);
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
   * @param {string} effectId - AudioEngine effect ID (Map key)
   * @param {AudioNode} effectNode - Effect audio node
   * @param {object} settings - Effect settings
   * @param {boolean} bypass - Bypass state
   * @param {string} effectType - Effect type (e.g., 'MultiBandEQ', 'Reverb')
   */
  addEffect(effectId, effectNode, settings = {}, bypass = false, effectType = null) {
    if (this.effects.has(effectId)) {
      console.warn(`⚠️ Effect ${effectId} already exists in ${this.insertId}`);
      return;
    }

    // 🔍 DEBUG: Log effect addition
    console.log(`➕ Adding effect to ${this.insertId}:`, {
      effectId,
      effectType,
      nodeType: effectNode?.constructor?.name,
      hasNode: !!effectNode,
      bypass,
      settingsKeys: Object.keys(settings)
    });

    // ✅ SIMPLIFIED: Single ID system - effectId is the only identifier
    // Store effect type for special handling (e.g., MultiBandEQ message-based params)
    this.effects.set(effectId, {
      id: effectId, // Store ID for lookup compatibility (AudioContextService.getEffectNode)
      node: effectNode,
      settings,
      bypass,
      type: effectType // Store effect type for parameter routing
    });

    this.effectOrder.push(effectId);

    console.log(`📋 After adding - effectOrder: [${this.effectOrder.join(', ')}]`);
    console.log(`📋 After adding - effects.size: ${this.effects.size}`);

    this._rebuildChain();

    if (import.meta.env.DEV) {
      console.log(`🎛️ Added effect ${effectType || effectId} to ${this.insertId}`);
    }
  }

  /**
   * Effect'i kaldır
   */
  removeEffect(effectId) {
    const effect = this.effects.get(effectId);
    if (!effect) {
      return;
    }

    // 🎛️ SIDECHAIN: Cleanup sidechain connection if exists
    const sidechainConnection = this.sidechainConnections.get(effectId);
    if (sidechainConnection) {
      try {
        if (sidechainConnection.sourceNode && sidechainConnection.sourceNode.disconnect) {
          sidechainConnection.sourceNode.disconnect(effect.node, 1);
          console.log(`🔌 Cleaned up sidechain connection for ${effectId}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error cleaning up sidechain for ${effectId}:`, error);
      }
      this.sidechainConnections.delete(effectId);
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
   * Reorder effects without losing settings
   * @param {number} sourceIndex - Current index of effect
   * @param {number} destinationIndex - New index for effect
   */
  reorderEffects(sourceIndex, destinationIndex) {
    if (sourceIndex < 0 || sourceIndex >= this.effectOrder.length) {
      console.warn(`⚠️ Invalid source index: ${sourceIndex}`);
      return;
    }
    if (destinationIndex < 0 || destinationIndex >= this.effectOrder.length) {
      console.warn(`⚠️ Invalid destination index: ${destinationIndex}`);
      return;
    }

    // Reorder the effectOrder array without touching the effects Map
    const [movedEffectId] = this.effectOrder.splice(sourceIndex, 1);
    this.effectOrder.splice(destinationIndex, 0, movedEffectId);

    console.log(`🔄 Reordered effects in ${this.insertId}: [${this.effectOrder.join(', ')}]`);

    // Rebuild signal chain with new order (settings are preserved in effects Map)
    this._rebuildChain();
  }

  /**
   * Effect bypass toggle
   */
  setEffectBypass(effectId, bypass) {
    const effect = this.effects.get(effectId);
    if (!effect) {
      console.warn(`⚠️ Effect ${effectId} not found for bypass toggle`);
      return;
    }

    console.log(`🔄 setEffectBypass called: ${effectId}, bypass=${bypass}, current=${effect.bypass}`);
    console.log(`  📊 Effect details:`, {
      hasSettings: !!effect.settings,
      settingsKeys: effect.settings ? Object.keys(effect.settings) : [],
      type: effect.type,
      hasNode: !!effect.node,
      nodeType: effect.node?.constructor?.name
    });

    if (effect.bypass !== bypass) {
      effect.bypass = bypass;

      // ⚡ FIX: Reapply settings when enabling effect (bypass = false)
      if (!bypass && effect.settings) {
        console.log(`🔄 Reapplying settings for ${effectId} after bypass toggle`, effect.settings);
        this.updateEffectSettings(effectId, effect.settings);
      } else if (!bypass && !effect.settings) {
        console.warn(`⚠️ No settings found for ${effectId}, cannot reapply`);
      }

      this._rebuildChain();
      console.log(`⏭️ Effect ${effectId} bypass: ${bypass}`);
    } else {
      console.log(`  ℹ️ Already in desired bypass state, skipping`);
    }
  }

  /**
   * Update effect settings (parameters)
   * ⚡ FIX: Apply settings to effect node (for AudioWorklet effects like MultiBandEQ)
   */
  updateEffectSettings(effectId, settings) {
    const effect = this.effects.get(effectId);
    if (!effect || !effect.node) {
      console.warn(`⚠️ Effect ${effectId} not found for settings update`);
      return;
    }

    // Update stored settings
    effect.settings = { ...effect.settings, ...settings };

    // 🎛️ SIDECHAIN: Handle sidechain source routing for Compressor
    if (effect.type === 'Compressor' && settings.scSourceId !== undefined) {
      this.updateSidechainSource(effectId, settings.scSourceId);
    }

    // Apply settings to effect node
    // AudioWorklet effects use postMessage
    if (effect.node.port && effect.type === 'MultiBandEQ') {
      console.log(`📤 Posting settings to AudioWorklet: ${effectId}`, settings);
      effect.node.port.postMessage({
        type: 'updateSettings',
        settings: settings
      });
    }
    // Native Web Audio effects use direct property assignment
    else if (effect.node.parameters) {
      Object.entries(settings).forEach(([key, value]) => {
        if (effect.node.parameters.has(key)) {
          effect.node.parameters.get(key).value = value;
        }
      });
    }

    console.log(`✅ Updated settings for ${effectId}`);
  }

  /**
   * 🎛️ SIDECHAIN: Update sidechain source for an effect
   * @param {string} effectId - Effect ID
   * @param {string} sourceInsertId - Source mixer insert ID (empty string = disconnect)
   * @param {function} getSourceInsert - Callback to get source MixerInsert by ID
   */
  updateSidechainSource(effectId, sourceInsertId, getSourceInsert = null) {
    const effect = this.effects.get(effectId);
    if (!effect || !effect.node) {
      console.warn(`⚠️ Effect ${effectId} not found for sidechain routing`);
      return;
    }

    // Check if effect supports sidechain (has 2 inputs)
    if (effect.node.numberOfInputs < 2) {
      console.warn(`⚠️ Effect ${effectId} does not support sidechain (needs 2 inputs)`);
      return;
    }

    // Disconnect existing sidechain if any
    const existingConnection = this.sidechainConnections.get(effectId);
    if (existingConnection) {
      try {
        if (existingConnection.sourceNode && existingConnection.sourceNode.disconnect) {
          existingConnection.sourceNode.disconnect(effect.node, 1); // Disconnect from input 1
          console.log(`🔌 Disconnected sidechain from ${effectId}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error disconnecting sidechain from ${effectId}:`, error);
      }
      this.sidechainConnections.delete(effectId);
    }

    // Connect new sidechain source if provided
    if (sourceInsertId && getSourceInsert) {
      const sourceInsert = getSourceInsert(sourceInsertId);
      if (sourceInsert && sourceInsert.output) {
        try {
          // Connect source insert's output to effect's input 1 (sidechain)
          sourceInsert.output.connect(effect.node, 0, 1);
          this.sidechainConnections.set(effectId, {
            sourceInsertId,
            sourceNode: sourceInsert.output
          });
          console.log(`🎛️ Connected sidechain: ${sourceInsertId} → ${effectId} (input 1)`);
        } catch (error) {
          console.error(`❌ Failed to connect sidechain ${sourceInsertId} → ${effectId}:`, error);
        }
      } else {
        console.warn(`⚠️ Source insert ${sourceInsertId} not found for sidechain`);
      }
    }
  }

  /**
   * Signal chain'i yeniden kur
   * input → effects (not bypassed) → gain → pan → analyzer → output
   */
  _rebuildChain() {
    try {
      // 🔍 DEBUG: Log chain rebuild start
      console.log(`🔧 Rebuilding chain for ${this.insertId}`);
      console.log(`  📊 Effect order: [${this.effectOrder.join(', ')}]`);
      console.log(`  📊 Effects map size: ${this.effects.size}`);

      // Log all effects in the map
      this.effects.forEach((effect, effectId) => {
        console.log(`  📌 Effect in map: ${effectId}`, {
          hasNode: !!effect.node,
          nodeType: effect.node?.constructor?.name,
          bypass: effect.bypass
        });
      });

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
      let connectedEffects = 0;

      // Add non-bypassed effects
      for (const effectId of this.effectOrder) {
        const effect = this.effects.get(effectId);
        if (effect && !effect.bypass && effect.node) {
          console.log(`  ✅ Connecting effect: ${effectId} (${effect.node.constructor.name})`);
          currentNode.connect(effect.node);
          currentNode = effect.node;
          connectedEffects++;
        } else {
          console.warn(`  ⚠️ Skipping effect: ${effectId}`, {
            exists: !!effect,
            bypass: effect?.bypass,
            hasNode: !!effect?.node
          });
        }
      }

      console.log(`  📊 Connected effects: ${connectedEffects}/${this.effectOrder.length}`);

      // Complete chain: effects → gain → pan → analyzer → output
      currentNode.connect(this.gainNode);
      this.gainNode.connect(this.panNode);
      this.panNode.connect(this.analyzer);
      this.analyzer.connect(this.output);

      console.log(`  ✅ Chain complete: input → ${connectedEffects} effects → gain → pan → analyzer → output`);

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
   * Mute/Unmute toggle
   */
  setMute(muted) {
    this.isMuted = muted;

    if (muted) {
      // Save current gain and mute
      this.savedGain = this.gainNode.gain.value;
      this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    } else {
      // Restore saved gain
      this.gainNode.gain.setValueAtTime(this.savedGain, this.audioContext.currentTime);
    }

    console.log(`🔇 ${this.insertId}: ${muted ? 'Muted' : 'Unmuted'}`);
  }

  /**
   * Mono/Stereo toggle
   */
  setMono(mono) {
    this.isMono = mono;

    if (mono) {
      // Center pan (mono)
      this.panNode.pan.setValueAtTime(0, this.audioContext.currentTime);
    }
    // Note: User can adjust pan after disabling mono

    console.log(`🎚️ ${this.insertId}: ${mono ? 'Mono' : 'Stereo'}`);
  }

  /**
   * Solo toggle
   * @param {boolean} soloed - Whether this channel is soloed
   * @param {boolean} isAnySoloed - Whether any channel is soloed
   */
  setSolo(soloed, isAnySoloed) {
    if (isAnySoloed) {
      // If any channel is soloed, mute all non-soloed channels
      if (!soloed) {
        this.setMute(true);
      } else {
        this.setMute(false);
      }
    } else {
      // No solo active, restore normal mute state
      // This will be handled by store's mutedChannels state
      this.setMute(false);
    }

    console.log(`🎧 ${this.insertId}: Solo=${soloed}, AnySoloed=${isAnySoloed}`);
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
