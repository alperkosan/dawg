/**
 * @fileoverview Unit tests for extracted services
 * Tests InstrumentService, MixerService, TransportService, 
 * WorkletService, EffectService, and PerformanceService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/audio/instruments/index.js', () => ({
    InstrumentFactory: {
        createPlaybackInstrument: vi.fn().mockResolvedValue({
            output: { connect: vi.fn(), disconnect: vi.fn() },
            allNotesOff: vi.fn(),
            setMute: vi.fn(),
            dispose: vi.fn()
        })
    }
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

vi.mock('@/lib/core/MixerInsert.js', () => ({
    MixerInsert: vi.fn().mockImplementation((ctx, id, label) => ({
        id,
        label,
        input: { connect: vi.fn() },
        output: { connect: vi.fn(), disconnect: vi.fn() },
        setGain: vi.fn(),
        setPan: vi.fn(),
        setMute: vi.fn(),
        disconnect: vi.fn(),
        dispose: vi.fn(),
        addEffect: vi.fn().mockReturnValue('effect-1'),
        removeEffect: vi.fn().mockReturnValue(true),
        toggleEffect: vi.fn().mockReturnValue(true),
        setEffectParam: vi.fn().mockReturnValue(true),
        getEffectChain: vi.fn().mockReturnValue([])
    }))
}));

vi.mock('@/lib/audio/effects/index.js', () => ({
    EffectFactory: {
        create: vi.fn().mockReturnValue({
            input: {},
            output: {},
            dispose: vi.fn()
        })
    }
}));

vi.mock('@/lib/audio/EffectRegistry.js', () => ({
    effectRegistry: {
        getAvailableEffects: vi.fn().mockReturnValue(['reverb', 'delay', 'compressor'])
    }
}));

import { InstrumentService } from '@/lib/core/services/InstrumentService.js';
import { MixerService } from '@/lib/core/services/MixerService.js';
import { TransportService } from '@/lib/core/services/TransportService.js';
import { WorkletService } from '@/lib/core/services/WorkletService.js';
import { EffectService } from '@/lib/core/services/EffectService.js';
import { PerformanceService } from '@/lib/core/services/PerformanceService.js';

// Mock audio context
const createMockAudioContext = () => ({
    createGain: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setValueAtTime: vi.fn() }
    })),
    createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        fftSize: 256,
        smoothingTimeConstant: 0.8
    })),
    destination: {},
    currentTime: 0,
    sampleRate: 48000,
    baseLatency: 0.01,
    outputLatency: 0.005,
    state: 'running'
});

// Mock engine
const createMockEngine = () => ({
    audioContext: createMockAudioContext(),
    isInitialized: true,
    transport: {
        setBPM: vi.fn(),
        getBPM: vi.fn(() => 140),
        getStats: vi.fn(() => ({}))
    },
    playbackManager: {
        play: vi.fn(),
        stop: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        setPlaybackMode: vi.fn(),
        getPlaybackMode: vi.fn(() => 'pattern'),
        setLoopPoints: vi.fn(),
        enableAutoLoop: vi.fn(),
        setLoopEnabled: vi.fn(),
        jumpToStep: vi.fn(),
        jumpToBar: vi.fn(),
        getCurrentPosition: vi.fn(() => 0),
        getLoopInfo: vi.fn(() => ({ start: 0, end: 64 })),
        getPlaybackStatus: vi.fn(() => ({})),
        isPlaying: false,
        _updateLoopSettings: vi.fn(),
        _scheduleContent: vi.fn()
    },
    workletManager: {
        loadMultipleWorklets: vi.fn().mockResolvedValue([
            { status: 'fulfilled' },
            { status: 'fulfilled' }
        ]),
        dispose: vi.fn(),
        getDetailedStats: vi.fn(() => ({}))
    },
    instruments: new Map(),
    mixerInserts: new Map(),
    unifiedMixer: null,
    useWasmMixer: false
});

// =================== InstrumentService Tests ===================

describe('InstrumentService', () => {
    let service;
    let mockEngine;

    beforeEach(() => {
        mockEngine = createMockEngine();
        service = new InstrumentService(mockEngine);
    });

    it('should initialize with empty maps', () => {
        expect(service.instruments.size).toBe(0);
        expect(service.sampleBuffers.size).toBe(0);
    });

    it('should have createInstrument method', () => {
        expect(typeof service.createInstrument).toBe('function');
    });

    it('should have removeInstrument method', () => {
        expect(typeof service.removeInstrument).toBe('function');
    });

    it('should have setInstrumentMute method', () => {
        expect(typeof service.setInstrumentMute).toBe('function');
    });

    it('should have allNotesOff method', () => {
        expect(typeof service.allNotesOff).toBe('function');
    });

    it('should track instrument count', () => {
        expect(service.count).toBe(0);
    });

    it('should have updateBPM method', () => {
        expect(typeof service.updateBPM).toBe('function');
    });

    it('should have cleanUnusedBuffers method', () => {
        expect(typeof service.cleanUnusedBuffers).toBe('function');
    });
});

// =================== MixerService Tests ===================

describe('MixerService', () => {
    let service;
    let mockEngine;

    beforeEach(() => {
        mockEngine = createMockEngine();
        service = new MixerService(mockEngine);
    });

    it('should initialize with empty maps', () => {
        expect(service.mixerInserts.size).toBe(0);
        expect(service.instrumentToInsert.size).toBe(0);
    });

    it('should have createMixerInsert method', () => {
        expect(typeof service.createMixerInsert).toBe('function');
    });

    it('should have setChannelVolume method', () => {
        expect(typeof service.setChannelVolume).toBe('function');
    });

    it('should have setChannelPan method', () => {
        expect(typeof service.setChannelPan).toBe('function');
    });

    it('should have setMasterVolume method', () => {
        expect(typeof service.setMasterVolume).toBe('function');
    });

    it('should have routeInstrumentToInsert method', () => {
        expect(typeof service.routeInstrumentToInsert).toBe('function');
    });

    it('should have setChannelMute method', () => {
        expect(typeof service.setChannelMute).toBe('function');
    });

    it('should have setChannelMono method', () => {
        expect(typeof service.setChannelMono).toBe('function');
    });
});

// =================== TransportService Tests ===================

describe('TransportService', () => {
    let service;
    let mockEngine;

    beforeEach(() => {
        mockEngine = createMockEngine();
        service = new TransportService(mockEngine);
    });

    it('should have play method', () => {
        expect(typeof service.play).toBe('function');
    });

    it('should have stop method', () => {
        expect(typeof service.stop).toBe('function');
    });

    it('should have pause method', () => {
        expect(typeof service.pause).toBe('function');
    });

    it('should have setBPM method', () => {
        expect(typeof service.setBPM).toBe('function');
    });

    it('should have setLoopPoints method', () => {
        expect(typeof service.setLoopPoints).toBe('function');
    });

    it('should have getCurrentPosition method', () => {
        expect(typeof service.getCurrentPosition).toBe('function');
    });

    it('should delegate play to playbackManager', () => {
        service.play(0);
        expect(mockEngine.playbackManager.play).toHaveBeenCalledWith(0);
    });

    it('should delegate stop to playbackManager', () => {
        service.stop();
        expect(mockEngine.playbackManager.stop).toHaveBeenCalled();
    });

    it('should delegate setBPM to transport', () => {
        service.setBPM(120);
        expect(mockEngine.transport.setBPM).toHaveBeenCalledWith(120);
    });
});

// =================== WorkletService Tests ===================

describe('WorkletService', () => {
    let service;
    let mockEngine;

    beforeEach(() => {
        mockEngine = createMockEngine();
        service = new WorkletService(mockEngine);
    });

    it('should initialize with empty sets', () => {
        expect(service.loadedWorklets.size).toBe(0);
        expect(service.workletNodes.size).toBe(0);
    });

    it('should have loadRequiredWorklets method', () => {
        expect(typeof service.loadRequiredWorklets).toBe('function');
    });

    it('should have isWorkletLoaded method', () => {
        expect(typeof service.isWorkletLoaded).toBe('function');
        expect(service.isWorkletLoaded('test')).toBe(false);
    });

    it('should have createWorkletNode method', () => {
        expect(typeof service.createWorkletNode).toBe('function');
    });

    it('should have getStats method', () => {
        expect(typeof service.getStats).toBe('function');
    });

    it('should have dispose method', () => {
        expect(typeof service.dispose).toBe('function');
    });
});

// =================== EffectService Tests ===================

describe('EffectService', () => {
    let service;
    let mockEngine;

    beforeEach(() => {
        mockEngine = createMockEngine();
        service = new EffectService(mockEngine);
    });

    it('should initialize with empty maps', () => {
        expect(service.effects.size).toBe(0);
        expect(service.effectIdToInsertId.size).toBe(0);
    });

    it('should have addEffect method', () => {
        expect(typeof service.addEffect).toBe('function');
    });

    it('should have removeEffect method', () => {
        expect(typeof service.removeEffect).toBe('function');
    });

    it('should have toggleEffect method', () => {
        expect(typeof service.toggleEffect).toBe('function');
    });

    it('should have updateEffect method', () => {
        expect(typeof service.updateEffect).toBe('function');
    });

    it('should have reorderEffect method', () => {
        expect(typeof service.reorderEffect).toBe('function');
    });

    it('should have getAvailableEffectTypes method', () => {
        expect(typeof service.getAvailableEffectTypes).toBe('function');
        const types = service.getAvailableEffectTypes();
        expect(Array.isArray(types)).toBe(true);
    });

    it('should have clearEffects method', () => {
        expect(typeof service.clearEffects).toBe('function');
    });
});

// =================== PerformanceService Tests ===================

describe('PerformanceService', () => {
    let service;
    let mockEngine;

    beforeEach(() => {
        mockEngine = createMockEngine();
        service = new PerformanceService(mockEngine);
    });

    it('should initialize with default metrics', () => {
        expect(service.metrics.activeVoices).toBe(0);
        expect(service.metrics.cpuUsage).toBe(0);
        expect(service.isMonitoring).toBe(false);
    });

    it('should have start method', () => {
        expect(typeof service.start).toBe('function');
    });

    it('should have stop method', () => {
        expect(typeof service.stop).toBe('function');
    });

    it('should have updateMetrics method', () => {
        expect(typeof service.updateMetrics).toBe('function');
    });

    it('should have countActiveVoices method', () => {
        expect(typeof service.countActiveVoices).toBe('function');
        expect(service.countActiveVoices()).toBe(0);
    });

    it('should have getAudioLatency method', () => {
        expect(typeof service.getAudioLatency).toBe('function');
        const latency = service.getAudioLatency();
        expect(latency).toBe(15); // (0.01 + 0.005) * 1000
    });

    it('should have getEngineStats method', () => {
        expect(typeof service.getEngineStats).toBe('function');
        const stats = service.getEngineStats();
        expect(stats.performance).toBeDefined();
        expect(stats.audioContext).toBeDefined();
    });

    it('should have incrementMetric method', () => {
        service.incrementMetric('effectsCreated', 1);
        expect(service.metrics.effectsCreated).toBe(1);
    });

    it('should have dispose method', () => {
        expect(typeof service.dispose).toBe('function');
    });
});
