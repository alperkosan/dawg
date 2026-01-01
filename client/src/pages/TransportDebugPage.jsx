/**
 * Transport Debug Page - Real-time transport system monitoring
 * Used for verifying PPQ sync, tick accuracy, and latency measurements
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NativeAudioEngineFacade } from '@/lib/core/NativeAudioEngineFacade';
import { AudioContextService } from '@/lib/services/AudioContextService';
import './TransportDebugPage.css';

export default function TransportDebugPage() {
    // State
    const [engineStatus, setEngineStatus] = useState('idle');
    const [isPlaying, setIsPlaying] = useState(false);
    const [transportState, setTransportState] = useState({
        wasmTick: 0,
        jsTick: 0,
        step: 0,
        bpm: 120,
        ppq: 96,
        ticksPerStep: 24,
        isPlaying: false,
        loopStart: 0,
        loopEnd: 64,
        samples_per_tick: 0,
    });
    const [latencyHistory, setLatencyHistory] = useState([]);
    const [logs, setLogs] = useState([]);

    // Refs
    const audioEngineRef = useRef(null);
    const animationFrameRef = useRef(null);
    const lastUpdateTimeRef = useRef(0);

    // Add log entry
    const addLog = useCallback((type, message, data = {}) => {
        const timestamp = performance.now().toFixed(2);
        setLogs(prev => [...prev.slice(-50), { timestamp, type, message, data }]);
        console.log(`🔍 [${type}] ${message}`, data);
    }, []);

    // Initialize audio engine
    const initializeEngine = async () => {
        try {
            setEngineStatus('initializing');
            addLog('INIT', 'Starting audio engine initialization...');

            const engine = new NativeAudioEngineFacade();
            await engine.initialize();
            await AudioContextService.setAudioEngine(engine);
            await engine.resumeAudioContext();

            audioEngineRef.current = engine;
            setEngineStatus('ready');

            // Log initial transport values
            const transport = engine.transport;
            if (transport) {
                addLog('INIT', 'Transport initialized', {
                    ppq: transport.ppq,
                    ticksPerStep: transport.ticksPerStep,
                    bpm: transport.bpm,
                    loopStart: transport.loopStartTick,
                    loopEnd: transport.loopEndTick,
                });

                // Check SharedArrayBuffer sync
                if (transport.sharedFloat) {
                    const sabPPQ = transport.sharedFloat[transport.SAB_IDX_PPQ];
                    const sabBPM = transport.sharedFloat[transport.SAB_IDX_BPM];
                    addLog('SAB', 'SharedArrayBuffer initial values', {
                        sabPPQ,
                        sabBPM,
                        jsPPQ: transport.ppq,
                        jsBPM: transport.bpm,
                        ppqMatch: sabPPQ === transport.ppq,
                        bpmMatch: Math.abs(sabBPM - transport.bpm) < 0.01,
                    });
                }
            }

            // Start monitoring loop
            startMonitoring();

        } catch (error) {
            setEngineStatus('error');
            addLog('ERROR', 'Engine initialization failed', { error: error.message });
        }
    };

    // =================== LOCAL TRANSPORT CONTROLS ===================
    // These bypass the global singleton and work directly with our engine instance

    const handlePlay = useCallback(() => {
        const engine = audioEngineRef.current;
        if (!engine?.transport) {
            addLog('ERROR', 'Cannot play: no transport available');
            return;
        }

        const transport = engine.transport;
        if (transport.isPlaying) {
            transport.pause();
            setIsPlaying(false);
            addLog('TRANSPORT', 'Paused');
        } else {
            transport.start();
            setIsPlaying(true);
            addLog('TRANSPORT', 'Started', {
                ppq: transport.ppq,
                bpm: transport.bpm,
                currentTick: transport.currentTick,
            });
        }
    }, [addLog]);

    const handleStop = useCallback(() => {
        const engine = audioEngineRef.current;
        if (!engine?.transport) return;

        // Log final stats before stopping (values will be preserved in UI)
        const transport = engine.transport;
        addLog('TRANSPORT', 'Stopped', {
            finalTick: transport.currentTick?.toFixed(2),
            finalStep: transport.ticksToSteps?.(transport.currentTick)?.toFixed(2),
            avgLatency: latencyHistory.length > 0
                ? (latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length).toFixed(2) + 'ms'
                : 'N/A',
        });

        engine.transport.stop();
        setIsPlaying(false);
        // Don't clear latencyHistory - keep values for analysis
    }, [addLog, latencyHistory]);

    const handleBpmChange = useCallback((newBpm) => {
        const engine = audioEngineRef.current;
        if (!engine?.transport) return;

        const bpm = Number(newBpm);
        if (bpm >= 20 && bpm <= 300) {
            engine.transport.setBPM(bpm);
            addLog('TRANSPORT', `BPM changed to ${bpm}`);
        }
    }, [addLog]);

    // Monitoring loop
    const startMonitoring = useCallback(() => {
        const monitor = () => {
            const engine = audioEngineRef.current;
            if (!engine?.transport) {
                animationFrameRef.current = requestAnimationFrame(monitor);
                return;
            }

            const transport = engine.transport;
            const now = performance.now();

            // Get WASM tick from SharedArrayBuffer
            let wasmTick = 0;
            if (transport.sharedFloat) {
                wasmTick = transport.sharedFloat[transport.SAB_IDX_POS_TICKS] || 0;
            }

            const jsTick = transport.currentTick || 0;
            const tickDiff = Math.abs(wasmTick - jsTick);
            const step = transport.ticksToSteps ? transport.ticksToSteps(jsTick) : jsTick / 24;

            // Calculate latency (tick difference in ms)
            const secondsPerTick = 60 / (transport.bpm * transport.ppq);
            const latencyMs = tickDiff * secondsPerTick * 1000;

            // Update state (throttled to 30fps)
            if (now - lastUpdateTimeRef.current > 33) {
                lastUpdateTimeRef.current = now;

                setTransportState({
                    wasmTick: wasmTick.toFixed(2),
                    jsTick: jsTick.toFixed(2),
                    tickDiff: tickDiff.toFixed(2),
                    step: step.toFixed(2),
                    bpm: transport.bpm,
                    ppq: transport.ppq,
                    ticksPerStep: transport.ticksPerStep,
                    isPlaying: transport.isPlaying,
                    loopStart: transport.loopStartTick,
                    loopEnd: transport.loopEndTick,
                    latencyMs: latencyMs.toFixed(2),
                });

                // Track latency history (last 100 samples)
                if (transport.isPlaying) {
                    setLatencyHistory(prev => [...prev.slice(-100), latencyMs]);
                }

                // Log significant tick differences
                if (tickDiff > 24 && transport.isPlaying) {
                    addLog('SYNC', `Tick mismatch detected: diff=${tickDiff.toFixed(2)}`, {
                        wasmTick,
                        jsTick,
                        latencyMs: latencyMs.toFixed(2),
                    });
                }
            }

            animationFrameRef.current = requestAnimationFrame(monitor);
        };

        animationFrameRef.current = requestAnimationFrame(monitor);
    }, [addLog]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Calculate average latency
    const avgLatency = latencyHistory.length > 0
        ? (latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length).toFixed(2)
        : '0.00';
    const maxLatency = latencyHistory.length > 0
        ? Math.max(...latencyHistory).toFixed(2)
        : '0.00';

    // Render
    return (
        <div className="transport-debug-page">
            <header className="debug-header">
                <h1>🔧 Transport Debug</h1>
                <span className={`status ${engineStatus}`}>{engineStatus.toUpperCase()}</span>
            </header>

            {engineStatus === 'idle' && (
                <div className="init-section">
                    <button onClick={initializeEngine} className="init-btn">
                        Initialize Audio Engine
                    </button>
                </div>
            )}

            {engineStatus === 'ready' && (
                <>
                    {/* Controls */}
                    <section className="controls-section">
                        <button
                            onClick={handlePlay}
                            className={`control-btn ${isPlaying ? 'playing' : ''}`}
                        >
                            {isPlaying ? '⏸ Pause' : '▶ Play'}
                        </button>
                        <button onClick={handleStop} className="control-btn">
                            ⏹ Stop
                        </button>
                        <div className="bpm-control">
                            <label>BPM:</label>
                            <input
                                type="number"
                                value={transportState.bpm}
                                onChange={(e) => handleBpmChange(Number(e.target.value))}
                                min="20"
                                max="300"
                            />
                        </div>
                    </section>

                    {/* Transport State */}
                    <section className="state-section">
                        <h2>Transport State</h2>
                        <div className="state-grid">
                            <div className="state-item">
                                <label>WASM Tick</label>
                                <span className="value">{transportState.wasmTick}</span>
                            </div>
                            <div className="state-item">
                                <label>JS Tick</label>
                                <span className="value">{transportState.jsTick}</span>
                            </div>
                            <div className={`state-item ${Number(transportState.tickDiff) > 24 ? 'warning' : ''}`}>
                                <label>Tick Diff</label>
                                <span className="value">{transportState.tickDiff}</span>
                            </div>
                            <div className="state-item">
                                <label>Step</label>
                                <span className="value">{transportState.step}</span>
                            </div>
                            <div className="state-item">
                                <label>PPQ</label>
                                <span className="value">{transportState.ppq}</span>
                            </div>
                            <div className="state-item">
                                <label>Ticks/Step</label>
                                <span className="value">{transportState.ticksPerStep}</span>
                            </div>
                        </div>
                    </section>

                    {/* Latency Metrics */}
                    <section className="latency-section">
                        <h2>Latency Metrics</h2>
                        <div className="latency-grid">
                            <div className={`latency-item ${Number(transportState.latencyMs) > 10 ? 'bad' : Number(transportState.latencyMs) > 5 ? 'warning' : 'good'}`}>
                                <label>Current</label>
                                <span className="value">{transportState.latencyMs}ms</span>
                            </div>
                            <div className={`latency-item ${Number(avgLatency) > 10 ? 'bad' : Number(avgLatency) > 5 ? 'warning' : 'good'}`}>
                                <label>Average</label>
                                <span className="value">{avgLatency}ms</span>
                            </div>
                            <div className={`latency-item ${Number(maxLatency) > 10 ? 'bad' : Number(maxLatency) > 5 ? 'warning' : 'good'}`}>
                                <label>Max</label>
                                <span className="value">{maxLatency}ms</span>
                            </div>
                        </div>
                        <div className="latency-legend">
                            <span className="good">≤5ms: Good</span>
                            <span className="warning">5-10ms: Acceptable</span>
                            <span className="bad">&gt;10ms: Issue</span>
                        </div>
                    </section>

                    {/* Logs */}
                    <section className="logs-section">
                        <h2>Logs</h2>
                        <div className="logs-container">
                            {logs.slice().reverse().map((log, i) => (
                                <div key={i} className={`log-entry ${log.type.toLowerCase()}`}>
                                    <span className="log-time">{log.timestamp}</span>
                                    <span className="log-type">[{log.type}]</span>
                                    <span className="log-message">{log.message}</span>
                                    {Object.keys(log.data).length > 0 && (
                                        <code className="log-data">{JSON.stringify(log.data)}</code>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
