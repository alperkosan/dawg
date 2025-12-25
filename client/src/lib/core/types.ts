/**
 * Type definitions for the Audio Engine Facade and Services
 * 
 * @module lib/core/types
 */

// =================== AUDIO ENGINE ===================

export interface AudioEngineCallbacks {
    onLevelsUpdate?: (levels: LevelMeterData) => void;
    onPositionUpdate?: (position: number) => void;
    onPlaybackStateChange?: (isPlaying: boolean) => void;
    onError?: (error: Error) => void;
}

export interface AudioEngineOptions {
    sampleRate?: number;
    bufferSize?: number;
    useWasmMixer?: boolean;
    maxChannels?: number;
}

export interface LevelMeterData {
    left: number;
    right: number;
    peak: number;
}

export interface EngineStats {
    audioContext: {
        state: string;
        sampleRate: number;
        currentTime: number;
    };
    isInitialized: boolean;
    instrumentCount: number;
    mixerInsertCount: number;
    playbackState: {
        isPlaying: boolean;
        position: number;
        bpm: number;
    };
    performance: {
        cpuUsage: number;
        latency: number;
        dropouts: number;
    };
}

// =================== INSTRUMENTS ===================

export interface InstrumentData {
    id: string;
    name: string;
    type: 'sampler' | 'synth' | 'drumKit' | 'audio';
    mixerTrackId?: string;
    settings?: Record<string, any>;
    samples?: SampleData[];
}

export interface SampleData {
    id: string;
    name: string;
    url: string;
    pitch?: number;
    velocityRange?: [number, number];
}

export interface InstrumentInstance {
    id: string;
    type: string;
    output: GainNode | null;
    triggerNote: (pitch: number, velocity: number, time: number) => void;
    releaseNote: (pitch: number, time: number) => void;
    stopAllVoices: () => void;
    allNotesOff: () => void;
    setMute?: (muted: boolean) => void;
    dispose: () => void;
}

// =================== MIXER ===================

export interface MixerTrack {
    id: string;
    name: string;
    type: 'track' | 'bus' | 'master';
    volume: number; // dB
    pan: number; // -1 to 1
    isMuted: boolean;
    isSolo: boolean;
    color: string;
    output: string | null;
    sends: SendConfig[];
    insertEffects: EffectInstance[];
    eq: EQSettings;
}

export interface SendConfig {
    busId: string;
    level: number;
    preFader: boolean;
}

export interface EQSettings {
    enabled: boolean;
    lowGain: number;
    midGain: number;
    highGain: number;
}

export interface EffectInstance {
    id: string;
    type: string;
    settings: Record<string, any>;
    bypass: boolean;
}

// =================== PLAYBACK ===================

export interface PlaybackState {
    isPlaying: boolean;
    isPaused: boolean;
    currentPosition: number;
    playbackMode: 'pattern' | 'song';
    loopSettings: LoopSettings;
}

export interface LoopSettings {
    start: number;
    end: number;
    length: number;
    enabled: boolean;
    auto: boolean;
}

// =================== COMMANDS ===================

export interface ICommand {
    name: string;
    timestamp: number;
    execute(): any;
    undo(): any;
    getDescription(): string;
}

export interface CommandEvent {
    action: 'execute' | 'undo' | 'redo' | 'clear';
    command: ICommand | null;
    canUndo: boolean;
    canRedo: boolean;
}

export type CommandListener = (event: CommandEvent) => void;

// =================== OBJECT POOL ===================

export interface PooledNote {
    id: string | null;
    pitch: number;
    velocity: number;
    step: number;
    duration: number;
    startTime: number;
    endTime: number;
    instrumentId: string | null;
    isActive: boolean;
}

export interface PooledVoice {
    id: string | null;
    instrumentId: string | null;
    pitch: number;
    velocity: number;
    startTime: number;
    releaseTime: number;
    state: 'free' | 'attack' | 'sustain' | 'release';
    gain: number;
    pan: number;
}

export interface PooledEvent {
    id: string | null;
    type: string | null;
    time: number;
    data: any;
    executed: boolean;
    cancelled: boolean;
}

export interface PoolStats {
    available: number;
    active: number;
    total: number;
}

// =================== SERVICES ===================

export interface IInstrumentService {
    createInstrument(data: InstrumentData): Promise<InstrumentInstance>;
    removeInstrument(instrumentId: string): void;
    getInstrument(instrumentId: string): InstrumentInstance | null;
    setInstrumentMute(instrumentId: string, muted: boolean): void;
}

export interface IMixerService {
    createMixerInsert(insertId: string, label?: string): any;
    removeMixerInsert(insertId: string): void;
    setChannelVolume(channelId: string, volume: number): void;
    setChannelPan(channelId: string, pan: number): void;
    setChannelMute(channelId: string, muted: boolean): void;
    setMasterVolume(volume: number): void;
}

export interface ITransportService {
    setBPM(bpm: number): void;
    play(startStep?: number): void;
    stop(): void;
    pause(): void;
    setLoopPoints(start: number, end: number): void;
}

export interface IEffectService {
    addEffectToInsert(insertId: string, effectType: string, settings?: Record<string, any>): Promise<string>;
    removeEffectFromInsert(insertId: string, effectId: string): void;
    updateEffectParameter(insertId: string, effectId: string, param: string, value: any): void;
    toggleEffectOnInsert(insertId: string, effectId: string): void;
}

export interface ISchedulerService {
    scheduleNote(instrumentId: string, note: PooledNote, startTime: number, duration: number): string;
    cancelNote(instrumentId: string, noteId: string): void;
    cancelAll(): void;
    start(): void;
    stop(): void;
}
