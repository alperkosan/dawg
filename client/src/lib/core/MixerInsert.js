import { MixerCpuTelemetry } from '../telemetry/MixerCpuTelemetry';

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

const EFFECT_CPU_WEIGHT_MAP = {
  saturator: 3.2,
  modernreverb: 4.5,
  moderndelay: 3.6,
  ott: 3.0,
  limiter: 2.5,
  multibandeq: 2.2,
  compressor: 2.0,
  clipper: 1.8,
  transientdesigner: 1.7,
  stardustchorus: 1.6,
  tidalfilter: 1.4,
  default: 1.0
};

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

    // Analyzer for metering (LAZY - created on first getMeterLevel call)
    this._analyzer = null;
    this._analyzerConnected = false;

    // Auto-sleep (silence detection)
    this.autoSleepConfig = {
      enabled: insertId !== 'master',
      threshold: 0.00018,
      wakeThreshold: 0.00035,
      sleepAfterMs: 1000,
      wakeAfterMs: 150,
      pollIntervalMs: 250
    };
    this._autoSleepState = {
      isSleeping: false,
      belowTimer: 0,
      aboveTimer: 0,
      lastSampleTime: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      monitorHandle: null
    };

    // Control states
    this.isMuted = false;
    this.isMono = false;
    this.savedGain = 0.8; // For mute/unmute

    // Default values
    this.gainNode.gain.value = 0.8;  // 0dB'ye yakın
    this.panNode.pan.value = 0;      // Center

    // Initial routing (no effects)
    this._rebuildChain();

    // ✅ OPTIMIZATION: Auto-sleep monitoring is now handled by MixerInsertManager
    // Individual per-insert timers replaced with a single global timer
    // this._initAutoSleepMonitor(); // DISABLED - managed globally

    // Only log in dev mode
    if (import.meta.env.DEV) {
      console.log(`✅ MixerInsert created: ${insertId} (${label})`);
    }
  }

  /**
   * Instrument'i bu insert'e bağla
   * @param {string} instrumentId - Instrument ID
   * @param {AudioNode} instrumentOutput - Instrument output node
   * @returns {boolean} - Bağlantı başarılı mı
   */
  connectInstrument(instrumentId, instrumentOutput) {
    if (this.instruments.has(instrumentId)) {
      console.warn(`⚠️ Instrument ${instrumentId} already connected to ${this.insertId}`);
      return true; // Already connected is considered success
    }

    // ✅ FIX: Validate instrumentOutput before attempting connection
    if (!instrumentOutput) {
      console.error(`❌ Cannot connect instrument ${instrumentId}: output is null/undefined`);
      return false;
    }

    // ✅ FIX: Check if output has connect method (is a valid AudioNode)
    if (typeof instrumentOutput.connect !== 'function') {
      console.error(`❌ Cannot connect instrument ${instrumentId}: output is not a valid AudioNode`);
      return false;
    }

    // 🔍 DEBUG: Log instrument connection (only in DEV)
    if (import.meta.env.DEV) {
      console.log(`🔌 Connecting instrument to ${this.insertId}:`, {
        instrumentId,
        hasOutput: !!instrumentOutput,
        outputType: instrumentOutput?.constructor?.name,
        connectedInstruments: this.instruments.size
      });
    }

    try {
      instrumentOutput.connect(this.input);
      this.instruments.add(instrumentId);
      
      if (import.meta.env.DEV) {
        console.log(`✅ Instrument ${instrumentId} connected to ${this.insertId}`);
        console.log(`   Total instruments on ${this.insertId}: ${this.instruments.size}`);
      }
      return true; // ✅ Success
    } catch (error) {
      console.error(`❌ Failed to connect instrument ${instrumentId}:`, error);
      // ✅ FIX: Don't add to tracking if connection failed
      return false;
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
    this._rebuildChain();

    // ✅ PERFORMANCE: Only log in DEV mode
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
   * ✅ OPTIMIZED: Uses incremental chain segment rebuild instead of full rebuild
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
    if (sourceIndex === destinationIndex) {
      return; // No change needed
    }

    // Reorder the effectOrder array without touching the effects Map
    const [movedEffectId] = this.effectOrder.splice(sourceIndex, 1);
    this.effectOrder.splice(destinationIndex, 0, movedEffectId);

    if (import.meta.env.DEV) {
      console.log(`🔄 Reordered effects in ${this.insertId}: [${this.effectOrder.join(', ')}]`);
    }

    // ✅ OPTIMIZATION: Try incremental segment rebuild first
    const minIndex = Math.min(sourceIndex, destinationIndex);
    const maxIndex = Math.max(sourceIndex, destinationIndex);
    
    const success = this._rebuildChainSegment(minIndex, maxIndex);
    
    if (!success) {
      // Fallback to full rebuild if segment rebuild fails
      if (import.meta.env.DEV) {
        console.log(`⚠️ Incremental reorder failed, falling back to full rebuild`);
      }
      this._rebuildChain();
    }
  }

  /**
   * ✅ OPTIMIZATION: Rebuild only a segment of the effect chain
   * @param {number} startIndex - Start index (inclusive)
   * @param {number} endIndex - End index (inclusive)
   * @returns {boolean} Success status
   */
  _rebuildChainSegment(startIndex, endIndex) {
    try {
      // Get the node before the segment
      const prevNode = this._getActiveNodeBefore(startIndex);
      if (!prevNode) return false;

      // Disconnect all nodes in the segment
      for (let i = startIndex; i <= endIndex; i++) {
        const effectId = this.effectOrder[i];
        const effect = this.effects.get(effectId);
        if (effect && effect.node) {
          try {
            effect.node.disconnect();
          } catch (e) { /* May not be connected */ }
        }
      }

      // Also disconnect prevNode to break the chain
      try {
        prevNode.disconnect();
      } catch (e) { /* May not be connected */ }

      // Reconnect the segment in new order
      let currentNode = prevNode;
      
      for (let i = startIndex; i <= endIndex; i++) {
        const effectId = this.effectOrder[i];
        const effect = this.effects.get(effectId);
        
        if (effect && !effect.bypass && effect.node) {
          currentNode.connect(effect.node);
          currentNode = effect.node;
        }
      }

      // Connect to the next node after the segment
      const nextNode = this._getActiveNodeAfter(endIndex);
      if (nextNode) {
        currentNode.connect(nextNode);
      } else {
        // Connect to gainNode if no more effects
        currentNode.connect(this.gainNode);
      }

      if (import.meta.env.DEV) {
        console.log(`✅ Segment rebuilt: indices ${startIndex}-${endIndex}`);
      }

      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`⚠️ Segment rebuild failed:`, error);
      }
      return false;
    }
  }

  /**
   * Effect bypass toggle
   * ✅ OPTIMIZED: Uses incremental chain update instead of full rebuild
   */
  setEffectBypass(effectId, bypass) {
    const effect = this.effects.get(effectId);
    if (!effect) {
      console.warn(`⚠️ Effect ${effectId} not found for bypass toggle`);
      return;
    }

    if (effect.bypass === bypass) {
      return; // No change needed
    }

    effect.bypass = bypass;

    // ⚡ FIX: Reapply settings when enabling effect (bypass = false)
    if (!bypass && effect.settings) {
      this.updateEffectSettings(effectId, effect.settings);
    }

    // ✅ OPTIMIZATION: Try incremental update first, fallback to full rebuild
    const success = this._updateEffectBypassIncremental(effectId, bypass);
    
    if (!success) {
      // Fallback to full rebuild if incremental update fails
      if (import.meta.env.DEV) {
        console.log(`⚠️ Incremental bypass failed, falling back to full rebuild`);
      }
      this._rebuildChain();
    }
    
    // ✅ PERFORMANCE: Only log in DEV mode
    if (import.meta.env.DEV) {
      console.log(`⏭️ Effect ${effectId} bypass: ${bypass} (incremental: ${success})`);
    }
  }

  /**
   * ✅ OPTIMIZATION: Incremental bypass update
   * Only reconnects the affected portion of the chain instead of full rebuild
   * @returns {boolean} Success status
   */
  _updateEffectBypassIncremental(effectId, bypass) {
    try {
      const effectIndex = this.effectOrder.indexOf(effectId);
      if (effectIndex === -1) return false;

      const effect = this.effects.get(effectId);
      if (!effect || !effect.node) return false;

      // Get previous and next active nodes in chain
      const prevNode = this._getActiveNodeBefore(effectIndex);
      const nextNode = this._getActiveNodeAfter(effectIndex);

      if (!prevNode || !nextNode) return false;

      if (bypass) {
        // BYPASS ON: Disconnect effect, connect prev → next
        try {
          prevNode.disconnect(effect.node);
        } catch (e) { /* May not be connected */ }
        
        try {
          effect.node.disconnect(nextNode);
        } catch (e) { /* May not be connected */ }
        
        // Connect around the bypassed effect
        prevNode.connect(nextNode);
      } else {
        // BYPASS OFF: Insert effect back into chain
        try {
          prevNode.disconnect(nextNode);
        } catch (e) { /* May not be connected */ }
        
        // Connect prev → effect → next
        prevNode.connect(effect.node);
        effect.node.connect(nextNode);
      }

      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`⚠️ Incremental bypass update failed:`, error);
      }
      return false;
    }
  }

  /**
   * Get the active (non-bypassed) node before the given index
   * @private
   */
  _getActiveNodeBefore(index) {
    // Search backwards for first non-bypassed effect
    for (let i = index - 1; i >= 0; i--) {
      const effectId = this.effectOrder[i];
      const effect = this.effects.get(effectId);
      if (effect && !effect.bypass && effect.node) {
        return effect.node;
      }
    }
    // No active effect before, return input
    return this.input;
  }

  /**
   * Get the active (non-bypassed) node after the given index
   * @private
   */
  _getActiveNodeAfter(index) {
    // Search forwards for first non-bypassed effect
    for (let i = index + 1; i < this.effectOrder.length; i++) {
      const effectId = this.effectOrder[i];
      const effect = this.effects.get(effectId);
      if (effect && !effect.bypass && effect.node) {
        return effect.node;
      }
    }
    // No active effect after, return gainNode (next in chain)
    return this.gainNode;
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
    const isDev = import.meta.env.DEV;
    
    try {
      // ✅ PERFORMANCE: Only log in DEV mode
      if (isDev) {
        console.log(`🔧 Rebuilding chain for ${this.insertId}`);
      }

      // Disconnect all first
      this.input.disconnect();
      this.gainNode.disconnect();
      this.panNode.disconnect();
      if (this._analyzer) {
        try { this._analyzer.disconnect(); } catch (e) {}
      }

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

      const skipEffects = this.autoSleepConfig.enabled && this._autoSleepState?.isSleeping;

      // Add non-bypassed effects (unless auto-sleeping)
      for (const effectId of this.effectOrder) {
        const effect = this.effects.get(effectId);
        if (skipEffects) {
          if (isDev) {
            console.log(`  ⏸️ Auto-sleep active → skipping effect chain for ${this.insertId}`);
          }
          break;
        }

        if (effect && !effect.bypass && effect.node) {
          currentNode.connect(effect.node);
          currentNode = effect.node;
          connectedEffects++;
        }
      }

      // Complete chain: effects → gain → pan → [analyzer] → output
      // ✅ OPTIMIZED: Analyzer is optional (lazy creation)
      currentNode.connect(this.gainNode);
      this.gainNode.connect(this.panNode);
      
      if (this._analyzer) {
        this.panNode.connect(this._analyzer);
        this._analyzer.connect(this.output);
        this._analyzerConnected = true;
      } else {
        this.panNode.connect(this.output);
      }

      if (isDev) {
        console.log(`  ✅ Chain: input → ${connectedEffects} effects → gain → pan → analyzer → output`);
      }

      this._pushCpuTelemetry(this._calculateCpuMetrics(connectedEffects));

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
   * ✅ LAZY: Get or create analyzer node
   * Only created when metering is actually needed (saves ~0.5% CPU per track)
   */
  getAnalyzer() {
    if (!this._analyzer) {
      this._analyzer = this.audioContext.createAnalyser();
      this._analyzer.fftSize = 256;
      this._analyzer.smoothingTimeConstant = 0.8;
      
      // Insert analyzer into chain: pan → analyzer → output
      if (!this._analyzerConnected) {
        try {
          this.panNode.disconnect(this.output);
          this.panNode.connect(this._analyzer);
          this._analyzer.connect(this.output);
          this._analyzerConnected = true;
        } catch (e) {
          // Chain might not be built yet, will be connected in _rebuildChain
        }
      }
      
      if (import.meta.env.DEV) {
        console.log(`📊 Lazy analyzer created for ${this.insertId}`);
      }
    }
    return this._analyzer;
  }

  /**
   * Meter seviyesini al (visualization için)
   * ✅ OPTIMIZED: Returns 0 if analyzer not yet created (saves CPU)
   */
  getMeterLevel() {
    // If analyzer not created yet, return 0 (no metering overhead)
    if (!this._analyzer) return 0;
    
    const dataArray = new Uint8Array(this._analyzer.frequencyBinCount);
    this._analyzer.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / dataArray.length);
    return rms;
  }

  /**
   * Initialize auto-sleep polling loop
   */
  _initAutoSleepMonitor() {
    if (!this.autoSleepConfig.enabled || this._autoSleepState.monitorHandle) {
      return;
    }

    const interval = Math.max(100, this.autoSleepConfig.pollIntervalMs);
    this._autoSleepState.monitorHandle = setInterval(() => {
      try {
        this._evaluateAutoSleep();
      } catch (error) {
        console.warn(`⚠️ Auto-sleep monitor error (${this.insertId}):`, error);
      }
    }, interval);
  }

  _evaluateAutoSleep() {
    if (!this.autoSleepConfig.enabled) {
      return;
    }
    
    // ✅ OPTIMIZED: Skip if no analyzer (no metering = no sleep detection)
    // This is fine because tracks without metering are likely not visible anyway
    if (!this._analyzer) {
      return;
    }

    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const delta = now - (this._autoSleepState.lastSampleTime || now);
    this._autoSleepState.lastSampleTime = now;

    const level = this.getMeterLevel();

    if (level < this.autoSleepConfig.threshold) {
      this._autoSleepState.belowTimer += delta;
      this._autoSleepState.aboveTimer = 0;
    } else {
      this._autoSleepState.aboveTimer += delta;
      this._autoSleepState.belowTimer = 0;
    }

    const shouldSleep =
      !this._autoSleepState.isSleeping &&
      this._autoSleepState.belowTimer >= this.autoSleepConfig.sleepAfterMs;

    const shouldWake =
      this._autoSleepState.isSleeping &&
      level > this.autoSleepConfig.wakeThreshold &&
      this._autoSleepState.aboveTimer >= this.autoSleepConfig.wakeAfterMs;

    if (shouldSleep) {
      this._setAutoSleepState(true);
    } else if (shouldWake) {
      this._setAutoSleepState(false);
    }
  }

  _setAutoSleepState(shouldSleep) {
    if (!this.autoSleepConfig.enabled) return;
    if (this._autoSleepState.isSleeping === shouldSleep) return;

    this._autoSleepState.isSleeping = shouldSleep;
    this._autoSleepState.belowTimer = 0;
    this._autoSleepState.aboveTimer = 0;

    console.log(
      shouldSleep
        ? `😴 Auto-sleep enabled for ${this.insertId}`
        : `🔔 Auto-sleep disabled for ${this.insertId}`
    );

    this._rebuildChain();
    if (shouldSleep) {
      this._pushCpuTelemetry({
        load: 0.05,
        effectScore: 0,
        sendCount: this.sends.size,
        instrumentCount: this.instruments.size,
        sleeping: true,
        effects: []
      });
    }
  }

  _calculateCpuMetrics(connectedEffects = 0) {
    if (!this.effects) {
      return {
        load: 0,
        effectScore: 0,
        sendCount: 0,
        instrumentCount: 0,
        sleeping: this._autoSleepState?.isSleeping || false,
        effects: []
      };
    }

    const activeEffects = [];
    let effectScore = 0;

    for (const effectId of this.effectOrder) {
      const effect = this.effects.get(effectId);
      if (effect && !effect.bypass && effect.node) {
        const effectType = (effect.type || effect.node?.constructor?.name || 'effect')
          .toString()
          .toLowerCase();
        const weight = EFFECT_CPU_WEIGHT_MAP[effectType] ?? EFFECT_CPU_WEIGHT_MAP.default;
        effectScore += weight;
        activeEffects.push({
          id: effectId,
          type: effect.type || 'unknown',
          weight
        });
      }
    }

    const sendCount = this.sends.size;
    const instrumentCount = this.instruments.size;

    let load = 0.15 + effectScore * 0.1 + sendCount * 0.06 + instrumentCount * 0.04;
    load += connectedEffects * 0.02;

    if (this._autoSleepState.isSleeping) {
      load = 0.05;
    }

    load = Math.max(0, Math.min(1, load));

    return {
      load,
      effectScore,
      sendCount,
      instrumentCount,
      sleeping: this._autoSleepState.isSleeping,
      effects: activeEffects
    };
  }

  _pushCpuTelemetry(metrics = null) {
    if (!MixerCpuTelemetry) return;
    const payload = metrics || this._calculateCpuMetrics();
    MixerCpuTelemetry.update(this.insertId, payload);
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
      if (this._analyzer) {
        this._analyzer.disconnect();
      }
      this.output.disconnect();
    } catch (error) {
      // Already disconnected
    }

    // Clear references
    this.input = null;
    this.gainNode = null;
    this.panNode = null;
    this._analyzer = null;
    this._analyzerConnected = false;
    this.output = null;

    if (this._autoSleepState?.monitorHandle) {
      clearInterval(this._autoSleepState.monitorHandle);
      this._autoSleepState.monitorHandle = null;
    }

    console.log(`✅ MixerInsert disposed: ${this.insertId}`);
  }
}
