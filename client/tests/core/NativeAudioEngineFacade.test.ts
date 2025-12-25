/**
 * @fileoverview Integration tests for NativeAudioEngineFacade
 * Tests the facade pattern implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('@/lib/core/NativeTransportSystem.js', () => ({
    NativeTransportSystem: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        setBPM: vi.fn(),
        dispose: vi.fn(),
        linkAudioEngine: vi.fn()
    }))
}));

vi.mock('@/lib/audio/ImprovedWorkletManager.js', () => ({
    ImprovedWorkletManager: vi.fn().mockImplementation(() => ({
        loadMultipleWorklets: vi.fn().mockResolvedValue([{ status: 'fulfilled' }]),
        dispose: vi.fn()
    }))
}));

vi.mock('@/lib/core/PlaybackManager.js', () => ({
    PlaybackManager: vi.fn().mockImplementation(() => ({
        play: vi.fn(),
        stop: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        on: vi.fn(),
        setPlaybackMode: vi.fn(),
        getPlaybackMode: vi.fn(() => 'pattern'),
        setLoopPoints: vi.fn(),
        setLoopEnabled: vi.fn(),
        enableAutoLoop: vi.fn(),
        jumpToStep: vi.fn(),
        jumpToBar: vi.fn(),
        getCurrentPosition: vi.fn(() => 0),
        getLoopInfo: vi.fn(() => ({ start: 0, end: 64 })),
        isPlaying: false,
        _updateLoopSettings: vi.fn(),
        _scheduleContent: vi.fn()
    }))
}));

vi.mock('@/lib/core/WasmAudioEngine.js', () => ({
    wasmAudioEngine: {
        initialize: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('@/lib/core/UnifiedMixerNode.js', () => ({
    UnifiedMixerNode: vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(true),
        connect: vi.fn(),
        dispose: vi.fn(),
        onLevelsUpdate: null
    }))
}));

vi.mock('@/lib/utils/audioUtils.js', () => ({
    setGlobalAudioContext: vi.fn()
}));

vi.mock('@/lib/utils/debugLogger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    },
    NAMESPACES: { AUDIO: 'audio', PERFORMANCE: 'performance' }
}));

vi.mock('@/lib/core/MixerInsertManager.js', () => ({
    mixerInsertManager: {
        setAudioEngine: vi.fn(),
        startGlobalMonitor: vi.fn(),
        stopGlobalMonitor: vi.fn()
    }
}));

vi.mock('@/lib/core/utils/LatencyCompensator.js', () => ({
    LatencyCompensator: vi.fn()
}));

// Import after mocks
import { NativeAudioEngineFacade, createAudioEngine } from '@/lib/core/NativeAudioEngineFacade.js';

// Mock AudioContext
const createMockAudioContext = () => ({
    createGain: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setValueAtTime: vi.fn() }
    })),
    createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 256,
        smoothingTimeConstant: 0.8,
        frequencyBinCount: 128,
        getByteFrequencyData: vi.fn()
    })),
    destination: {},
    currentTime: 0,
    sampleRate: 48000,
    state: 'running',
    close: vi.fn(),
    resume: vi.fn()
});

// Mock global AudioContext
global.AudioContext = vi.fn().mockImplementation(createMockAudioContext);
global.window = { AudioContext: global.AudioContext };

describe('NativeAudioEngineFacade', () => {
    let facade;

    beforeEach(() => {
        facade = new NativeAudioEngineFacade();
    });

    describe('Initialization', () => {
        it('should create facade with default state', () => {
            expect(facade.isInitialized).toBe(false);
            expect(facade.audioContext).toBeNull();
            expect(facade.useWasmMixer).toBe(true);
        });

        it('should have lazy-loaded services', () => {
            // Services should exist via getters
            expect(facade.instrumentService).toBeDefined();
            expect(facade.mixerService).toBeDefined();
            expect(facade.transportService).toBeDefined();
            expect(facade.effectService).toBeDefined();
            expect(facade.workletService).toBeDefined();
            expect(facade.performanceService).toBeDefined();
        });

        it('should have legacy compatibility maps', () => {
            expect(facade.instruments).toBeInstanceOf(Map);
            expect(facade.mixerInserts).toBeInstanceOf(Map);
            expect(facade.instrumentToInsert).toBeInstanceOf(Map);
        });
    });

    describe('Service Delegation', () => {
        it('should delegate instrument operations to InstrumentService', () => {
            expect(typeof facade.createInstrument).toBe('function');
            expect(typeof facade.removeInstrument).toBe('function');
            expect(typeof facade.setInstrumentMute).toBe('function');
        });

        it('should delegate mixer operations to MixerService', () => {
            expect(typeof facade.createMixerInsert).toBe('function');
            expect(typeof facade.setChannelVolume).toBe('function');
            expect(typeof facade.setChannelPan).toBe('function');
            expect(typeof facade.setMasterVolume).toBe('function');
        });

        it('should delegate effect operations to EffectService', () => {
            expect(typeof facade.addEffectToInsert).toBe('function');
            expect(typeof facade.removeEffectFromInsert).toBe('function');
            expect(typeof facade.toggleEffectOnInsert).toBe('function');
        });

        it('should delegate transport operations to TransportService', () => {
            expect(typeof facade.play).toBe('function');
            expect(typeof facade.stop).toBe('function');
            expect(typeof facade.pause).toBe('function');
            expect(typeof facade.setBPM).toBe('function');
        });
    });

    describe('Playback Control', () => {
        it('should have play/stop/pause methods', () => {
            // Should not throw when not initialized
            expect(() => facade.play()).not.toThrow();
            expect(() => facade.stop()).not.toThrow();
            expect(() => facade.pause()).not.toThrow();
        });

        it('should have loop control methods', () => {
            expect(typeof facade.setLoopPoints).toBe('function');
            expect(typeof facade.setLoopEnabled).toBe('function');
            expect(typeof facade.enableAutoLoop).toBe('function');
        });

        it('should have position methods', () => {
            expect(typeof facade.jumpToStep).toBe('function');
            expect(typeof facade.jumpToBar).toBe('function');
            expect(typeof facade.getCurrentPosition).toBe('function');
            expect(typeof facade.getLoopInfo).toBe('function');
        });
    });

    describe('Pattern Management', () => {
        it('should have setActivePattern method', () => {
            expect(typeof facade.setActivePattern).toBe('function');
        });

        it('should have schedulePattern method', () => {
            expect(typeof facade.schedulePattern).toBe('function');
        });
    });

    describe('Audition', () => {
        it('should have audition methods', () => {
            expect(typeof facade.auditionNoteOn).toBe('function');
            expect(typeof facade.auditionNoteOff).toBe('function');
        });
    });

    describe('Stats & Analysis', () => {
        it('should have getEngineStats method', () => {
            expect(typeof facade.getEngineStats).toBe('function');
        });

        it('should have getAnalysisData method', () => {
            expect(typeof facade.getAnalysisData).toBe('function');
        });
    });

    describe('Cleanup', () => {
        it('should have dispose method', () => {
            expect(typeof facade.dispose).toBe('function');
        });
    });

    describe('Factory Function', () => {
        it('should export createAudioEngine factory', () => {
            const engine = createAudioEngine();
            expect(engine).toBeInstanceOf(NativeAudioEngineFacade);
        });
    });
});
