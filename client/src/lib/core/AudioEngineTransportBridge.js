// lib/core/AudioEngineTransportBridge.js
/**
 * 🎚️ AUDIO ENGINE TRANSPORT BRIDGE
 *
 * Ses motorunun transport komutlarına nasıl cevap vermesi gerektiği:
 * 1. IMMEDIATE RESPONSE - UI hiç beklemez
 * 2. SINGLE SOURCE OF TRUTH - Audio engine = master clock
 * 3. EVENT-DRIVEN SYNC - Position updates motor'dan gelir
 * 4. ZERO-LATENCY COMMANDS - Transport komutları direkt motor'a
 */

import { PLAYBACK_STATES } from '@/config/constants.js';

export class AudioEngineTransportBridge {
  constructor(audioEngine, transportManager) {
    this.audioEngine = audioEngine;
    this.transportManager = transportManager;

    // ✅ CRITICAL: Audio engine is the master clock
    this.masterClock = audioEngine.transport;

    // State sync
    this.lastKnownState = {
      isPlaying: false,
      position: 0,
      bpm: 140
    };

    // Performance tracking
    this.commandLatency = {
      play: [],
      stop: [],
      jumpTo: []
    };

    this._bindAudioEngineEvents();
    this._setupZeroLatencyCommands();
  }

  // =================== ZERO-LATENCY TRANSPORT COMMANDS ===================

  /**
   * ✅ IMMEDIATE PLAY - UI gets instant feedback
   * Motor plays, UI updates from motor events
   */
  async play(position = null) {
    const startTime = performance.now();

    try {
      // 1. IMMEDIATE UI STATE UPDATE (optimistic)
      this.transportManager._updateStateOptimistic({
        isPlaying: true,
        playbackState: PLAYBACK_STATES.PLAYING
      });

      // 2. FIRE-AND-FORGET motor command
      this._sendMotorCommand('play', position);

      // 3. Motor will emit events when ready, UI will sync
      const latency = performance.now() - startTime;
      this._trackLatency('play', latency);

      console.log(`🎚️ Bridge: Play command sent (${latency.toFixed(2)}ms)`);
      return true;

    } catch (error) {
      // 4. ROLLBACK optimistic update on error
      this.transportManager._rollbackOptimisticUpdate();
      console.error('🎚️ Bridge: Play command failed', error);
      return false;
    }
  }

  /**
   * ✅ IMMEDIATE STOP - UI gets instant feedback
   */
  async stop() {
    const startTime = performance.now();

    try {
      // 1. IMMEDIATE UI STATE UPDATE (optimistic)
      this.transportManager._updateStateOptimistic({
        isPlaying: false,
        playbackState: PLAYBACK_STATES.STOPPED,
        currentPosition: 0 // Reset position immediately
      });

      // 2. FIRE-AND-FORGET motor command
      this._sendMotorCommand('stop');

      const latency = performance.now() - startTime;
      this._trackLatency('stop', latency);

      console.log(`🎚️ Bridge: Stop command sent (${latency.toFixed(2)}ms)`);
      return true;

    } catch (error) {
      this.transportManager._rollbackOptimisticUpdate();
      console.error('🎚️ Bridge: Stop command failed', error);
      return false;
    }
  }

  /**
   * ✅ IMMEDIATE POSITION JUMP - UI shows position instantly
   */
  async jumpToPosition(position) {
    const startTime = performance.now();

    try {
      // 1. IMMEDIATE UI POSITION UPDATE (optimistic)
      this.transportManager._updateStateOptimistic({
        currentPosition: position
      });

      // 2. FIRE-AND-FORGET motor command
      this._sendMotorCommand('jumpTo', position);

      const latency = performance.now() - startTime;
      this._trackLatency('jumpTo', latency);

      console.log(`🎚️ Bridge: Jump command sent to ${position} (${latency.toFixed(2)}ms)`);
      return true;

    } catch (error) {
      this.transportManager._rollbackOptimisticUpdate();
      console.error('🎚️ Bridge: Jump command failed', error);
      return false;
    }
  }

  // =================== MOTOR EVENT HANDLING ===================

  /**
   * ✅ MOTOR IS MASTER CLOCK - UI syncs to motor
   */
  _bindAudioEngineEvents() {
    const transport = this.audioEngine.transport;

    // Motor started -> Confirm UI state
    transport.on('start', () => {
      this.transportManager._confirmOptimisticUpdate({
        isPlaying: true,
        playbackState: PLAYBACK_STATES.PLAYING
      });
      console.log('🎚️ Bridge: Motor confirmed START');
    });

    // Motor stopped -> Confirm UI state
    transport.on('stop', () => {
      this.transportManager._confirmOptimisticUpdate({
        isPlaying: false,
        playbackState: PLAYBACK_STATES.STOPPED
      });
      console.log('🎚️ Bridge: Motor confirmed STOP');
    });

    // Motor position updates -> UI follows
    transport.on('tick', () => {
      if (this.transportManager.state.isPlaying) {
        const motorPosition = transport.ticksToSteps(transport.currentTick);
        this.transportManager._syncPosition(motorPosition);
      }
    });

    // Motor BPM change -> UI follows
    transport.on('bpmChange', (newBpm) => {
      this.transportManager._syncBpm(newBpm);
    });
  }

  // =================== ZERO-LATENCY COMMAND SYSTEM ===================

  _setupZeroLatencyCommands() {
    // Create direct command channel to motor
    this.commandChannel = {
      play: (position) => {
        if (position !== null) {
          this.audioEngine.transport.position = this._stepToTicks(position);
        }
        this.audioEngine.transport.start();
      },

      stop: () => {
        this.audioEngine.transport.stop();
        this.audioEngine.transport.position = 0;
      },

      pause: () => {
        this.audioEngine.transport.pause();
      },

      jumpTo: (position) => {
        const wasPlaying = this.audioEngine.transport.state === 'started';
        this.audioEngine.transport.position = this._stepToTicks(position);
        // Motor will emit position update
      }
    };
  }

  /**
   * ✅ FIRE-AND-FORGET command sending
   */
  _sendMotorCommand(command, ...args) {
    try {
      const commandFn = this.commandChannel[command];
      if (commandFn) {
        // Execute immediately, no await
        commandFn(...args);
      } else {
        console.warn(`🎚️ Bridge: Unknown command: ${command}`);
      }
    } catch (error) {
      console.error(`🎚️ Bridge: Motor command failed: ${command}`, error);
      throw error; // Let caller handle rollback
    }
  }

  // =================== PERFORMANCE MONITORING ===================

  _trackLatency(command, latency) {
    this.commandLatency[command].push(latency);

    // Keep only last 100 measurements
    if (this.commandLatency[command].length > 100) {
      this.commandLatency[command].shift();
    }
  }

  getPerformanceStats() {
    const stats = {};

    for (const [command, latencies] of Object.entries(this.commandLatency)) {
      if (latencies.length > 0) {
        stats[command] = {
          avg: latencies.reduce((a, b) => a + b) / latencies.length,
          min: Math.min(...latencies),
          max: Math.max(...latencies),
          count: latencies.length
        };
      }
    }

    return stats;
  }

  // =================== UTILITY METHODS ===================

  _stepToTicks(steps) {
    // Convert steps to transport ticks
    return steps * (this.audioEngine.transport.PPQ / 4); // Assuming 16th notes
  }

  _ticksToSteps(ticks) {
    // Convert transport ticks to steps
    return Math.floor(ticks / (this.audioEngine.transport.PPQ / 4));
  }

  // =================== DIAGNOSTICS ===================

  getMotorState() {
    return {
      state: this.audioEngine.transport.state,
      position: this.audioEngine.transport.position,
      bpm: this.audioEngine.transport.bpm.value,
      swing: this.audioEngine.transport.swing,
      loopStart: this.audioEngine.transport.loopStart,
      loopEnd: this.audioEngine.transport.loopEnd
    };
  }

  getSyncStatus() {
    const motorState = this.getMotorState();
    const uiState = this.transportManager.getState();

    return {
      inSync: motorState.state === (uiState.isPlaying ? 'started' : 'stopped'),
      positionDiff: Math.abs(this._ticksToSteps(motorState.position) - uiState.currentPosition),
      bpmDiff: Math.abs(motorState.bpm - uiState.bpm),
      performance: this.getPerformanceStats()
    };
  }

  /**
   * ✅ FORCE SYNC - Emergency sync UI to motor
   */
  forceSyncToMotor() {
    const motorState = this.getMotorState();

    this.transportManager._forceSyncState({
      isPlaying: motorState.state === 'started',
      playbackState: motorState.state === 'started' ? PLAYBACK_STATES.PLAYING : PLAYBACK_STATES.STOPPED,
      currentPosition: this._ticksToSteps(motorState.position),
      bpm: motorState.bpm
    });

    console.log('🎚️ Bridge: Force synced UI to motor', motorState);
  }
}