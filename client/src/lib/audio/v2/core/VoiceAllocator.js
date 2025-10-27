/**
 * VoiceAllocator.js
 *
 * Advanced voice allocation and stealing strategies.
 * Polyphonic ve monophonic voice management.
 *
 * Özellikler:
 * - Multiple stealing strategies (Oldest, Quietest, Round-Robin)
 * - Voice pool management
 * - Note priority tracking
 * - Sustain pedal support
 */

/**
 * Voice stealing strategies
 */
export const VoiceStealStrategy = {
  OLDEST: 'oldest',             // Steal oldest note
  QUIETEST: 'quietest',         // Steal quietest note
  ROUND_ROBIN: 'round_robin',   // Cycle through voices
  LOWEST: 'lowest',             // Steal lowest note
  HIGHEST: 'highest',           // Steal highest note
};

/**
 * Voice modes
 */
export const VoiceMode = {
  POLY: 'poly',                 // Polyphonic
  MONO: 'mono',                 // Monophonic
  LEGATO: 'legato',             // Legato (mono with special envelope handling)
};

/**
 * Voice state
 */
export const VoiceState = {
  IDLE: 'idle',
  ATTACK: 'attack',
  SUSTAIN: 'sustain',
  RELEASE: 'release',
};

/**
 * Voice info
 */
class VoiceInfo {
  constructor(voice, index) {
    this.voice = voice;           // Actual voice object
    this.index = index;           // Voice pool index
    this.note = -1;               // MIDI note number (-1 = not playing)
    this.velocity = 0;            // Note velocity
    this.startTime = 0;           // When note started
    this.releaseTime = 0;         // When note was released (0 = not released)
    this.state = VoiceState.IDLE; // Current state
    this.age = 0;                 // Age counter for round-robin
  }

  /**
   * Check if voice is idle
   */
  isIdle() {
    return this.state === VoiceState.IDLE || this.note === -1;
  }

  /**
   * Check if voice is in release
   */
  isReleasing() {
    return this.state === VoiceState.RELEASE;
  }

  /**
   * Check if voice is playing
   */
  isPlaying() {
    return !this.isIdle();
  }

  /**
   * Get current amplitude (for quietest stealing)
   */
  getAmplitude() {
    if (!this.voice || !this.voice.getAmplitude) {
      return 0;
    }
    return this.voice.getAmplitude();
  }
}

/**
 * VoiceAllocator - Manages voice pool and allocation
 */
export class VoiceAllocator {
  constructor(voiceFactory, maxVoices = 16) {
    this.voiceFactory = voiceFactory;
    this.maxVoices = maxVoices;

    // Voice pool
    this.voices = [];

    // Voice stealing strategy
    this.stealStrategy = VoiceStealStrategy.OLDEST;

    // Voice mode
    this.voiceMode = VoiceMode.POLY;

    // Round-robin counter
    this.roundRobinIndex = 0;

    // Age counter
    this.ageCounter = 0;

    // Sustain pedal
    this.sustainPedal = false;
    this.sustainedNotes = new Set();

    // Note priority stack (for mono mode)
    this.notePriorityStack = [];

    // Initialize voice pool
    this._initVoicePool();
  }

  /**
   * Initialize voice pool
   */
  _initVoicePool() {
    for (let i = 0; i < this.maxVoices; i++) {
      const voice = this.voiceFactory(i);
      const voiceInfo = new VoiceInfo(voice, i);
      this.voices.push(voiceInfo);
    }
  }

  /**
   * Note on - Allocate voice
   */
  noteOn(note, velocity, time) {
    // Mono mode handling
    if (this.voiceMode === VoiceMode.MONO || this.voiceMode === VoiceMode.LEGATO) {
      return this._noteOnMono(note, velocity, time);
    }

    // Poly mode handling
    return this._noteOnPoly(note, velocity, time);
  }

  /**
   * Note off - Release voice
   */
  noteOff(note, time) {
    // Check sustain pedal
    if (this.sustainPedal) {
      this.sustainedNotes.add(note);
      return;
    }

    // Find all voices playing this note
    const activeVoices = this.voices.filter((v) => v.note === note && v.isPlaying());

    for (const voiceInfo of activeVoices) {
      voiceInfo.state = VoiceState.RELEASE;
      voiceInfo.releaseTime = time || performance.now();

      // Call voice release
      if (voiceInfo.voice && voiceInfo.voice.release) {
        voiceInfo.voice.release(time);
      }
    }

    // Remove from priority stack (mono mode)
    this.notePriorityStack = this.notePriorityStack.filter((n) => n !== note);

    // Mono mode: trigger next note in stack
    if (
      (this.voiceMode === VoiceMode.MONO || this.voiceMode === VoiceMode.LEGATO) &&
      this.notePriorityStack.length > 0
    ) {
      const nextNote = this.notePriorityStack[this.notePriorityStack.length - 1];
      const velocity = 100; // TODO: Store original velocity
      this.noteOn(nextNote, velocity, time);
    }
  }

  /**
   * Poly mode note on
   */
  _noteOnPoly(note, velocity, time) {
    // Find idle voice
    let voiceInfo = this.voices.find((v) => v.isIdle());

    // No idle voice - steal one
    if (!voiceInfo) {
      voiceInfo = this._stealVoice();
    }

    if (!voiceInfo) {
      console.warn('[VoiceAllocator] No voice available');
      return null;
    }

    // Configure voice
    voiceInfo.note = note;
    voiceInfo.velocity = velocity;
    voiceInfo.startTime = time || performance.now();
    voiceInfo.releaseTime = 0;
    voiceInfo.state = VoiceState.ATTACK;
    voiceInfo.age = this.ageCounter++;

    // Trigger voice
    if (voiceInfo.voice && voiceInfo.voice.noteOn) {
      voiceInfo.voice.noteOn(note, velocity, time);
    }

    return voiceInfo.voice;
  }

  /**
   * Mono mode note on
   */
  _noteOnMono(note, velocity, time) {
    // Add to priority stack
    if (!this.notePriorityStack.includes(note)) {
      this.notePriorityStack.push(note);
    }

    // Get first voice (mono uses only one voice)
    const voiceInfo = this.voices[0];

    // Legato mode: slide to new pitch without retriggering envelope
    if (this.voiceMode === VoiceMode.LEGATO && voiceInfo.isPlaying()) {
      voiceInfo.note = note;

      if (voiceInfo.voice && voiceInfo.voice.setPitch) {
        voiceInfo.voice.setPitch(note, time);
      }

      return voiceInfo.voice;
    }

    // Mono mode: retrigger envelope
    voiceInfo.note = note;
    voiceInfo.velocity = velocity;
    voiceInfo.startTime = time || performance.now();
    voiceInfo.releaseTime = 0;
    voiceInfo.state = VoiceState.ATTACK;

    if (voiceInfo.voice && voiceInfo.voice.noteOn) {
      voiceInfo.voice.noteOn(note, velocity, time);
    }

    return voiceInfo.voice;
  }

  /**
   * Steal a voice based on strategy
   */
  _stealVoice() {
    switch (this.stealStrategy) {
      case VoiceStealStrategy.OLDEST:
        return this._stealOldest();

      case VoiceStealStrategy.QUIETEST:
        return this._stealQuietest();

      case VoiceStealStrategy.ROUND_ROBIN:
        return this._stealRoundRobin();

      case VoiceStealStrategy.LOWEST:
        return this._stealLowest();

      case VoiceStealStrategy.HIGHEST:
        return this._stealHighest();

      default:
        return this._stealOldest();
    }
  }

  /**
   * Steal oldest voice
   */
  _stealOldest() {
    // First, try to steal releasing voices
    const releasingVoices = this.voices.filter((v) => v.isReleasing());

    if (releasingVoices.length > 0) {
      return releasingVoices.reduce((oldest, v) =>
        v.releaseTime < oldest.releaseTime ? v : oldest
      );
    }

    // Otherwise, steal oldest playing voice
    const playingVoices = this.voices.filter((v) => v.isPlaying());

    if (playingVoices.length > 0) {
      return playingVoices.reduce((oldest, v) =>
        v.age < oldest.age ? v : oldest
      );
    }

    return null;
  }

  /**
   * Steal quietest voice
   */
  _stealQuietest() {
    const playingVoices = this.voices.filter((v) => v.isPlaying());

    if (playingVoices.length === 0) return null;

    return playingVoices.reduce((quietest, v) =>
      v.getAmplitude() < quietest.getAmplitude() ? v : quietest
    );
  }

  /**
   * Steal round-robin
   */
  _stealRoundRobin() {
    const voiceInfo = this.voices[this.roundRobinIndex];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % this.maxVoices;
    return voiceInfo;
  }

  /**
   * Steal lowest note
   */
  _stealLowest() {
    const playingVoices = this.voices.filter((v) => v.isPlaying());

    if (playingVoices.length === 0) return null;

    return playingVoices.reduce((lowest, v) =>
      v.note < lowest.note ? v : lowest
    );
  }

  /**
   * Steal highest note
   */
  _stealHighest() {
    const playingVoices = this.voices.filter((v) => v.isPlaying());

    if (playingVoices.length === 0) return null;

    return playingVoices.reduce((highest, v) =>
      v.note > highest.note ? v : highest
    );
  }

  /**
   * All notes off (panic)
   */
  allNotesOff(time) {
    for (const voiceInfo of this.voices) {
      if (voiceInfo.isPlaying()) {
        voiceInfo.state = VoiceState.IDLE;
        voiceInfo.note = -1;

        if (voiceInfo.voice && voiceInfo.voice.stop) {
          voiceInfo.voice.stop(time);
        }
      }
    }

    this.sustainedNotes.clear();
    this.notePriorityStack = [];
  }

  /**
   * Sustain pedal on
   */
  sustainOn() {
    this.sustainPedal = true;
  }

  /**
   * Sustain pedal off
   */
  sustainOff(time) {
    this.sustainPedal = false;

    // Release all sustained notes
    for (const note of this.sustainedNotes) {
      this.noteOff(note, time);
    }

    this.sustainedNotes.clear();
  }

  /**
   * Set voice stealing strategy
   */
  setStealStrategy(strategy) {
    this.stealStrategy = strategy;
  }

  /**
   * Set voice mode
   */
  setVoiceMode(mode) {
    this.voiceMode = mode;

    // If switching to mono, release all but one voice
    if (mode === VoiceMode.MONO || mode === VoiceMode.LEGATO) {
      const playingVoices = this.voices.filter((v) => v.isPlaying());

      for (let i = 1; i < playingVoices.length; i++) {
        playingVoices[i].state = VoiceState.IDLE;
        playingVoices[i].note = -1;

        if (playingVoices[i].voice && playingVoices[i].voice.stop) {
          playingVoices[i].voice.stop();
        }
      }
    }
  }

  /**
   * Get voice count
   */
  getVoiceCount() {
    return this.maxVoices;
  }

  /**
   * Get active voice count
   */
  getActiveVoiceCount() {
    return this.voices.filter((v) => v.isPlaying()).length;
  }

  /**
   * Get idle voice count
   */
  getIdleVoiceCount() {
    return this.voices.filter((v) => v.isIdle()).length;
  }

  /**
   * Get voice info
   */
  getVoiceInfo(index) {
    return this.voices[index];
  }

  /**
   * Get all voices
   */
  getAllVoices() {
    return this.voices.map((v) => v.voice);
  }

  /**
   * Dispose allocator
   */
  dispose() {
    this.allNotesOff();

    for (const voiceInfo of this.voices) {
      if (voiceInfo.voice && voiceInfo.voice.dispose) {
        voiceInfo.voice.dispose();
      }
    }

    this.voices = [];
    this.sustainedNotes.clear();
    this.notePriorityStack = [];
  }
}

export default VoiceAllocator;
