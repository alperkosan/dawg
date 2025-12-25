/**
 * Type definitions for DAWG Store Layer
 * These types provide IntelliSense and type checking for the Zustand stores.
 */

// ============================================================================
// PLAYBACK STORE TYPES
// ============================================================================

export type PlaybackMode = 'PATTERN' | 'SONG';
export type PlaybackState = 'STOPPED' | 'PLAYING' | 'PAUSED' | 'RECORDING';
export type FollowPlayheadMode = 'CONTINUOUS' | 'PAGE' | 'OFF';

export interface PlaybackStoreState {
    isPlaying: boolean;
    playbackState: PlaybackState;
    playbackMode: PlaybackMode;
    bpm: number;
    masterVolume: number;
    transportPosition: string;
    transportStep: number;
    loopEnabled: boolean;
    audioLoopLength: number;
    currentStep: number;
    ghostPosition: number | null;
    loopStartStep: number;
    loopEndStep: number;
    followPlayheadMode: FollowPlayheadMode;
    keyboardPianoMode: boolean;
    _isInitialized: boolean;
    _currentPositionMode: 'pattern' | 'song';
}

export interface PlaybackStoreActions {
    togglePlayPause: () => Promise<void>;
    handleStop: () => Promise<void>;
    jumpToStep: (step: number) => Promise<void>;
    setCurrentStep: (step: number) => void;
    handleBpmChange: (newBpm: number) => Promise<void>;
    setLoopEnabled: (enabled: boolean) => Promise<void>;
    setLoopRange: (startStep: number, endStep: number) => Promise<void>;
    setPlaybackMode: (mode: PlaybackMode) => Promise<void>;
    updateLoopLength: () => void;
    handleMasterVolumeChange: (volume: number) => Promise<void>;
    setFollowPlayheadMode: (mode: FollowPlayheadMode) => void;
    cycleFollowPlayheadMode: () => void;
    setKeyboardPianoMode: (active: boolean) => void;
    getController: () => Promise<any>;
    destroy: () => void;
}

export type PlaybackStore = PlaybackStoreState & PlaybackStoreActions;

// ============================================================================
// ARRANGEMENT STORE TYPES
// ============================================================================

export interface Pattern {
    id: string;
    name: string;
    data: Record<string, any[]>; // instrumentId -> notes
    settings?: {
        length?: number;
        quantization?: string;
    };
    ccLanes?: any;
    length?: number;
}

export interface Track {
    id: string;
    name: string;
    height: number;
    volume: number;
    pan: number;
    muted: boolean;
    solo: boolean;
    locked: boolean;
    collapsed: boolean;
}

export interface Clip {
    id: string;
    type: 'audio' | 'pattern';
    trackId: string;
    startTime: number;
    duration: number;
    name: string;
    muted: boolean;
    locked: boolean;
    // Audio clip specific
    assetId?: string;
    sampleOffset?: number;
    playbackRate?: number;
    fadeIn?: number;
    fadeOut?: number;
    gain?: number;
    // Pattern clip specific
    patternId?: string;
    instrumentId?: string;
    loopCount?: number;
    patternOffset?: number;
}

export interface ArrangementStoreState {
    patterns: Record<string, Pattern>;
    patternOrder: string[];
    tracks: Track[];
    clips: Clip[];
    activePatternId: string | null;
    songLength: number;
    zoomX: number;
    nextPatternNumber: number;
    arrangementTracks: Track[];
    arrangementClips: Clip[];
    selectedClipIds: string[];
    clipboard: any;
    arrangementMarkers: any[];
    arrangementLoopRegions: any[];
    loopRegions: any[];
}

// ============================================================================
// THEME STORE TYPES
// ============================================================================

export interface ThemeColors {
    backgroundDeep: string;
    background: string;
    surface: string;
    surfaceRaised: string;
    border: string;
    borderSubtle: string;
    primary: string;
    accent: string;
    text: string;
    textMuted: string;
    textHeading: string;
}

export interface ZenithTokens {
    'bg-primary': string;
    'bg-secondary': string;
    'bg-tertiary': string;
    'accent-hot': string;
    'accent-warm': string;
    'accent-cool': string;
    'accent-cold': string;
    'success': string;
    'warning': string;
    'error': string;
    'info': string;
    'text-primary': string;
    'text-secondary': string;
    'text-tertiary': string;
    'text-disabled': string;
    'border-strong': string;
    'border-medium': string;
    'border-subtle': string;
    'radius-sm': string;
    'radius-md': string;
    'radius-lg': string;
    'radius-xl': string;
    'font-primary': string;
    'font-mono': string;
    [key: string]: string;
}

export interface Theme {
    id: string;
    name: string;
    colors: ThemeColors;
    zenith: ZenithTokens;
}

export interface ThemeStoreState {
    themes: Theme[];
    activeThemeId: string;
}

export interface ThemeStoreActions {
    getActiveTheme: () => Theme;
    setActiveThemeId: (themeId: string) => void;
    addTheme: (newTheme: Partial<Theme>) => void;
    updateTheme: (themeId: string, properties: Partial<Theme>) => void;
    deleteTheme: (themeId: string) => void;
}

export type ThemeStore = ThemeStoreState & ThemeStoreActions;

// ============================================================================
// MIXER STORE TYPES
// ============================================================================

export interface MixerChannel {
    id: string;
    name: string;
    volume: number;
    pan: number;
    mute: boolean;
    solo: boolean;
    mono: boolean;
    effectChain: string[];
    sends: Record<string, number>;
    inputSource: string | null;
    color: string;
}

export interface MixerStoreState {
    channels: Record<string, MixerChannel>;
    masterChannel: MixerChannel;
    selectedChannelId: string | null;
    returnTracks: Record<string, any>;
}

// ============================================================================
// INSTRUMENTS STORE TYPES
// ============================================================================

export type InstrumentType = 'sampler' | 'synth' | 'ai' | 'audio';

export interface Instrument {
    id: string;
    name: string;
    type: InstrumentType;
    color: string;
    icon: string;
    muted: boolean;
    solo: boolean;
    volume: number;
    pan: number;
    trackId: string | null;
    samples?: any[];
    presetPath?: string;
}

export interface InstrumentsStoreState {
    instruments: Record<string, Instrument>;
    instrumentOrder: string[];
    activeInstrumentId: string | null;
}
