/**
 * MixerCpuTelemetry
 * ------------------
 * Lightweight telemetry bus that keeps track of estimated CPU load per mixer insert.
 * This does not read real DSP thread metrics (not available in browsers) – instead it
 * aggregates weighted heuristics (effect types, send count, instrument density, etc.)
 * so the UI can highlight "heavy" channels and correlate with auto-sleep decisions.
 */

const cpuState = new Map();
const listeners = new Set();

const BROADCAST_INTERVAL_MS = 100;
let lastBroadcast = 0;

const now = () =>
  typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();

const notify = (payload) => {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error('[MixerCpuTelemetry] Listener error:', error);
    }
  });
};

export const MixerCpuTelemetry = {
  /**
   * Update telemetry for a mixer insert
   * @param {string} insertId
   * @param {object} payload
   */
  update(insertId, payload = {}) {
    if (!insertId) return;

    const entry = {
      insertId,
      load: Math.max(0, Math.min(1, Number(payload.load) || 0)),
      effectScore: Number(payload.effectScore) || 0,
      effects: payload.effects || [],
      sendCount: payload.sendCount || 0,
      instrumentCount: payload.instrumentCount || 0,
      sleeping: !!payload.sleeping,
      timestamp: now()
    };

    cpuState.set(insertId, entry);

    const elapsed = entry.timestamp - lastBroadcast;
    if (elapsed >= BROADCAST_INTERVAL_MS) {
      notify(entry);
      lastBroadcast = entry.timestamp;
    }
  },

  /**
   * Subscribe to telemetry updates
   * @param {(entry: object) => void} listener
   * @returns {() => void} unsubscribe
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('MixerCpuTelemetry.subscribe expects a function');
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  get(insertId) {
    return cpuState.get(insertId);
  },

  getAll() {
    return Array.from(cpuState.values());
  },

  clear() {
    cpuState.clear();
  }
};

