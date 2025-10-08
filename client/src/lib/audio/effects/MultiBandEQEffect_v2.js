/**
 * MultiBandEQ Effect V2 - Message-based dynamic bands
 *
 * Simplified architecture:
 * - UI sends bands array via updateParameter('bands', bandsArray)
 * - Effect sends message to worklet
 * - Worklet recalculates coefficients
 * - Audio processes with new settings
 *
 * NO MORE parameter mapping complexity!
 */

export class MultiBandEQEffect {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.workletNode = null;
    this.bands = [];
    this.initialized = false;
  }

  async initialize(settings = {}) {
    if (this.initialized) return;

    try {
      // Load worklet
      await this.audioContext.audioWorklet.addModule('/worklets/effects/multiband-eq-processor-v2.js');

      // Create worklet node
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'multiband-eq-processor-v2',
        {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          processorOptions: {
            sampleRate: this.audioContext.sampleRate
          }
        }
      );

      // Initialize bands from settings
      this.bands = settings.bands || [
        { id: 'band-1', type: 'lowshelf', frequency: 100, gain: 0, q: 0.71, active: true },
        { id: 'band-2', type: 'peaking', frequency: 1000, gain: 0, q: 1.5, active: true },
        { id: 'band-3', type: 'highshelf', frequency: 8000, gain: 0, q: 0.71, active: true }
      ];

      // Send initial bands to worklet
      this.sendBandsToWorklet();

      this.initialized = true;
      console.log('[MultiBandEQV2] Initialized with', this.bands.length, 'bands');
    } catch (error) {
      console.error('[MultiBandEQV2] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Send bands array to worklet via message port
   */
  sendBandsToWorklet() {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({
      type: 'updateBands',
      bands: this.bands
    });
  }

  /**
   * Update effect parameter
   * Main API used by UI: onChange('bands', newBandsArray)
   */
  updateParameter(param, value) {
    if (param === 'bands') {
      this.bands = value;
      this.sendBandsToWorklet();
      console.log('[MultiBandEQV2] Updated', this.bands.length, 'bands');
    } else if (param === 'wet' && this.workletNode) {
      this.workletNode.parameters.get('wet').value = value;
    } else if (param === 'output' && this.workletNode) {
      this.workletNode.parameters.get('output').value = value;
    }
  }

  /**
   * Get input node for audio routing
   */
  getInputNode() {
    return this.workletNode;
  }

  /**
   * Get output node for audio routing
   */
  getOutputNode() {
    return this.workletNode;
  }

  /**
   * Bypass effect
   */
  bypass(bypassed) {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({
      type: 'bypass',
      value: bypassed
    });
  }

  /**
   * Cleanup
   */
  dispose() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    this.initialized = false;
  }
}
