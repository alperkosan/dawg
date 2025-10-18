/**
 * @file constants.js
 * @description Proje genelinde kullanılan sabitleri ve "sihirli string'leri" merkezileştirir.
 * Bu dosya, kodun daha okunabilir, yönetilebilir ve hataya daha az eğilimli olmasını sağlar.
 */

// --- Çalma (Playback) Durumları ---
export const PLAYBACK_STATES = Object.freeze({
  STOPPED: 'stopped',
  PLAYING: 'playing',
  PAUSED: 'paused',
});

// --- Çalma Modları ---
export const PLAYBACK_MODES = Object.freeze({
  PATTERN: 'pattern',
  SONG: 'song',
});

// --- Enstrüman Tipleri ---
export const INSTRUMENT_TYPES = Object.freeze({
  SAMPLE: 'sample',
  SYNTH: 'synth',
  VASYNTH: 'vasynth',  // Native Web Audio Virtual Analog Synth
});

// --- Mikser Kanal Tipleri ---
export const MIXER_TRACK_TYPES = Object.freeze({
  MASTER: 'master',
  TRACK: 'track',
  BUS: 'bus',
});

// --- Piano Roll Araçları ---
export const PIANO_ROLL_TOOLS = Object.freeze({
  SELECTION: 'selection',
  PENCIL: 'pencil',
  ERASER: 'eraser',
  SPLIT: 'split',
});

// --- Dosya Sistemi ve Sürükle-Bırak Tipleri ---
export const FILE_SYSTEM_TYPES = Object.freeze({
  FOLDER: 'folder',
  FILE: 'file',
});

export const DND_TYPES = Object.freeze({
  SOUND_SOURCE: 'soundSource',
});

// --- Panel ID'leri ---
export const PANEL_IDS = Object.freeze({
  ARRANGEMENT: 'arrangement',
  CHANNEL_RACK: 'channel-rack',
  MIXER: 'mixer',
  MIXER_2: 'mixer-2', // NEW: FL Studio style mixer with cable overlay
  PIANO_ROLL: 'piano-roll',
  SAMPLE_EDITOR: 'sample-editor',
  FILE_BROWSER: 'file-browser',
  KEYBINDINGS: 'keybindings',
  THEME_EDITOR: 'theme-editor',
  SYNTH_EDITOR: 'synth-editor',
});
