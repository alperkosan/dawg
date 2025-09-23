// src/lib/audio/WorkletMessageProtocol.js

/**
 * Ana thread ve AudioWorklet processor'ları arasındaki
 * tüm mesajlaşma tiplerini tanımlayan merkezi yapı.
 */
export const WasmMessage = {
  // Main Thread -> AudioWorklet'e giden komutlar
  NOTE_ON: 'noteOn',
  NOTE_OFF: 'noteOff',
  ALL_NOTES_OFF: 'allNotesOff',
  LOAD_PATTERN: 'loadPattern',

  // AudioWorklet -> Main Thread'e dönen bilgi/durum mesajları
  NOTE_STARTED: 'noteStarted',
  NOTE_ENDED: 'noteEnded',
  PROCESSOR_READY: 'processorReady',
  HEARTBEAT: 'heartbeat',
  ERROR: 'error',
  DEBUG: 'debug',
  METERING_DATA: 'meteringData' // YENİ SATIR
};